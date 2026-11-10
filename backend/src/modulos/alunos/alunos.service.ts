import { EntityManager, type FilterQuery } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import type { AlunoResposta } from '../../comum/contrato';
import { dadosInvalidos, naoEncontrado, traduzirErroBanco } from '../../comum/erros';
import { serializarAluno } from '../../comum/serializar';
import {
  categoriaDe,
  dataOpcional,
  generoDe,
  emailOpcional,
  instagramOpcional,
  escaparLike,
  exigirObjeto,
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
import { contarReposicoesDisponiveis } from '../../dominio/reposicao';
import { Aluno } from '../../entidades/aluno.entity';

@Injectable()
export class AlunosService {
  constructor(
    private readonly em: EntityManager,
    private readonly agenda: AgendaService,
  ) {}

  async listar(busca?: string, incluirInativos = false): Promise<AlunoResposta[]> {
    const alunos = await this.em.find(Aluno, this.filtroBusca(busca, incluirInativos), {
      orderBy: incluirInativos ? { ativo: 'desc', nome: 'asc' } : { nome: 'asc' },
    });
    return this.responder(this.em, alunos);
  }

  async obter(id: string): Promise<AlunoResposta> {
    uuidDe(id, 'Identificador');
    const aluno = await this.em.findOne(Aluno, { id });
    if (!aluno) throw naoEncontrado('Aluno não encontrado.');
    return (await this.responder(this.em, [aluno]))[0];
  }

  async criar(corpo: unknown, agora = new Date()): Promise<AlunoResposta> {
    const dados = exigirObjeto(corpo);
    try {
      return await this.em.transactional(async (em) => {
        const aluno = new Aluno();
        aluno.nome = textoObrigatorio(dados.nome, 'o nome');
        aluno.telefone = telefoneObrigatorio(dados.telefone);
        aluno.email = emailOpcional(dados.email);
        aluno.instagram = instagramOpcional(dados.instagram);
        aluno.dataNascimento = dataOpcional(dados.dataNascimento, 'Data de nascimento');
        aluno.plano = planoDe(dados.plano);
        aluno.categoria = categoriaDe(dados.categoria);
        aluno.genero = generoDe(dados.genero);
        aluno.cadastradoEm = new Date();
        const plano = interpretarPlano(veio(dados, 'horarios'), dados.horarios);
        aluno.horarios = plano.horarios;
        for (const id of new Set(plano.horarios.map((horario) => horario.responsavelId))) {
          await responsavelAtivo(em, id);
        }
        em.persist(aluno);
        if (plano.completo) await this.agenda.gerarOcorrencias(em, aluno, agora, 'recusar');
        await em.flush();
        return (await this.responder(em, [aluno]))[0];
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
        const aluno = await em.findOne(Aluno, { id });
        if (!aluno || !aluno.ativo) throw naoEncontrado('Aluno não encontrado.');
        if (veio(dados, 'nome')) aluno.nome = textoObrigatorio(dados.nome, 'o nome');
        if (veio(dados, 'telefone')) aluno.telefone = telefoneObrigatorio(dados.telefone);
        if (veio(dados, 'email')) aluno.email = emailOpcional(dados.email);
        if (veio(dados, 'instagram')) aluno.instagram = instagramOpcional(dados.instagram);
        if (veio(dados, 'dataNascimento')) aluno.dataNascimento = dataOpcional(dados.dataNascimento, 'Data de nascimento');
        if (veio(dados, 'plano')) aluno.plano = planoDe(dados.plano);
        if (veio(dados, 'categoria')) aluno.categoria = categoriaDe(dados.categoria);
        if (veio(dados, 'genero')) aluno.genero = generoDe(dados.genero);
        const antes = aluno.horarios.map((horario) => ({ ...horario }));
        const plano = interpretarPlano(veio(dados, 'horarios'), dados.horarios, antes);
        if (planoMudou(antes, plano.horarios)) {
          aluno.horarios = plano.horarios;
          for (const id of new Set(plano.horarios.map((horario) => horario.responsavelId))) {
            await responsavelAtivo(em, id);
          }
          aluno.planoSuspenso = false;
          await this.agenda.removerAguardandoFuturas(em, aluno.id, agora, true);
          if (plano.completo) await this.agenda.gerarOcorrencias(em, aluno, agora, 'recusar');
        }
        await em.flush();
        return (await this.responder(em, [aluno]))[0];
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
      const aluno = await em.findOne(Aluno, { id });
      if (!aluno || !aluno.ativo) throw naoEncontrado('Aluno não encontrado.');
      await this.agenda.removerAguardandoFuturas(em, aluno.id, agora, false);
      aluno.ativo = false;
      aluno.planoSuspenso = true;
      await em.flush();
      return (await this.responder(em, [aluno]))[0];
    });
  }

  async reativar(id: string): Promise<AlunoResposta> {
    uuidDe(id, 'Identificador');
    return this.em.transactional(async (em) => {
      const aluno = await em.findOne(Aluno, { id });
      if (!aluno || aluno.temporario) throw naoEncontrado('Aluno não encontrado.');
      if (aluno.ativo) throw dadosInvalidos('Aluno já está ativo.');
      aluno.ativo = true;
      aluno.planoSuspenso = true;
      await em.flush();
      return (await this.responder(em, [aluno]))[0];
    });
  }

  private async responder(em: EntityManager, alunos: Aluno[]): Promise<AlunoResposta[]> {
    const contagem = await contarReposicoesDisponiveis(em, alunos.map((aluno) => aluno.id));
    return alunos.map((aluno) => serializarAluno(aluno, contagem.get(aluno.id) ?? 0));
  }

  private filtroBusca(busca?: string, incluirInativos = false): FilterQuery<Aluno> {
    const termo = busca?.trim();
    const base: FilterQuery<Aluno> = incluirInativos
      ? { temporario: false }
      : { ativo: true, temporario: false };
    if (!termo) return base;
    const like = `%${escaparLike(termo)}%`;
    const likeInstagram = `%${escaparLike(termo.replace(/^@+/, ''))}%`;
    const digitos = termo.replace(/\D/g, '');
    const ou: FilterQuery<Aluno>[] = [
      { nome: { $ilike: like } },
      { email: { $ilike: like } },
      { instagram: { $ilike: likeInstagram } },
    ];
    if (digitos) ou.push({ telefone: { $ilike: `%${digitos}%` } });
    return { ...base, $or: ou };
  }
}
