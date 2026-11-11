import { EntityManager, wrap } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import type { GrupoFixoResposta, GrupoResposta } from '../../comum/contrato';
import { dadosInvalidos, ErroApi, MENSAGEM_JA_INICIOU, mensagemGrupoCheio, naoEncontrado, traduzirErroBanco } from '../../comum/erros';
import { serializarGrupo } from '../../comum/serializar';
import { diaDaSemana, doisDigitos, ehDiaSemana, fimDaAula, horarioValido, jaComecou, partesSP, type DiaSemana, type HorarioPlano } from '../../comum/tempo';
import { alunoAtivo, booleanoDe, exigirIntervalo, exigirObjeto, horariosDe, instanteDe, responsavelAtivo, uuidDe, veio } from '../../comum/validacao';
import { AgendaService, CAPACIDADE_PADRAO, capacidadeDe, exigirIntervaloGrupo } from '../../dominio/agenda.service';
import { responderAulas } from '../../dominio/reposicao';
import { Aluno } from '../../entidades/aluno.entity';
import { Aula } from '../../entidades/aula.entity';
import { Grupo } from '../../entidades/grupo.entity';
import { Integrante } from '../../entidades/integrante.entity';

@Injectable()
export class GruposService {
  constructor(
    private readonly em: EntityManager,
    private readonly agenda: AgendaService,
  ) {}

  async listar(de: unknown, ate: unknown): Promise<GrupoResposta[]> {
    const intervalo = de == null && ate == null ? null : exigirIntervalo(de, ate);
    const onde = intervalo ? { inicio: { $gte: intervalo.inicio, $lt: intervalo.fim } } : {};
    const grupos = await this.em.find(Grupo, onde, {
      populate: ['responsavel', 'aulas', 'aulas.aluno', 'aulas.grupo', 'aulas.grupo.responsavel', 'aulas.reposicaoDe'],
      orderBy: { inicio: 'asc', id: 'asc' },
    });
    const respostas: GrupoResposta[] = [];
    for (const grupo of grupos) {
      const aulas = grupo.aulas.getItems().sort((a, b) => a.aluno.nome.localeCompare(b.aluno.nome, 'pt-BR'));
      respostas.push(serializarGrupo(grupo, await responderAulas(this.em, aulas)));
    }
    return respostas;
  }

  async obter(id: string): Promise<GrupoResposta> {
    return this.responder(this.em, await this.carregar(this.em, id));
  }

  async criar(corpo: unknown, agora = new Date()): Promise<GrupoResposta> {
    const dados = exigirObjeto(corpo);
    const alunoIds = this.alunoIds(dados);
    const inicio = instanteDe(dados.inicio, 'O início');
    const fimPedido = veio(dados, 'fim') && dados.fim != null ? instanteDe(dados.fim, 'O fim') : null;
    const capacidadePedida = veio(dados, 'capacidade') ? capacidadeDe(dados.capacidade) : null;
    const fimNovo = fimPedido ?? fimDaAula(inicio);
    const capacidadeNova = capacidadePedida ?? CAPACIDADE_PADRAO;
    exigirIntervaloGrupo(inicio, fimNovo);
    const experimental = veio(dados, 'experimental') ? booleanoDe(dados.experimental, 'Experimental') : false;
    try {
      return await this.em.transactional(async (em) => {
        this.agenda.exigirDataAgenda(inicio, agora);
        const responsavel = await responsavelAtivo(em, uuidDe(dados.responsavelId, 'Responsável'));
        const grupo = await this.agenda.prepararGrupo(em, {
          responsavel,
          inicio,
          fim: fimNovo,
          capacidade: capacidadeNova,
        });
        if (wrap(grupo).isManaged()) {
          let mudou = false;
          if (fimPedido && grupo.fim.getTime() !== fimPedido.getTime()) {
            if (jaComecou(grupo.inicio, agora)) throw new ErroApi(409, 'AULA_JA_INICIOU', MENSAGEM_JA_INICIOU);
            grupo.fim = fimPedido;
            mudou = true;
          }
          if (capacidadePedida != null && grupo.capacidade !== capacidadePedida) {
            grupo.capacidade = capacidadePedida;
            mudou = true;
          }
          if (mudou) await this.agenda.assertGrupoConsistente(em, grupo);
        }
        if (alunoIds.length > grupo.capacidade) {
          throw new ErroApi(400, 'DADOS_INVALIDOS', `Informe de 1 a ${grupo.capacidade} alunos.`);
        }
        for (const alunoId of alunoIds) {
          const aluno = await alunoAtivo(em, alunoId);
          await this.agenda.assertPodeEntrar(em, { alunoId: aluno.id, grupo, status: 'AGUARDANDO' });
          const aula = new Aula();
          aula.aluno = aluno;
          aula.grupo = grupo;
          aula.status = 'AGUARDANDO';
          aula.experimental = experimental;
          aula.reposicaoDe = null;
          aula.ligadaAoPlano = false;
          this.agenda.persistirGrupo(em, grupo);
          em.persist(aula);
          await em.flush();
        }
        return this.responder(em, grupo);
      });
    } catch (erro) {
      const traduzido = traduzirErroBanco(erro);
      if (traduzido) throw traduzido;
      throw erro;
    }
  }

  async atualizar(id: string, corpo: unknown, agora = new Date()): Promise<GrupoResposta> {
    uuidDe(id, 'Identificador');
    const dados = exigirObjeto(corpo);
    try {
      return await this.em.transactional(async (em) => {
        const grupo = await this.carregar(em, id);
        const inicioAntes = grupo.inicio.getTime();
        const fimAntes = grupo.fim.getTime();
        const responsavelAntes = grupo.responsavel.id;
        let mudouAgenda = false;
        if (veio(dados, 'inicio') || veio(dados, 'fim')) {
          const inicio = veio(dados, 'inicio') ? instanteDe(dados.inicio, 'O início') : grupo.inicio;
          let fim: Date;
          if (veio(dados, 'fim')) fim = instanteDe(dados.fim, 'O fim');
          else if (inicio.getTime() !== inicioAntes) fim = new Date(inicio.getTime() + (fimAntes - inicioAntes));
          else fim = grupo.fim;
          if (inicio.getTime() !== inicioAntes || fim.getTime() !== fimAntes) {
            if (jaComecou(grupo.inicio, agora)) throw new ErroApi(409, 'AULA_JA_INICIOU', MENSAGEM_JA_INICIOU);
            this.agenda.exigirDataAgenda(inicio, agora);
            exigirIntervaloGrupo(inicio, fim);
            grupo.inicio = inicio;
            grupo.fim = fim;
            mudouAgenda = true;
          }
        }
        if (veio(dados, 'responsavelId')) {
          const responsavelId = uuidDe(dados.responsavelId, 'Responsável');
          if (responsavelId !== grupo.responsavel.id) {
            grupo.responsavel = await responsavelAtivo(em, responsavelId);
            mudouAgenda = true;
          }
        }
        if (veio(dados, 'capacidade')) {
          const capacidade = capacidadeDe(dados.capacidade);
          if (capacidade !== grupo.capacidade) grupo.capacidade = capacidade;
        }
        if (mudouAgenda) {
          for (const aula of grupo.aulas) aula.ligadaAoPlano = false;
        }
        await this.agenda.assertGrupoConsistente(em, grupo);
        await em.flush();
        return this.responder(em, grupo);
      });
    } catch (erro) {
      const traduzido = traduzirErroBanco(erro);
      if (traduzido) throw traduzido;
      throw erro;
    }
  }

  async listarFixos(agora = new Date()): Promise<GrupoFixoResposta[]> {
    const alunos = await this.em.find(Aluno, { ativo: true, temporario: false });
    const grupos = await this.em.find(Grupo, {}, { populate: ['responsavel'] });
    const porChave = new Map<string, { slot: SlotFixo; alunos: Aluno[] }>();
    for (const aluno of alunos) {
      for (const horario of aluno.horarios) {
        if (horario.dia === 'dom') continue;
        const slot = { dia: horario.dia, horarioInicio: horario.horarioInicio.slice(0, 5), responsavelId: horario.responsavelId };
        const chave = chaveFixo(slot);
        const atual = porChave.get(chave) ?? { slot, alunos: [] };
        atual.alunos.push(aluno);
        porChave.set(chave, atual);
      }
    }
    const ids = [...new Set([...porChave.values()].map((item) => item.slot.responsavelId))];
    const pessoas = ids.length === 0 ? [] : await this.em.find(Integrante, { id: { $in: ids } });
    const nomes = new Map(pessoas.map((pessoa) => [pessoa.id, pessoa.nome]));
    const ordem = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
    return [...porChave.values()]
      .map((item) => this.respostaFixa(item.slot, item.alunos, nomes.get(item.slot.responsavelId) ?? 'Professor', capacidadeDoSlot(grupos, item.slot, agora)))
      .sort((a, b) => ordem.indexOf(a.dia) - ordem.indexOf(b.dia)
        || a.horarioInicio.localeCompare(b.horarioInicio)
        || a.responsavel.nome.localeCompare(b.responsavel.nome, 'pt-BR'));
  }

  async criarFixo(corpo: unknown, agora = new Date()): Promise<GrupoFixoResposta[]> {
    const dados = exigirObjeto(corpo);
    const slot = slotFixo(dados);
    const capacidade = veio(dados, 'capacidade') ? capacidadeDe(dados.capacidade) : CAPACIDADE_PADRAO;
    const alunoIds = idsDeAlunos(dados.alunoIds, capacidade);
    try {
      await this.em.transactional(async (em) => {
        await responsavelAtivo(em, slot.responsavelId);
        if ((await this.alunosDoFixo(em, slot)).length > 0) {
          throw dadosInvalidos('Esse horário já tem grupo com este professor.');
        }
        for (const alunoId of alunoIds) {
          const aluno = await alunoAtivo(em, alunoId);
          if (aluno.temporario) throw dadosInvalidos('Aluno temporário não entra no grupo fixo.');
          aluno.horarios = horariosDe([...aluno.horarios, slot]);
          aluno.planoSuspenso = false;
          await this.agenda.removerAguardandoFuturas(em, aluno.id, agora, true);
          await this.agenda.gerarOcorrencias(em, aluno, agora, 'recusar');
          await em.flush();
          if (capacidade > CAPACIDADE_PADRAO) await this.elevarCapacidade(em, slot, capacidade, agora);
        }
        await this.aplicarCapacidade(em, slot, capacidade, agora);
        await em.flush();
      });
    } catch (erro) {
      const traduzido = traduzirErroBanco(erro);
      if (traduzido) throw traduzido;
      throw erro;
    }
    return this.listarFixos(agora);
  }

  async adicionarFixo(corpo: unknown, agora = new Date()): Promise<GrupoFixoResposta[]> {
    const slot = slotFixo(corpo);
    const alunoId = uuidDe(exigirObjeto(corpo).alunoId, 'Aluno');
    try {
      await this.em.transactional(async (em) => {
        const aluno = await alunoAtivo(em, alunoId);
        if (aluno.temporario) throw dadosInvalidos('Aluno temporário não entra no grupo fixo.');
        await responsavelAtivo(em, slot.responsavelId);
        if (pertenceAoFixo(aluno, slot)) return;
        const capacidade = await this.capacidadeFixo(em, slot, agora);
        const ocupando = await this.alunosDoFixo(em, slot);
        if (ocupando.length >= capacidade) throw new ErroApi(409, 'HORARIO_OCUPADO', mensagemGrupoCheio(capacidade));
        aluno.horarios = horariosDe([...aluno.horarios, slot]);
        aluno.planoSuspenso = false;
        await this.agenda.removerAguardandoFuturas(em, aluno.id, agora, true);
        await this.agenda.gerarOcorrencias(em, aluno, agora, 'recusar');
        await em.flush();
      });
    } catch (erro) {
      const traduzido = traduzirErroBanco(erro);
      if (traduzido) throw traduzido;
      throw erro;
    }
    return this.listarFixos(agora);
  }

  async removerFixo(corpo: unknown, agora = new Date()): Promise<GrupoFixoResposta[]> {
    const slot = slotFixo(corpo);
    const alunoId = uuidDe(exigirObjeto(corpo).alunoId, 'Aluno');
    try {
      await this.em.transactional(async (em) => {
        const aluno = await alunoAtivo(em, alunoId);
        if (!pertenceAoFixo(aluno, slot)) return;
        aluno.horarios = horariosDe(aluno.horarios.filter((horario) => !mesmoFixo(horario, slot)));
        await this.agenda.removerAguardandoFuturas(em, aluno.id, agora, true);
        await this.agenda.gerarOcorrencias(em, aluno, agora, 'recusar');
        await em.flush();
      });
    } catch (erro) {
      const traduzido = traduzirErroBanco(erro);
      if (traduzido) throw traduzido;
      throw erro;
    }
    return this.listarFixos(agora);
  }

  async trocarProfessorFixo(corpo: unknown, agora = new Date()): Promise<GrupoFixoResposta[]> {
    const dados = exigirObjeto(corpo);
    const slot = slotFixo(dados);
    const temProfessor = veio(dados, 'novoResponsavelId');
    const novoId = temProfessor ? uuidDe(dados.novoResponsavelId, 'Professor') : slot.responsavelId;
    const capacidade = veio(dados, 'capacidade') ? capacidadeDe(dados.capacidade) : null;
    if (!temProfessor && capacidade == null) throw dadosInvalidos('Informe o professor ou o limite.');
    if (novoId === slot.responsavelId && capacidade == null) return this.listarFixos(agora);
    const destino: SlotFixo = { dia: slot.dia, horarioInicio: slot.horarioInicio, responsavelId: novoId };
    try {
      await this.em.transactional(async (em) => {
        if (novoId !== slot.responsavelId) await this.moverProfessorFixo(em, slot, destino, agora);
        if (capacidade != null) await this.aplicarCapacidade(em, destino, capacidade, agora);
        await em.flush();
      });
    } catch (erro) {
      const traduzido = traduzirErroBanco(erro);
      if (traduzido) throw traduzido;
      throw erro;
    }
    return this.listarFixos(agora);
  }

  private async moverProfessorFixo(em: EntityManager, slot: SlotFixo, destino: SlotFixo, agora: Date): Promise<void> {
    await responsavelAtivo(em, destino.responsavelId);
    const alunos = await this.alunosDoFixo(em, slot);
    if (alunos.length === 0) throw dadosInvalidos('Esse grupo não tem alunos.');
    const gruposAtuais = await em.find(Grupo, {}, { populate: ['responsavel'] });
    const capacidadeOrigem = capacidadeDoSlot(gruposAtuais, slot, agora);
    const destinoExistente = gruposDoSlot(gruposAtuais, destino);
    const capacidadeDestino = destinoExistente.length > 0
      ? capacidadeDoSlot(gruposAtuais, destino, agora)
      : capacidadeOrigem;
    const jaNoDestino = await this.alunosDoFixo(em, destino);
    if (jaNoDestino.length + alunos.length > capacidadeDestino) {
      throw new ErroApi(409, 'HORARIO_OCUPADO', mensagemGrupoCheio(capacidadeDestino));
    }
    for (const aluno of alunos) {
      aluno.horarios = horariosDe(aluno.horarios.map((horario) => (
        mesmoFixo(horario, slot) ? { ...horario, responsavelId: destino.responsavelId } : horario
      )));
      aluno.planoSuspenso = false;
    }
    for (const aluno of alunos) {
      await this.agenda.removerAguardandoFuturas(em, aluno.id, agora, true);
    }
    for (const aluno of alunos) {
      await this.agenda.gerarOcorrencias(em, aluno, agora, 'recusar');
      await em.flush();
      if (capacidadeDestino > CAPACIDADE_PADRAO) await this.elevarCapacidade(em, destino, capacidadeDestino, agora);
    }
  }

  private async aplicarCapacidade(em: EntityManager, slot: SlotFixo, capacidade: number, agora: Date): Promise<void> {
    const alunos = await this.alunosDoFixo(em, slot);
    if (alunos.length === 0) throw dadosInvalidos('Esse grupo não tem alunos.');
    if (alunos.length > capacidade) throw new ErroApi(409, 'HORARIO_OCUPADO', mensagemGrupoCheio(capacidade));
    const grupos = await em.find(Grupo, { responsavel: slot.responsavelId }, { populate: ['responsavel'] });
    for (const grupo of gruposDoSlot(grupos, slot)) {
      if (grupo.inicio.getTime() < agora.getTime()) continue;
      if (grupo.capacidade === capacidade) continue;
      grupo.capacidade = capacidade;
      await this.agenda.assertGrupoConsistente(em, grupo);
    }
  }

  private async elevarCapacidade(em: EntityManager, slot: SlotFixo, capacidade: number, agora: Date): Promise<void> {
    const grupos = await em.find(Grupo, { responsavel: slot.responsavelId }, { populate: ['responsavel'] });
    for (const grupo of gruposDoSlot(grupos, slot)) {
      if (grupo.inicio.getTime() <= agora.getTime()) continue;
      if (grupo.capacidade < capacidade) grupo.capacidade = capacidade;
    }
  }

  private async capacidadeFixo(em: EntityManager, slot: SlotFixo, agora: Date): Promise<number> {
    const grupos = await em.find(Grupo, { responsavel: slot.responsavelId }, { populate: ['responsavel'] });
    return capacidadeDoSlot(grupos, slot, agora);
  }

  private async alunosDoFixo(em: EntityManager, slot: SlotFixo): Promise<Aluno[]> {
    const alunos = await em.find(Aluno, { ativo: true, temporario: false });
    return alunos.filter((aluno) => pertenceAoFixo(aluno, slot));
  }

  private respostaFixa(slot: SlotFixo, alunos: Aluno[], professor: string, capacidade: number): GrupoFixoResposta {
    return {
      dia: slot.dia,
      horarioInicio: slot.horarioInicio,
      responsavel: { id: slot.responsavelId, nome: professor },
      capacidade,
      alunos: [...alunos]
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
        .map((aluno) => ({ id: aluno.id, nome: aluno.nome, categoria: aluno.categoria })),
    };
  }

  private alunoIds(dados: Record<string, unknown>): string[] {
    if (!Array.isArray(dados.alunoIds) || dados.alunoIds.length === 0) {
      throw new ErroApi(400, 'DADOS_INVALIDOS', `Informe de 1 a ${CAPACIDADE_PADRAO} alunos.`);
    }
    const alunoIds = dados.alunoIds.map((valor) => uuidDe(valor, 'Aluno'));
    if (new Set(alunoIds).size !== alunoIds.length) {
      throw new ErroApi(400, 'DADOS_INVALIDOS', 'O mesmo aluno foi informado mais de uma vez.');
    }
    return alunoIds;
  }

  private async carregar(em: EntityManager, id: string): Promise<Grupo> {
    const grupo = await em.findOne(Grupo, { id }, {
      populate: ['responsavel', 'aulas', 'aulas.aluno', 'aulas.grupo', 'aulas.grupo.responsavel', 'aulas.reposicaoDe'],
    });
    if (!grupo) throw naoEncontrado('Grupo não encontrado.');
    return grupo;
  }

  private async responder(em: EntityManager, grupo: Grupo): Promise<GrupoResposta> {
    const aulas = grupo.aulas.isInitialized()
      ? grupo.aulas.getItems()
      : await em.find(Aula, { grupo: grupo.id }, {
        populate: ['aluno', 'grupo', 'grupo.responsavel', 'reposicaoDe'],
      });
    aulas.sort((a, b) => a.aluno.nome.localeCompare(b.aluno.nome, 'pt-BR'));
    return serializarGrupo(grupo, await responderAulas(em, aulas));
  }
}

type SlotFixo = { dia: DiaSemana; horarioInicio: string; responsavelId: string };

function idsDeAlunos(valor: unknown, limite: number): string[] {
  if (!Array.isArray(valor) || valor.length === 0 || valor.length > limite) {
    throw new ErroApi(400, 'DADOS_INVALIDOS', `Informe de 1 a ${limite} alunos.`);
  }
  const alunoIds = valor.map((item) => uuidDe(item, 'Aluno'));
  if (new Set(alunoIds).size !== alunoIds.length) {
    throw dadosInvalidos('O mesmo aluno foi informado mais de uma vez.');
  }
  return alunoIds;
}

function slotFixo(corpo: unknown): SlotFixo {
  const dados = exigirObjeto(corpo);
  if (typeof dados.dia !== 'string' || !ehDiaSemana(dados.dia) || dados.dia === 'dom') {
    throw dadosInvalidos('O grupo vai de segunda a sábado.');
  }
  if (typeof dados.horarioInicio !== 'string' || !horarioValido(dados.horarioInicio)) {
    throw dadosInvalidos('Horário precisa caber em uma aula de 60 minutos no mesmo dia.');
  }
  return {
    dia: dados.dia,
    horarioInicio: dados.horarioInicio,
    responsavelId: uuidDe(dados.responsavelId, 'Professor'),
  };
}

function chaveFixo(slot: SlotFixo): string {
  return `${slot.dia}|${slot.horarioInicio}|${slot.responsavelId}`;
}

function mesmoFixo(horario: HorarioPlano, slot: SlotFixo): boolean {
  return horario.dia === slot.dia && horario.horarioInicio.slice(0, 5) === slot.horarioInicio && horario.responsavelId === slot.responsavelId;
}

function pertenceAoFixo(aluno: Aluno, slot: SlotFixo): boolean {
  return aluno.horarios.some((horario) => mesmoFixo(horario, slot));
}

function horaDoGrupo(inicio: Date): string {
  const partes = partesSP(inicio);
  return `${doisDigitos(partes.hora)}:${doisDigitos(partes.minuto)}`;
}

function gruposDoSlot(grupos: Grupo[], slot: SlotFixo): Grupo[] {
  return grupos.filter((grupo) => grupo.responsavel.id === slot.responsavelId
    && diaDaSemana(grupo.inicio) === slot.dia
    && horaDoGrupo(grupo.inicio) === slot.horarioInicio);
}

function capacidadeDoSlot(grupos: Grupo[], slot: SlotFixo, agora: Date): number {
  const doSlot = gruposDoSlot(grupos, slot);
  const futuros = doSlot.filter((grupo) => grupo.inicio.getTime() >= agora.getTime()).sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
  if (futuros[0]) return futuros[0].capacidade;
  const passados = [...doSlot].sort((a, b) => b.inicio.getTime() - a.inicio.getTime());
  return passados[0]?.capacidade ?? CAPACIDADE_PADRAO;
}
