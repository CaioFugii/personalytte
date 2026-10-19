import type { CategoriaAluno, FuncaoIntegrante, PlanoAluno, StatusAula, TipoEvento } from '../entidades/enums';
import type { DiaSemana } from './tempo';

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
  telefone: string;
  email: string | null;
  plano: PlanoAluno;
  categoria: CategoriaAluno;
  diasSemana: DiaSemana[];
  horarioInicio: string | null;
  responsavelId: string | null;
  ativo: boolean;
  cadastradoEm: string;
};

export type AulaResposta = {
  id: string;
  aluno: { id: string; nome: string; categoria: CategoriaAluno };
  responsavel: { id: string; nome: string };
  inicio: string;
  fim: string;
  status: StatusAula;
  experimental: boolean;
  reposicaoDeAulaId: string | null;
  ligadaAoPlano: boolean;
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
