import { EntityManager, wrap } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import type { AulaResposta } from '../../comum/contrato';
import { ErroApi, MENSAGEM_JA_INICIOU, naoEncontrado, traduzirErroBanco } from '../../comum/erros';
import { alunoAtivo, booleanoDe, exigirIntervalo, exigirObjeto, instanteDe, responsavelAtivo, statusDe, telefoneOpcional, textoObrigatorio, uuidDe, veio } from '../../comum/validacao';
import { fimDaAula } from '../../comum/tempo';
import { AgendaService, CAPACIDADE_PADRAO, capacidadeDe, exigirIntervaloGrupo } from '../../dominio/agenda.service';
import { origemConcedeReposicao, origemDisponivelMaisAntiga, reposicoesEmAberto, responderAulas } from '../../dominio/reposicao';
import { Aluno } from '../../entidades/aluno.entity';
import { Aula } from '../../entidades/aula.entity';
import { Grupo } from '../../entidades/grupo.entity';

const POPULAR = ['aluno', 'grupo', 'grupo.responsavel', 'reposicaoDe'] as const;

@Injectable()
export class AulasService {
  constructor(
    private readonly em: EntityManager,
    private readonly agenda: AgendaService,
  ) {}

  async listar(de: unknown, ate: unknown): Promise<AulaResposta[]> {
    const intervalo = exigirIntervalo(de, ate);
    const aulas = await this.em.find(Aula, {
      grupo: { inicio: { $gte: intervalo.inicio, $lt: intervalo.fim } },
    }, {
      populate: [...POPULAR],
      orderBy: { grupo: { inicio: 'asc' } },
    });
    return responderAulas(this.em, aulas);
  }

  async obter(id: string): Promise<AulaResposta> {
    return (await responderAulas(this.em, [await this.carregar(this.em, id)]))[0];
  }

  async criar(corpo: unknown, agora = new Date()): Promise<AulaResposta> {
    const dados = exigirObjeto(corpo);
    try {
      return await this.em.transactional(async (em) => {
        const aula = await this.montarAvulsa(em, dados, false, agora);
        this.agenda.persistirGrupo(em, aula.grupo);
        em.persist(aula);
        await em.flush();
        return (await responderAulas(em, [aula]))[0];
      });
    } catch (erro) {
      const traduzido = traduzirErroBanco(erro);
      if (traduzido) throw traduzido;
      throw erro;
    }
  }

  async usarReposicao(corpo: unknown, agora = new Date()): Promise<AulaResposta> {
    const dados = exigirObjeto(corpo);
    const alunoId = uuidDe(dados.alunoId, 'Aluno');
    try {
      return await this.em.transactional(async (em) => {
        const aluno = await alunoAtivo(em, alunoId);
        const origem = await origemDisponivelMaisAntiga(em, aluno.id);
        if (!origem) throw new ErroApi(400, 'DADOS_INVALIDOS', 'Este aluno não tem reposição disponível.');
        const reposicao = await this.agendarReposicao(em, origem, {
          responsavelId: dados.responsavelId,
          inicio: dados.inicio,
        }, agora);
        await em.flush();
        return (await responderAulas(em, [reposicao]))[0];
      });
    } catch (erro) {
      const traduzido = traduzirErroBanco(erro);
      if (traduzido) throw traduzido;
      throw erro;
    }
  }

  async atualizar(id: string, corpo: unknown, agora = new Date()): Promise<AulaResposta> {
    uuidDe(id, 'Identificador');
    const dados = exigirObjeto(corpo);
    try {
      return await this.em.transactional(async (em) => {
        const aula = await this.carregar(em, id);
        const statusAnterior = aula.status;
        if (dados.status === 'CANCELADA' && statusAnterior !== 'CANCELADA') {
          throw new ErroApi(400, 'DADOS_INVALIDOS', 'Use Cancelar aula para informar a justificativa.');
        }
        const repoeCancelada = statusAnterior === 'CANCELADA'
          && aula.cancelamentoGeraReposicao === true
          && (!veio(dados, 'status') || dados.status === 'CANCELADA');
        if (veio(dados, 'reposicao') && dados.status !== 'FALTA' && !repoeCancelada) {
          throw new ErroApi(400, 'DADOS_INVALIDOS', 'Reposição só pode ser criada ao marcar falta ou num cancelamento que gera reposição.');
        }
        let mudouAgenda = false;
        if (veio(dados, 'alunoId')) {
          const alunoId = uuidDe(dados.alunoId, 'Aluno');
          if (alunoId !== aula.aluno.id) {
            aula.aluno = await alunoAtivo(em, alunoId);
            aula.ligadaAoPlano = false;
            mudouAgenda = true;
          }
        }
        if (veio(dados, 'telefone')) {
          if (!aula.aluno.temporario) {
            throw new ErroApi(400, 'DADOS_INVALIDOS', 'O telefone de aluno cadastrado se edita na ficha do aluno.');
          }
          aula.aluno.telefone = telefoneOpcional(dados.telefone);
        }
        if (veio(dados, 'experimental')) aula.experimental = booleanoDe(dados.experimental, 'Experimental');
        if (veio(dados, 'status')) aula.status = statusDe(dados.status);
        const voltouAOcupar = statusAnterior === 'CANCELADA' && aula.status !== 'CANCELADA';
        const saiuDaFalta = statusAnterior === 'FALTA' && aula.status !== 'FALTA';
        if (voltouAOcupar) {
          aula.justificativaCancelamento = null;
          aula.cancelamentoGeraReposicao = null;
          aula.justificativaReposicao = null;
        }
        if (veio(dados, 'concederReposicao')) {
          if (dados.concederReposicao == null) {
            if ((await reposicoesEmAberto(em, [aula.id])).has(aula.id)) {
              throw new ErroApi(400, 'DADOS_INVALIDOS', 'Esta aula já tem uma reposição agendada.');
            }
            aula.justificativaReposicao = null;
          } else {
            if (aula.status !== 'FALTA') {
              throw new ErroApi(400, 'DADOS_INVALIDOS', 'A vaga de reposição da falta só vale com o status Falta.');
            }
            const concessao = exigirObjeto(dados.concederReposicao);
            aula.justificativaReposicao = textoObrigatorio(concessao.justificativa, 'a justificativa da reposição');
          }
        } else if (statusAnterior === 'FALTA' && aula.status !== 'FALTA') {
          aula.justificativaReposicao = null;
        }
        if ((mudouAgenda || voltouAOcupar || saiuDaFalta) && aula.status !== 'CANCELADA') {
          await this.agenda.assertPodeEntrar(em, {
            alunoId: aula.aluno.id,
            grupo: aula.grupo,
            ignorarAulaId: aula.id,
            status: aula.status,
          });
        }
        if (veio(dados, 'reposicao') && dados.reposicao != null) {
          await this.agendarReposicao(em, aula, dados.reposicao, agora);
        }
        await em.flush();
        return (await responderAulas(em, [aula]))[0];
      });
    } catch (erro) {
      const traduzido = traduzirErroBanco(erro);
      if (traduzido) throw traduzido;
      throw erro;
    }
  }

  async cancelar(id: string, corpo: unknown, agora = new Date()): Promise<AulaResposta> {
    uuidDe(id, 'Identificador');
    const dados = exigirObjeto(corpo);
    const justificativa = textoObrigatorio(dados.justificativa, 'a justificativa do cancelamento');
    if (typeof dados.geraReposicao !== 'boolean') {
      throw new ErroApi(400, 'DADOS_INVALIDOS', 'Informe se o cancelamento gera reposição.');
    }
    const geraReposicao = dados.geraReposicao;
    if (!geraReposicao && dados.reposicao != null) {
      throw new ErroApi(400, 'DADOS_INVALIDOS', 'Só cancelamento que gera reposição pode agendar reposição.');
    }
    try {
      return await this.em.transactional(async (em) => {
        const aula = await this.carregar(em, id);
        if (aula.status === 'CANCELADA') throw new ErroApi(400, 'DADOS_INVALIDOS', 'A aula já está cancelada.');
        aula.status = 'CANCELADA';
        aula.justificativaCancelamento = justificativa;
        aula.cancelamentoGeraReposicao = geraReposicao;
        aula.justificativaReposicao = geraReposicao ? justificativa : null;
        await em.flush();
        if (dados.reposicao != null) await this.agendarReposicao(em, aula, dados.reposicao, agora);
        await em.flush();
        return (await responderAulas(em, [aula]))[0];
      });
    } catch (erro) {
      const traduzido = traduzirErroBanco(erro);
      if (traduzido) throw traduzido;
      throw erro;
    }
  }

  private async agendarReposicao(em: EntityManager, origem: Aula, corpo: unknown, agora: Date): Promise<Aula> {
    if (!origemConcedeReposicao(origem)) {
      throw new ErroApi(400, 'DADOS_INVALIDOS', 'Informe a justificativa da reposição.');
    }
    if ((await reposicoesEmAberto(em, [origem.id])).has(origem.id)) {
      throw new ErroApi(400, 'DADOS_INVALIDOS', 'Esta aula já tem uma reposição agendada.');
    }
    const reposicao = await this.montarReposicao(em, origem, corpo, agora);
    this.agenda.persistirGrupo(em, reposicao.grupo);
    em.persist(reposicao);
    return reposicao;
  }

  private async carregar(em: EntityManager, id: string): Promise<Aula> {
    uuidDe(id, 'Identificador');
    const aula = await em.findOne(Aula, { id }, { populate: [...POPULAR] });
    if (!aula) throw naoEncontrado('Aula não encontrada.');
    return aula;
  }

  private async montarAvulsa(em: EntityManager, dados: Record<string, unknown>, reposicao: boolean, agora: Date): Promise<Aula> {
    const aula = new Aula();
    const experimental = reposicao ? false : (veio(dados, 'experimental') ? booleanoDe(dados.experimental, 'Experimental') : false);
    aula.aluno = await this.resolverAluno(em, dados, experimental);
    const grupo = await this.resolverGrupo(em, dados, agora);
    this.agenda.exigirDataAgenda(grupo.inicio, agora);
    await this.agenda.assertPodeEntrar(em, { alunoId: aula.aluno.id, grupo });
    aula.grupo = grupo;
    aula.status = 'AGUARDANDO';
    aula.experimental = experimental;
    aula.reposicaoDe = null;
    aula.ligadaAoPlano = false;
    return aula;
  }

  private async resolverGrupo(em: EntityManager, dados: Record<string, unknown>, agora: Date): Promise<Grupo> {
    if (veio(dados, 'grupoId') && dados.grupoId) {
      const grupo = await em.findOne(Grupo, { id: uuidDe(dados.grupoId, 'Grupo') }, { populate: ['responsavel'] });
      if (!grupo) throw naoEncontrado('Grupo não encontrado.');
      return grupo;
    }
    const responsavel = await responsavelAtivo(em, uuidDe(dados.responsavelId, 'Responsável'));
    const inicio = instanteDe(dados.inicio, 'O início');
    const fim = veio(dados, 'fim') && dados.fim != null ? instanteDe(dados.fim, 'O fim') : fimDaAula(inicio);
    exigirIntervaloGrupo(inicio, fim);
    const capacidade = veio(dados, 'capacidade') ? capacidadeDe(dados.capacidade) : CAPACIDADE_PADRAO;
    const grupo = await this.agenda.prepararGrupo(em, { responsavel, inicio, fim, capacidade });
    if (!wrap(grupo).isManaged()) return grupo;
    let mudou = false;
    if (veio(dados, 'fim') && grupo.fim.getTime() !== fim.getTime()) {
      grupo.fim = fim;
      mudou = true;
    }
    if (veio(dados, 'capacidade') && grupo.capacidade !== capacidade) {
      grupo.capacidade = capacidade;
      mudou = true;
    }
    if (mudou) {
      if (grupo.inicio.getTime() <= agora.getTime() && veio(dados, 'fim')) {
        throw new ErroApi(409, 'AULA_JA_INICIOU', MENSAGEM_JA_INICIOU);
      }
      await this.agenda.assertGrupoConsistente(em, grupo);
    }
    return grupo;
  }

  private async resolverAluno(em: EntityManager, dados: Record<string, unknown>, experimental: boolean): Promise<Aluno> {
    const temporario = experimental && veio(dados, 'alunoTemporario') ? dados.alunoTemporario : null;
    if (temporario != null && !dados.alunoId) {
      return this.criarTemporario(em, temporario);
    }
    const aluno = await alunoAtivo(em, uuidDe(dados.alunoId, 'Aluno'));
    if (aluno.temporario && !experimental) {
      throw new ErroApi(400, 'DADOS_INVALIDOS', 'Aluno temporário só entra em aula experimental.');
    }
    return aluno;
  }

  private async criarTemporario(em: EntityManager, corpo: unknown): Promise<Aluno> {
    const dados = exigirObjeto(corpo);
    const aluno = new Aluno();
    aluno.nome = textoObrigatorio(dados.nome, 'o nome');
    aluno.telefone = telefoneOpcional(dados.telefone);
    aluno.email = null;
    aluno.plano = null;
    aluno.categoria = null;
    aluno.temporario = true;
    aluno.horarios = [];
    aluno.cadastradoEm = new Date();
    em.persist(aluno);
    return aluno;
  }

  private async montarReposicao(em: EntityManager, origem: Aula, corpo: unknown, agora: Date): Promise<Aula> {
    const dados = exigirObjeto(corpo);
    const aula = new Aula();
    if (!origem.aluno.ativo) throw new ErroApi(400, 'DADOS_INVALIDOS', 'Aluno inativo não recebe aula nova.');
    aula.aluno = origem.aluno;
    const grupo = await this.resolverGrupo(em, dados, agora);
    this.agenda.exigirDataAgenda(grupo.inicio, agora);
    await this.agenda.assertPodeEntrar(em, { alunoId: aula.aluno.id, grupo });
    aula.grupo = grupo;
    aula.status = 'AGUARDANDO';
    aula.experimental = false;
    aula.reposicaoDe = origem;
    aula.ligadaAoPlano = false;
    return aula;
  }
}
