import { EntityManager, type FilterQuery } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import bcrypt from 'bcrypt';
import type { IntegranteResposta, ResponsavelResposta } from '../../comum/contrato';
import { ErroApi, MENSAGEM_AGENDA, MENSAGEM_ULTIMO, MENSAGEM_ULTIMO_FUNCAO, naoEncontrado, traduzirErroBanco } from '../../comum/erros';
import { serializarIntegrante, serializarResponsavel } from '../../comum/serializar';
import {
  dataOpcional,
  emailObrigatorio,
  escaparLike,
  exigirObjeto,
  funcaoDe,
  senhaObrigatoria,
  telefoneOpcional,
  textoObrigatorio,
  uuidDe,
  veio,
} from '../../comum/validacao';
import { Aluno } from '../../entidades/aluno.entity';
import { Aula } from '../../entidades/aula.entity';
import { Integrante } from '../../entidades/integrante.entity';

const RODADAS = 10;

@Injectable()
export class IntegrantesService {
  constructor(private readonly em: EntityManager) {}

  async listar(busca?: string): Promise<IntegranteResposta[]> {
    const integrantes = await this.em.find(Integrante, this.filtroBusca(busca), { orderBy: { nome: 'asc' } });
    return integrantes.map(serializarIntegrante);
  }

  async listarResponsaveis(): Promise<ResponsavelResposta[]> {
    const integrantes = await this.em.find(Integrante, { ativo: true }, { orderBy: { nome: 'asc' } });
    return integrantes.map(serializarResponsavel);
  }

  async criar(corpo: unknown): Promise<IntegranteResposta> {
    const dados = exigirObjeto(corpo);
    const integrante = new Integrante();
    integrante.nome = textoObrigatorio(dados.nome, 'o nome');
    integrante.email = emailObrigatorio(dados.email);
    integrante.senhaHash = await bcrypt.hash(senhaObrigatoria(dados.senha), RODADAS);
    integrante.funcao = funcaoDe(dados.funcao);
    integrante.telefone = telefoneOpcional(dados.telefone);
    integrante.dataNascimento = dataOpcional(dados.dataNascimento, 'Data de nascimento');
    integrante.cadastradoEm = new Date();
    try {
      await this.em.transactional(async (em) => {
        const existente = await em.findOne(Integrante, { email: integrante.email });
        if (existente) throw new ErroApi(400, 'DADOS_INVALIDOS', 'E-mail já cadastrado.');
        em.persist(integrante);
        await em.flush();
      });
    } catch (erro) {
      const traduzido = traduzirErroBanco(erro);
      if (traduzido) throw traduzido;
      throw erro;
    }
    return serializarIntegrante(integrante);
  }

  async atualizar(id: string, corpo: unknown): Promise<IntegranteResposta> {
    uuidDe(id, 'Identificador');
    const dados = exigirObjeto(corpo);
    try {
      return await this.em.transactional(async (em) => {
        const integrante = await em.findOne(Integrante, { id });
        if (!integrante || !integrante.ativo) throw naoEncontrado();
        if (veio(dados, 'nome')) integrante.nome = textoObrigatorio(dados.nome, 'o nome');
        if (veio(dados, 'email')) {
          const email = emailObrigatorio(dados.email);
          const outro = await em.findOne(Integrante, { email, id: { $ne: integrante.id } });
          if (outro) throw new ErroApi(400, 'DADOS_INVALIDOS', 'E-mail já cadastrado.');
          integrante.email = email;
        }
        if (veio(dados, 'telefone')) integrante.telefone = telefoneOpcional(dados.telefone);
        if (veio(dados, 'dataNascimento')) integrante.dataNascimento = dataOpcional(dados.dataNascimento, 'Data de nascimento');
        if (veio(dados, 'funcao')) {
          const funcao = funcaoDe(dados.funcao);
          if (integrante.funcao === 'SOCIO' && funcao !== 'SOCIO') {
            await this.assertNaoEhUltimo(em, integrante.id, MENSAGEM_ULTIMO_FUNCAO);
          }
          integrante.funcao = funcao;
        }
        if (veio(dados, 'senha') && dados.senha != null) {
          integrante.senhaHash = await bcrypt.hash(senhaObrigatoria(dados.senha), RODADAS);
          integrante.versaoSessao += 1;
        }
        await em.flush();
        return serializarIntegrante(integrante);
      });
    } catch (erro) {
      const traduzido = traduzirErroBanco(erro);
      if (traduzido) throw traduzido;
      throw erro;
    }
  }

  async inativar(id: string, agora = new Date()): Promise<IntegranteResposta> {
    uuidDe(id, 'Identificador');
    return this.em.transactional(async (em) => {
      const integrante = await em.findOne(Integrante, { id });
      if (!integrante || !integrante.ativo) throw naoEncontrado();
      const alunos = await em.find(Aluno, { ativo: true, responsavel: integrante.id });
      if (alunos.some((aluno) => aluno.diasSemana.length > 0 && aluno.horarioInicio)) {
        throw new ErroApi(409, 'INTEGRANTE_COM_AGENDA', MENSAGEM_AGENDA);
      }
      const aulaFutura = await em.findOne(Aula, {
        responsavel: integrante.id,
        status: { $ne: 'CANCELADA' },
        inicio: { $gt: agora },
      });
      if (aulaFutura) throw new ErroApi(409, 'INTEGRANTE_COM_AGENDA', MENSAGEM_AGENDA);
      if (integrante.funcao === 'SOCIO') await this.assertNaoEhUltimo(em, integrante.id, MENSAGEM_ULTIMO);
      integrante.ativo = false;
      integrante.versaoSessao += 1;
      await em.flush();
      return serializarIntegrante(integrante);
    });
  }

  private filtroBusca(busca?: string): FilterQuery<Integrante> {
    const termo = busca?.trim();
    if (!termo) return { ativo: true };
    const like = `%${escaparLike(termo)}%`;
    const digitos = termo.replace(/\D/g, '');
    const ou: FilterQuery<Integrante>[] = [{ nome: { $ilike: like } }, { email: { $ilike: like } }];
    if (digitos) ou.push({ telefone: { $ilike: `%${digitos}%` } });
    return { ativo: true, $or: ou };
  }

  private async assertNaoEhUltimo(em: EntityManager, id: string, mensagem: string): Promise<void> {
    const outros = await em.count(Integrante, { funcao: 'SOCIO', ativo: true, id: { $ne: id } });
    if (outros === 0) throw new ErroApi(409, 'ULTIMO_ADMINISTRADOR', mensagem);
  }
}
