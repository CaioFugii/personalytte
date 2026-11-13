import { EntityManager, FlushMode, type FilterQuery, wrap } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import {
  ErroApi,
  MENSAGEM_BLOQUEIO,
  MENSAGEM_DATA,
  MENSAGEM_EVENTO_COM_AULA,
  MENSAGEM_OCUPADO,
  dadosInvalidos,
  mensagemGrupoCheio,
} from '../comum/erros';
import { DURACAO_AULA_MS, calcularOcorrencias, dataRetroativa, dataSP, diaDaSemana, doisDigitos, fimDaAula, partesSP } from '../comum/tempo';
import { responsavelAtivo } from '../comum/validacao';
import { Integrante } from '../entidades/integrante.entity';
import { Aluno } from '../entidades/aluno.entity';
import { Aula } from '../entidades/aula.entity';
import { Evento } from '../entidades/evento.entity';
import { Grupo } from '../entidades/grupo.entity';
import type { StatusAula } from '../entidades/enums';

type PoliticaConflito = 'recusar' | 'ignorar';

function horaCivil(inicio: Date): string {
  const partes = partesSP(inicio);
  return `${doisDigitos(partes.hora)}:${doisDigitos(partes.minuto)}`;
}

export const CAPACIDADE_PADRAO = 4;
export const CAPACIDADE_MAXIMA = 6;

export function planoCompleto(aluno: Pick<Aluno, 'horarios'>): boolean {
  return aluno.horarios.length > 0 && aluno.horarios.every((horario) => Boolean(horario.responsavelId));
}

export function ocupaVaga(status: StatusAula): boolean {
  return status === 'AGUARDANDO' || status === 'CONFIRMADA';
}

export function capacidadeDe(valor: unknown): number {
  if (valor === CAPACIDADE_PADRAO || valor === 5 || valor === CAPACIDADE_MAXIMA) return valor;
  throw dadosInvalidos('A capacidade do grupo é 4, 5 ou 6.');
}

export function exigirIntervaloGrupo(inicio: Date, fim: Date): void {
  if (fim.getTime() - inicio.getTime() < DURACAO_AULA_MS) {
    throw dadosInvalidos('O grupo dura no mínimo 1 hora.');
  }
  if (dataSP(inicio) !== dataSP(fim)) {
    throw dadosInvalidos('O grupo precisa começar e terminar no mesmo dia.');
  }
}

@Injectable()
export class AgendaService {
  async prepararGrupo(
    em: EntityManager,
    params: { responsavel: Integrante; inicio: Date; fim: Date; capacidade: number },
  ): Promise<Grupo> {
    exigirIntervaloGrupo(params.inicio, params.fim);
    const existente = await em.findOne(Grupo, {
      responsavel: params.responsavel.id,
      inicio: params.inicio,
    }, { populate: ['responsavel'], flushMode: FlushMode.COMMIT });
    if (existente) return existente;
    const grupo = new Grupo();
    grupo.responsavel = params.responsavel;
    grupo.inicio = params.inicio;
    grupo.fim = params.fim;
    grupo.capacidade = params.capacidade;
    return grupo;
  }

  persistirGrupo(em: EntityManager, grupo: Grupo): void {
    if (!wrap(grupo).isManaged()) em.persist(grupo);
  }

  async conflito(
    em: EntityManager,
    params: { alunoId: string; grupo: Grupo; ignorarAulaId?: string; status?: StatusAula },
  ): Promise<string | null> {
    const status = params.status ?? 'AGUARDANDO';
    const inicio = params.grupo.inicio;
    const fim = params.grupo.fim;
    const where: FilterQuery<Aula> = {
      $or: [
        { aluno: params.alunoId },
        { grupo: { responsavel: params.grupo.responsavel.id } },
      ],
    };
    if (params.ignorarAulaId) where.id = { $ne: params.ignorarAulaId };
    const candidatas = await em.find(Aula, where, {
      populate: ['aluno', 'grupo', 'grupo.responsavel'],
      flushMode: FlushMode.COMMIT,
    });
    for (const aula of candidatas) {
      const cruza = aula.grupo.inicio < fim && aula.grupo.fim > inicio;
      if (!cruza) continue;
      if (aula.aluno.id === params.alunoId) return MENSAGEM_OCUPADO;
      if (
        ocupaVaga(status)
        && ocupaVaga(aula.status)
        && aula.grupo.id !== params.grupo.id
        && aula.grupo.responsavel.id === params.grupo.responsavel.id
      ) {
        return MENSAGEM_OCUPADO;
      }
    }
    if (ocupaVaga(status)) {
      const doGrupo = await em.find(Aula, { grupo: params.grupo.id }, { flushMode: FlushMode.COMMIT });
      const ocupadas = doGrupo.filter((aula) => aula.id !== params.ignorarAulaId && ocupaVaga(aula.status)).length;
      if (ocupadas >= params.grupo.capacidade) return mensagemGrupoCheio(params.grupo.capacidade);
    }
    return null;
  }

  async bloqueada(em: EntityManager, inicio: Date, fim: Date): Promise<boolean> {
    const total = await em.count(Evento, { inicio: { $lt: fim }, fim: { $gt: inicio } }, {
      flushMode: FlushMode.COMMIT,
    });
    return total > 0;
  }

  async assertEventoSemAula(em: EntityManager, inicio: Date, fim: Date): Promise<void> {
    const total = await em.count(Aula, {
      status: { $ne: 'CANCELADA' },
      grupo: { inicio: { $lt: fim }, fim: { $gt: inicio } },
    }, { flushMode: FlushMode.COMMIT });
    if (total > 0) throw new ErroApi(409, 'HORARIO_OCUPADO', MENSAGEM_EVENTO_COM_AULA);
  }

  exigirDataAgenda(inicio: Date, agora = new Date()): void {
    if (dataRetroativa(inicio, agora)) throw new ErroApi(400, 'DADOS_INVALIDOS', MENSAGEM_DATA);
  }

  async assertPodeEntrar(
    em: EntityManager,
    params: { alunoId: string; grupo: Grupo; ignorarAulaId?: string; status?: StatusAula },
  ): Promise<void> {
    exigirIntervaloGrupo(params.grupo.inicio, params.grupo.fim);
    const status = params.status ?? 'AGUARDANDO';
    if (status !== 'CANCELADA' && await this.bloqueada(em, params.grupo.inicio, params.grupo.fim)) {
      throw new ErroApi(409, 'BLOQUEIO_AGENDA', MENSAGEM_BLOQUEIO);
    }
    const conflito = await this.conflito(em, { ...params, status });
    if (conflito) throw new ErroApi(409, 'HORARIO_OCUPADO', conflito);
  }

  async assertGrupoConsistente(em: EntityManager, grupo: Grupo): Promise<void> {
    exigirIntervaloGrupo(grupo.inicio, grupo.fim);
    const aulas = await em.find(Aula, { grupo: grupo.id }, {
      populate: ['aluno'],
      flushMode: FlushMode.COMMIT,
    });
    const ocupando = aulas.filter((aula) => ocupaVaga(aula.status));
    if (ocupando.length > grupo.capacidade) {
      throw new ErroApi(409, 'HORARIO_OCUPADO', mensagemGrupoCheio(grupo.capacidade));
    }
    const segueNaAgenda = aulas.some((aula) => aula.status !== 'CANCELADA');
    if (segueNaAgenda && await this.bloqueada(em, grupo.inicio, grupo.fim)) {
      throw new ErroApi(409, 'BLOQUEIO_AGENDA', MENSAGEM_BLOQUEIO);
    }
    for (const aula of aulas) {
      const conflito = await this.conflito(em, {
        alunoId: aula.aluno.id,
        grupo,
        ignorarAulaId: aula.id,
        status: aula.status,
      });
      if (conflito) throw new ErroApi(409, 'HORARIO_OCUPADO', conflito);
    }
  }

  async removerAguardandoFuturas(
    em: EntityManager,
    alunoId: string,
    agora: Date,
    somentePlano: boolean,
  ): Promise<void> {
    const aulas = await em.find(Aula, {
      aluno: alunoId,
      status: 'AGUARDANDO',
      grupo: { inicio: { $gt: agora } },
      ...(somentePlano ? { ligadaAoPlano: true } : {}),
    }, { populate: ['grupo'] });
    const grupos = [...new Map(aulas.map((aula) => [aula.grupo.id, aula.grupo])).values()];
    for (const aula of aulas) em.remove(aula);
    if (aulas.length > 0) await em.flush();
    for (const grupo of grupos) await this.removerGrupoSeVazio(em, grupo.id);
    if (grupos.length > 0) await em.flush();
  }

  async removerGrupoSeVazio(em: EntityManager, grupoId: string): Promise<void> {
    const restantes = await em.count(Aula, { grupo: grupoId }, { flushMode: FlushMode.COMMIT });
    if (restantes > 0) return;
    const grupo = await em.findOne(Grupo, { id: grupoId }, { flushMode: FlushMode.COMMIT });
    if (grupo) em.remove(grupo);
  }

  async gerarOcorrencias(em: EntityManager, aluno: Aluno, agora: Date, politica: PoliticaConflito): Promise<number> {
    if (aluno.planoSuspenso || !planoCompleto(aluno)) return 0;
    const slots = calcularOcorrencias(aluno.horarios, agora);
    const professores = new Map<string, Integrante>();
    const professorDe = async (id: string): Promise<Integrante> => {
      const guardado = professores.get(id);
      if (guardado) return guardado;
      const pessoa = await responsavelAtivo(em, id);
      professores.set(id, pessoa);
      return pessoa;
    };
    const pendentes: { inicio: number; fim: number }[] = [];
    let criadas = 0;
    for (const slot of slots) {
      const inicio = slot.inicio;
      const fim = fimDaAula(inicio);
      if (dataSP(inicio) !== dataSP(fim)) continue;
      const ligada = await em.findOne(Aula, {
        aluno: aluno.id,
        ligadaAoPlano: true,
        grupo: { inicio },
      }, { flushMode: FlushMode.COMMIT });
      if (ligada) continue;
      if (await this.bloqueada(em, inicio, fim)) continue;
      const cruzaPendente = pendentes.some((item) => item.inicio < fim.getTime() && item.fim > inicio.getTime());
      if (cruzaPendente) {
        if (politica === 'recusar') throw new ErroApi(409, 'HORARIO_OCUPADO', MENSAGEM_OCUPADO);
        continue;
      }
      const responsavel = await professorDe(slot.responsavelId);
      const grupo = await this.prepararGrupo(em, {
        responsavel,
        inicio,
        fim,
        capacidade: await this.capacidadeHerdada(em, responsavel.id, inicio, agora),
      });
      const conflito = await this.conflito(em, { alunoId: aluno.id, grupo, status: 'AGUARDANDO' });
      if (conflito) {
        if (politica === 'recusar') throw new ErroApi(409, 'HORARIO_OCUPADO', conflito);
        continue;
      }
      this.persistirGrupo(em, grupo);
      const aula = new Aula();
      aula.aluno = aluno;
      aula.grupo = grupo;
      aula.status = 'AGUARDANDO';
      aula.experimental = false;
      aula.reposicaoDe = null;
      aula.ligadaAoPlano = true;
      em.persist(aula);
      pendentes.push({ inicio: inicio.getTime(), fim: fim.getTime() });
      criadas += 1;
    }
    return criadas;
  }

  private async capacidadeHerdada(em: EntityManager, responsavelId: string, inicio: Date, agora: Date): Promise<number> {
    const hora = horaCivil(inicio);
    const dia = diaDaSemana(inicio);
    const grupos = await em.find(Grupo, { responsavel: responsavelId }, {
      populate: ['responsavel'],
      flushMode: FlushMode.COMMIT,
    });
    const doSlot = grupos.filter((grupo) => diaDaSemana(grupo.inicio) === dia && horaCivil(grupo.inicio) === hora);
    const futuros = doSlot.filter((grupo) => grupo.inicio.getTime() >= agora.getTime()).sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
    if (futuros[0]) return futuros[0].capacidade;
    const passados = [...doSlot].sort((a, b) => b.inicio.getTime() - a.inicio.getTime());
    return passados[0]?.capacidade ?? CAPACIDADE_PADRAO;
  }

  async estenderHorizonte(em: EntityManager, agora = new Date()): Promise<number> {
    return em.transactional(async (tx) => {
      const alunos = await tx.find(Aluno, { ativo: true });
      let total = 0;
      for (const aluno of alunos) {
        if (!planoCompleto(aluno) || aluno.planoSuspenso) continue;
        total += await this.gerarOcorrencias(tx, aluno, agora, 'ignorar');
        await tx.flush();
      }
      return total;
    });
  }
}
