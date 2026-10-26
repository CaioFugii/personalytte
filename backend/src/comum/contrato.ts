import type { CategoriaAluno, FuncaoIntegrante, PlanoAluno, StatusAula, TipoEvento } from '../entidades/enums';
import type { HorarioPlano } from './tempo';

export type IntegranteAtual = {
  id: string;
  nome: string;
  email: string;
  funcao: FuncaoIntegrante;
  papel: 'professor' | 'administrador';
  ativo: boolean;
};

export type IntegranteResposta = IntegranteAtual & {
  telefone: string | null;
  dataNascimento: string | null;
  cadastradoEm: string;
};

export type ResponsavelResposta = {
  id: string;
  nome: string;
  funcao: FuncaoIntegrante;
};

export type AlunoResposta = {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  instagram: string | null;
  dataNascimento: string | null;
  plano: PlanoAluno | null;
  categoria: CategoriaAluno | null;
  temporario: boolean;
  horarios: HorarioPlano[];
  responsavelId: string | null;
  ativo: boolean;
  cadastradoEm: string;
};

export type AulaResposta = {
  id: string;
  aluno: { id: string; nome: string; categoria: CategoriaAluno | null; telefone: string | null; temporario: boolean };
  responsavel: { id: string; nome: string };
  inicio: string;
  fim: string;
  status: StatusAula;
  experimental: boolean;
  reposicaoDeAulaId: string | null;
  ligadaAoPlano: boolean;
  cancelamento: { justificativa: string; geraReposicao: boolean } | null;
};

export type EventoResposta = {
  id: string;
  tipo: TipoEvento;
  nome: string;
  inicio: string;
  fim: string;
  contato: string | null;
  bloqueiaAulas: boolean;
  responsavelId: string | null;
};

export type AvisoResposta = {
  id: string;
  titulo: string;
  mensagem: string;
  criadoEm: string;
};
