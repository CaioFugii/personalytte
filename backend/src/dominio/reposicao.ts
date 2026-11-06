import type { EntityManager } from '@mikro-orm/core';
import type { AulaResposta } from '../comum/contrato';
import { serializarAula } from '../comum/serializar';
import { idRelacao } from '../comum/validacao';
import { Aula } from '../entidades/aula.entity';

export function origemConcedeReposicao(aula: Pick<Aula, 'status' | 'cancelamentoGeraReposicao'>): boolean {
  return aula.status === 'FALTA' || (aula.status === 'CANCELADA' && aula.cancelamentoGeraReposicao === true);
}

export async function reposicoesEmAberto(em: EntityManager, origemIds: string[]): Promise<Map<string, string>> {
  const mapa = new Map<string, string>();
  if (origemIds.length === 0) return mapa;
  const abertas = await em.find(Aula, {
    reposicaoDe: { $in: origemIds },
    status: { $ne: 'CANCELADA' },
  }, { populate: ['reposicaoDe'] });
  for (const aula of abertas) {
    const origemId = idRelacao(aula.reposicaoDe);
    if (origemId && !mapa.has(origemId)) mapa.set(origemId, aula.id);
  }
  return mapa;
}

export async function contarReposicoesDisponiveis(em: EntityManager, alunoIds: string[]): Promise<Map<string, number>> {
  const contagem = new Map(alunoIds.map((id) => [id, 0]));
  if (alunoIds.length === 0) return contagem;
  const origens = await em.find(Aula, {
    aluno: { $in: alunoIds },
    $or: [
      { status: 'FALTA' },
      { status: 'CANCELADA', cancelamentoGeraReposicao: true },
    ],
  }, { populate: ['aluno'] });
  const abertas = await reposicoesEmAberto(em, origens.map((origem) => origem.id));
  for (const origem of origens) {
    if (abertas.has(origem.id)) continue;
    const alunoId = origem.aluno.id;
    contagem.set(alunoId, (contagem.get(alunoId) ?? 0) + 1);
  }
  return contagem;
}

export async function responderAulas(em: EntityManager, aulas: Aula[]): Promise<AulaResposta[]> {
  const agendadas = await reposicoesEmAberto(em, aulas.map((aula) => aula.id));
  const disponiveis = await contarReposicoesDisponiveis(em, [...new Set(aulas.map((aula) => aula.aluno.id))]);
  return aulas.map((aula) => serializarAula(aula, {
    reposicaoAgendadaId: agendadas.get(aula.id) ?? null,
    reposicoesDisponiveis: disponiveis.get(aula.aluno.id) ?? 0,
  }));
}
