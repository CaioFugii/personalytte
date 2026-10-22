import { EntityManager, FlushMode, type FilterQuery } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import { ErroApi, MENSAGEM_BLOQUEIO, MENSAGEM_DATA, MENSAGEM_EVENTO_COM_AULA, MENSAGEM_OCUPADO } from '../comum/erros';
import { DURACAO_AULA_MS, calcularOcorrencias, dataRetroativa, fimDaAula, terminaNoMesmoDia } from '../comum/tempo';
import { Aluno } from '../entidades/aluno.entity';
import { Aula } from '../entidades/aula.entity';
import { Evento } from '../entidades/evento.entity';

type PoliticaConflito = 'recusar' | 'ignorar';

export function planoCompleto(aluno: Pick<Aluno, 'horarios' | 'responsavel'>): boolean {
  return aluno.horarios.length > 0 && aluno.responsavel != null;
}

@Injectable()
export class AgendaService {
  async conflito(
    em: EntityManager,
    params: { alunoId: string; responsavelId: string; inicio: Date; ignorarAulaId?: string },
  ): Promise<boolean> {
    const fim = fimDaAula(params.inicio);
    const where: FilterQuery<Aula> = {
      status: { $ne: 'CANCELADA' },
      inicio: { $lt: fim },
      fim: { $gt: params.inicio },
      $or: [{ aluno: params.alunoId }, { responsavel: params.responsavelId }],
    };
    if (params.ignorarAulaId) where.id = { $ne: params.ignorarAulaId };
    const achou = await em.find(Aula, where, { flushMode: FlushMode.COMMIT });
    return achou.length > 0;
  }

  async bloqueada(em: EntityManager, _responsavelId: string, inicio: Date): Promise<boolean> {
    const fim = new Date(inicio.getTime() + DURACAO_AULA_MS);
    const total = await em.count(Evento, { inicio: { $lt: fim }, fim: { $gt: inicio } }, {
      flushMode: FlushMode.COMMIT,
    });
    return total > 0;
  }

  async assertEventoSemAula(em: EntityManager, inicio: Date, fim: Date): Promise<void> {
    const total = await em.count(Aula, {
      status: { $ne: 'CANCELADA' },
      inicio: { $lt: fim },
      fim: { $gt: inicio },
    }, { flushMode: FlushMode.COMMIT });
    if (total > 0) throw new ErroApi(409, 'HORARIO_OCUPADO', MENSAGEM_EVENTO_COM_AULA);
  }

  exigirDataAgenda(inicio: Date, agora = new Date()): void {
    if (dataRetroativa(inicio, agora)) throw new ErroApi(400, 'DADOS_INVALIDOS', MENSAGEM_DATA);
  }

  async assertPodeAgendar(
    em: EntityManager,
    params: { alunoId: string; responsavelId: string; inicio: Date; ignorarAulaId?: string },
  ): Promise<void> {
    if (!terminaNoMesmoDia(params.inicio)) {
      throw new ErroApi(400, 'DADOS_INVALIDOS', 'A aula precisa começar e terminar no mesmo dia.');
    }
    if (await this.bloqueada(em, params.responsavelId, params.inicio)) {
      throw new ErroApi(409, 'BLOQUEIO_AGENDA', MENSAGEM_BLOQUEIO);
    }
    if (await this.conflito(em, params)) {
      throw new ErroApi(409, 'HORARIO_OCUPADO', MENSAGEM_OCUPADO);
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
      inicio: { $gt: agora },
      ...(somentePlano ? { ligadaAoPlano: true } : {}),
    });
    for (const aula of aulas) em.remove(aula);
    if (aulas.length > 0) await em.flush();
  }

  async gerarOcorrencias(em: EntityManager, aluno: Aluno, agora: Date, politica: PoliticaConflito): Promise<number> {
    if (!planoCompleto(aluno) || !aluno.responsavel) return 0;
    const slots = calcularOcorrencias(aluno.horarios, agora);
    const pendentes: { inicio: number; fim: number }[] = [];
    let criadas = 0;
    for (const inicio of slots) {
      if (!terminaNoMesmoDia(inicio)) continue;
      const ligada = await em.findOne(Aula, { aluno: aluno.id, inicio, ligadaAoPlano: true });
      if (ligada) continue;
      if (await this.bloqueada(em, aluno.responsavel.id, inicio)) continue;
      const fim = fimDaAula(inicio).getTime();
      const cruzaPendente = pendentes.some((item) => item.inicio < fim && item.fim > inicio.getTime());
      if (cruzaPendente || await this.conflito(em, { alunoId: aluno.id, responsavelId: aluno.responsavel.id, inicio })) {
        if (politica === 'recusar') throw new ErroApi(409, 'HORARIO_OCUPADO', MENSAGEM_OCUPADO);
        continue;
      }
      const aula = new Aula();
      aula.aluno = aluno;
      aula.responsavel = aluno.responsavel;
      aula.inicio = inicio;
      aula.fim = fimDaAula(inicio);
      aula.status = 'AGUARDANDO';
      aula.experimental = false;
      aula.reposicaoDe = null;
      aula.ligadaAoPlano = true;
      em.persist(aula);
      pendentes.push({ inicio: inicio.getTime(), fim });
      criadas += 1;
    }
    return criadas;
  }

  async estenderHorizonte(em: EntityManager, agora = new Date()): Promise<number> {
    return em.transactional(async (tx) => {
      const alunos = await tx.find(Aluno, { ativo: true }, { populate: ['responsavel'] });
      let total = 0;
      for (const aluno of alunos) {
        if (!planoCompleto(aluno)) continue;
        total += await this.gerarOcorrencias(tx, aluno, agora, 'ignorar');
        await tx.flush();
      }
      return total;
    });
  }

}
