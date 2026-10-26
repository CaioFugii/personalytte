import { EntityManager } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import type { AulaResposta } from '../../comum/contrato';
import { ErroApi, MENSAGEM_JA_INICIOU, naoEncontrado, traduzirErroBanco } from '../../comum/erros';
import { serializarAula } from '../../comum/serializar';
import { alunoAtivo, booleanoDe, exigirIntervalo, exigirObjeto, instanteDe, responsavelAtivo, statusDe, telefoneOpcional, textoObrigatorio, uuidDe, veio } from '../../comum/validacao';
import { fimDaAula, jaComecou } from '../../comum/tempo';
import { AgendaService, LIMITE_GRUPO } from '../../dominio/agenda.service';
import { Aluno } from '../../entidades/aluno.entity';
import { Aula } from '../../entidades/aula.entity';

@Injectable()
export class AulasService {
  constructor(
    private readonly em: EntityManager,
    private readonly agenda: AgendaService,
  ) {}

  async listar(de: unknown, ate: unknown): Promise<AulaResposta[]> {
    const intervalo = exigirIntervalo(de, ate);
    const aulas = await this.em.find(Aula, { inicio: { $gte: intervalo.inicio, $lt: intervalo.fim } }, {
      populate: ['aluno', 'responsavel', 'reposicaoDe'],
      orderBy: { inicio: 'asc' },
    });
    return aulas.map(serializarAula);
  }

  async obter(id: string): Promise<AulaResposta> {
    return serializarAula(await this.carregar(this.em, id));
  }

  async criar(corpo: unknown, agora = new Date()): Promise<AulaResposta> {
    const dados = exigirObjeto(corpo);
    try {
      return await this.em.transactional(async (em) => {
        const aula = await this.montarAvulsa(em, dados, false);
        this.agenda.exigirDataAgenda(aula.inicio, agora);
        await this.agenda.assertPodeAgendar(em, {
          alunoId: aula.aluno.id,
          responsavelId: aula.responsavel.id,
          inicio: aula.inicio,
        });
        em.persist(aula);
        await em.flush();
        return serializarAula(aula);
      });
    } catch (erro) {
      const traduzido = traduzirErroBanco(erro);
      if (traduzido) throw traduzido;
      throw erro;
    }
  }

  async criarGrupo(corpo: unknown, agora = new Date()): Promise<AulaResposta[]> {
    const dados = exigirObjeto(corpo);
    if (!Array.isArray(dados.alunoIds) || dados.alunoIds.length === 0 || dados.alunoIds.length > LIMITE_GRUPO) {
      throw new ErroApi(400, 'DADOS_INVALIDOS', `Informe de 1 a ${LIMITE_GRUPO} alunos.`);
    }
    const alunoIds = dados.alunoIds.map((valor) => uuidDe(valor, 'Aluno'));
    if (new Set(alunoIds).size !== alunoIds.length) {
      throw new ErroApi(400, 'DADOS_INVALIDOS', 'O mesmo aluno foi informado mais de uma vez.');
    }
    try {
      return await this.em.transactional(async (em) => {
        const criadas: Aula[] = [];
        for (const alunoId of alunoIds) {
          const aula = await this.montarAvulsa(em, { ...dados, alunoId, alunoTemporario: null }, false);
          this.agenda.exigirDataAgenda(aula.inicio, agora);
          await this.agenda.assertPodeAgendar(em, {
            alunoId: aula.aluno.id,
            responsavelId: aula.responsavel.id,
            inicio: aula.inicio,
          });
          em.persist(aula);
          await em.flush();
          criadas.push(aula);
        }
        return criadas.map(serializarAula);
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
        if (veio(dados, 'inicio')) {
          const inicio = instanteDe(dados.inicio, 'O início');
          if (inicio.getTime() !== aula.inicio.getTime()) {
            if (jaComecou(aula.inicio, agora)) throw new ErroApi(409, 'AULA_JA_INICIOU', MENSAGEM_JA_INICIOU);
            aula.inicio = inicio;
            aula.fim = fimDaAula(inicio);
            aula.ligadaAoPlano = false;
            mudouAgenda = true;
          }
        }
        if (veio(dados, 'alunoId')) {
          const alunoId = uuidDe(dados.alunoId, 'Aluno');
          if (alunoId !== aula.aluno.id) {
            aula.aluno = await alunoAtivo(em, alunoId);
            aula.ligadaAoPlano = false;
            mudouAgenda = true;
          }
        }
        if (veio(dados, 'responsavelId')) {
          const responsavelId = uuidDe(dados.responsavelId, 'Responsável');
          if (responsavelId !== aula.responsavel.id) {
            aula.responsavel = await responsavelAtivo(em, responsavelId);
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
        if (voltouAOcupar) {
          aula.justificativaCancelamento = null;
          aula.cancelamentoGeraReposicao = null;
        }
        if ((mudouAgenda || voltouAOcupar) && aula.status !== 'CANCELADA') {
          await this.agenda.assertPodeAgendar(em, {
            alunoId: aula.aluno.id,
            responsavelId: aula.responsavel.id,
            inicio: aula.inicio,
            ignorarAulaId: aula.id,
          });
        }
        if (veio(dados, 'reposicao') && dados.reposicao != null) {
          await this.agendarReposicao(em, aula, dados.reposicao, agora);
        }
        await em.flush();
        return serializarAula(aula);
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
        await em.flush();
        if (dados.reposicao != null) await this.agendarReposicao(em, aula, dados.reposicao, agora);
        await em.flush();
        return serializarAula(aula);
      });
    } catch (erro) {
      const traduzido = traduzirErroBanco(erro);
      if (traduzido) throw traduzido;
      throw erro;
    }
  }

  private async agendarReposicao(em: EntityManager, origem: Aula, corpo: unknown, agora: Date): Promise<void> {
    const reposicao = await this.montarReposicao(em, origem, corpo);
    this.agenda.exigirDataAgenda(reposicao.inicio, agora);
    await this.agenda.assertPodeAgendar(em, {
      alunoId: reposicao.aluno.id,
      responsavelId: reposicao.responsavel.id,
      inicio: reposicao.inicio,
    });
    em.persist(reposicao);
  }

  private async carregar(em: EntityManager, id: string): Promise<Aula> {
    uuidDe(id, 'Identificador');
    const aula = await em.findOne(Aula, { id }, { populate: ['aluno', 'responsavel', 'reposicaoDe'] });
    if (!aula) throw naoEncontrado('Aula não encontrada.');
    return aula;
  }

  private async montarAvulsa(em: EntityManager, dados: Record<string, unknown>, reposicao: boolean): Promise<Aula> {
    const aula = new Aula();
    const experimental = reposicao ? false : (veio(dados, 'experimental') ? booleanoDe(dados.experimental, 'Experimental') : false);
    aula.aluno = await this.resolverAluno(em, dados, experimental);
    aula.responsavel = await responsavelAtivo(em, uuidDe(dados.responsavelId, 'Responsável'));
    aula.inicio = instanteDe(dados.inicio, 'O início');
    aula.fim = fimDaAula(aula.inicio);
    aula.status = 'AGUARDANDO';
    aula.experimental = experimental;
    aula.reposicaoDe = null;
    aula.ligadaAoPlano = false;
    return aula;
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
    aluno.responsavel = null;
    aluno.cadastradoEm = new Date();
    em.persist(aluno);
    return aluno;
  }

  private async montarReposicao(em: EntityManager, origem: Aula, corpo: unknown): Promise<Aula> {
    const dados = exigirObjeto(corpo);
    const aula = new Aula();
    if (!origem.aluno.ativo) throw new ErroApi(400, 'DADOS_INVALIDOS', 'Aluno inativo não recebe aula nova.');
    aula.aluno = origem.aluno;
    aula.responsavel = await responsavelAtivo(em, uuidDe(dados.responsavelId, 'Responsável'));
    aula.inicio = instanteDe(dados.inicio, 'O início');
    aula.fim = fimDaAula(aula.inicio);
    aula.status = 'AGUARDANDO';
    aula.experimental = false;
    aula.reposicaoDe = origem;
    aula.ligadaAoPlano = false;
    return aula;
  }
}
