import { EntityManager } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import type { AulaResposta } from '../../comum/contrato';
import { ErroApi, MENSAGEM_JA_INICIOU, naoEncontrado, traduzirErroBanco } from '../../comum/erros';
import { serializarAula } from '../../comum/serializar';
import { alunoAtivo, booleanoDe, exigirIntervalo, exigirObjeto, instanteDe, responsavelAtivo, statusDe, telefoneOpcional, textoObrigatorio, uuidDe, veio } from '../../comum/validacao';
import { fimDaAula, jaComecou } from '../../comum/tempo';
import { AgendaService } from '../../dominio/agenda.service';
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

  async criar(corpo: unknown): Promise<AulaResposta> {
    const dados = exigirObjeto(corpo);
    try {
      return await this.em.transactional(async (em) => {
        const aula = await this.montarAvulsa(em, dados, false);
        this.agenda.exigirDataAgenda(aula.inicio);
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

  async atualizar(id: string, corpo: unknown, agora = new Date()): Promise<AulaResposta> {
    uuidDe(id, 'Identificador');
    const dados = exigirObjeto(corpo);
    if (veio(dados, 'reposicao') && dados.status !== 'FALTA') {
      throw new ErroApi(400, 'DADOS_INVALIDOS', 'Reposição só pode ser criada ao marcar falta.');
    }
    try {
      return await this.em.transactional(async (em) => {
        const aula = await this.carregar(em, id);
        const statusAnterior = aula.status;
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
        if (veio(dados, 'experimental')) aula.experimental = booleanoDe(dados.experimental, 'Experimental');
        if (veio(dados, 'status')) aula.status = statusDe(dados.status);
        const voltouAOcupar = statusAnterior === 'CANCELADA' && aula.status !== 'CANCELADA';
        if ((mudouAgenda || voltouAOcupar) && aula.status !== 'CANCELADA') {
          await this.agenda.assertPodeAgendar(em, {
            alunoId: aula.aluno.id,
            responsavelId: aula.responsavel.id,
            inicio: aula.inicio,
            ignorarAulaId: aula.id,
          });
        }
        if (dados.status === 'FALTA' && veio(dados, 'reposicao') && dados.reposicao != null) {
          const reposicao = await this.montarReposicao(em, aula, dados.reposicao);
          await this.agenda.assertPodeAgendar(em, {
            alunoId: reposicao.aluno.id,
            responsavelId: reposicao.responsavel.id,
            inicio: reposicao.inicio,
          });
          em.persist(reposicao);
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

  async cancelar(id: string): Promise<AulaResposta> {
    return this.em.transactional(async (em) => {
      const aula = await this.carregar(em, id);
      aula.status = 'CANCELADA';
      await em.flush();
      return serializarAula(aula);
    });
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
    aluno.diasSemana = [];
    aluno.horarioInicio = null;
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
