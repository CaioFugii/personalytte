export const FUNCOES = ['PROFESSOR', 'SOCIO', 'OUTROS'] as const;
export type FuncaoIntegrante = (typeof FUNCOES)[number];

export const PLANOS = ['PARTICULAR', 'GYMPASS', 'MENSAL'] as const;
export type PlanoAluno = (typeof PLANOS)[number];

export const CATEGORIAS = ['D', 'C', 'B', 'A'] as const;
export type CategoriaAluno = (typeof CATEGORIAS)[number];

export const STATUS_AULA = ['AGUARDANDO', 'CONFIRMADA', 'FALTA', 'CANCELADA'] as const;
export type StatusAula = (typeof STATUS_AULA)[number];

export const TIPOS_EVENTO = ['FERIADO', 'AGENDA_FECHADA', 'AUSENCIA', 'ANIVERSARIO', 'TORNEIO'] as const;
export type TipoEvento = (typeof TIPOS_EVENTO)[number];

export function papelDe(funcao: FuncaoIntegrante): 'professor' | 'administrador' {
  return funcao === 'SOCIO' ? 'administrador' : 'professor';
}
