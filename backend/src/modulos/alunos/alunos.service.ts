import { EntityManager, type FilterQuery } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import type { AlunoResposta } from '../../comum/contrato';
import { naoEncontrado, traduzirErroBanco } from '../../comum/erros';
import { serializarAluno } from '../../comum/serializar';
import {
  categoriaDe,
  emailOpcional,
  escaparLike,
  exigirObjeto,
  idRelacao,
  interpretarPlano,
  planoDe,
  planoMudou,
  responsavelAtivo,
  telefoneObrigatorio,
  textoObrigatorio,
  uuidDe,
  veio,
} from '../../comum/validacao';
import { AgendaService } from '../../dominio/agenda.service';
import { Aluno } from '../../entidades/aluno.entity';

@Injectable()
export class AlunosService {
  constructor(
    private readonly em: EntityManager,
    private readonly agenda: AgendaService,
  ) {}

  async listar(busca?: string): Promise<AlunoResposta[]> {
    const alunos = await this.em.find(Aluno, this.filtroBusca(busca), {
      orderBy: { nome: 'asc' },
      populate: ['responsavel'],
    });
    return alunos.map(serializarAluno);
  }

  async obter(id: string): Promise<AlunoResposta> {
    uuidDe(id, 'Identificador');
    const aluno = await this.em.findOne(Aluno, { id }, { populate: ['responsavel'] });
    if (!aluno || !aluno.ativo) throw naoEncontrado('Aluno não encontrado.');
    return serializarAluno(aluno);
  }

  async criar(corpo: unknown, agora = new Date()): Promise<AlunoResposta> {
    const dados = exigirObjeto(corpo);
    try {
      return await this.em.transactional(async (em) => {
        const aluno = new Aluno();
        aluno.nome = textoObrigatorio(dados.nome, 'o nome');
        aluno.telefone = telefoneObrigatorio(dados.telefone);
        aluno.email = emailOpcional(dados.email);
        aluno.plano = planoDe(dados.plano);
        aluno.categoria = categoriaDe(dados.categoria);
        aluno.cadastradoEm = new Date();
        const plano = interpretarPlano(veio(dados, 'diasSemana'), dados.diasSemana, veio(dados, 'horarioInicio'), dados.horarioInicio, veio(dados, 'responsavelId'), dados.responsavelId);
        aluno.diasSemana = plano.diasSemana;
        aluno.horarioInicio = plano.horarioInicio;
        aluno.responsavel = plano.responsavelId ? await responsavelAtivo(em, plano.responsavelId) : null;
        em.persist(aluno);
        if (plano.completo) await this.agenda.gerarOcorrencias(em, aluno, agora, 'recusar');
        await em.flush();
        return serializarAluno(aluno);
      });
    } catch (erro) {
      const traduzido = traduzirErroBanco(erro);
      if (traduzido) throw traduzido;
      throw erro;
    }
  }

  async atualizar(id: string, corpo: unknown, agora = new Date()): Promise<AlunoResposta> {
    uuidDe(id, 'Identificador');
    const dados = exigirObjeto(corpo);
    try {
      return await this.em.transactional(async (em) => {
        const aluno = await em.findOne(Aluno, { id }, { populate: ['responsavel'] });
        if (!aluno || !aluno.ativo) throw naoEncontrado('Aluno não encontrado.');
        if (veio(dados, 'nome')) aluno.nome = textoObrigatorio(dados.nome, 'o nome');
        if (veio(dados, 'telefone')) aluno.telefone = telefoneObrigatorio(dados.telefone);
        if (veio(dados, 'email')) aluno.email = emailOpcional(dados.email);
        if (veio(dados, 'plano')) aluno.plano = planoDe(dados.plano);
        if (veio(dados, 'categoria')) aluno.categoria = categoriaDe(dados.categoria);
        const antes = {
          diasSemana: [...aluno.diasSemana],
          horarioInicio: aluno.horarioInicio,
          responsavelId: idRelacao(aluno.responsavel),
        };
        const plano = interpretarPlano(
          veio(dados, 'diasSemana'),
          dados.diasSemana,
          veio(dados, 'horarioInicio'),
          dados.horarioInicio,
          veio(dados, 'responsavelId'),
          dados.responsavelId,
          antes,
        );
        if (planoMudou(antes, plano)) {
          aluno.diasSemana = plano.diasSemana;
          aluno.horarioInicio = plano.horarioInicio;
          aluno.responsavel = plano.responsavelId ? await responsavelAtivo(em, plano.responsavelId) : null;
          await this.agenda.removerAguardandoFuturas(em, aluno.id, agora, true);
          if (plano.completo) await this.agenda.gerarOcorrencias(em, aluno, agora, 'recusar');
        }
        await em.flush();
        return serializarAluno(aluno);
      });
    } catch (erro) {
      const traduzido = traduzirErroBanco(erro);
      if (traduzido) throw traduzido;
      throw erro;
    }
  }

  async inativar(id: string, agora = new Date()): Promise<AlunoResposta> {
    uuidDe(id, 'Identificador');
    return this.em.transactional(async (em) => {
      const aluno = await em.findOne(Aluno, { id }, { populate: ['responsavel'] });
      if (!aluno || !aluno.ativo) throw naoEncontrado('Aluno não encontrado.');
      await this.agenda.removerAguardandoFuturas(em, aluno.id, agora, false);
      aluno.ativo = false;
      await em.flush();
      return serializarAluno(aluno);
    });
  }

  private filtroBusca(busca?: string): FilterQuery<Aluno> {
    const termo = busca?.trim();
    if (!termo) return { ativo: true, temporario: false };
    const like = `%${escaparLike(termo)}%`;
    const digitos = termo.replace(/\D/g, '');
    const ou: FilterQuery<Aluno>[] = [{ nome: { $ilike: like } }, { email: { $ilike: like } }];
    if (digitos) ou.push({ telefone: { $ilike: `%${digitos}%` } });
    return { ativo: true, temporario: false, $or: ou };
  }
}
