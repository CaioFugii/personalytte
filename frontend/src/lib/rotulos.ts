import type { Categoria, DiaSemana, Funcao, Plano, StatusAula, TipoEvento } from '../api/types'

export const PLANOS: { value: Plano; label: string }[] = [
  { value: 'PARTICULAR', label: 'Particular' },
  { value: 'GYMPASS', label: 'Gympass' },
  { value: 'TOTALPASS', label: 'TotalPass' },
  { value: 'MENSAL', label: 'Mensal' },
]

export const CATEGORIAS: Categoria[] = ['D', 'C', 'B', 'A']

export const FUNCOES: { value: Funcao; label: string }[] = [
  { value: 'PROFESSOR', label: 'Professor(a)' },
  { value: 'SOCIO', label: 'Sócio' },
  { value: 'OUTROS', label: 'Outros' },
]

export const STATUS: { value: StatusAula; label: string }[] = [
  { value: 'AGUARDANDO', label: 'Aguardando' },
  { value: 'CONFIRMADA', label: 'Confirmada' },
  { value: 'FALTA', label: 'Falta' },
  { value: 'CANCELADA', label: 'Cancelada' },
]

export const TIPOS_EVENTO: { value: TipoEvento; label: string }[] = [
  { value: 'FERIADO', label: 'Feriado' },
  { value: 'AGENDA_FECHADA', label: 'Agenda fechada' },
  { value: 'AUSENCIA', label: 'Ausência de professor' },
  { value: 'ANIVERSARIO', label: 'Aniversário' },
  { value: 'TORNEIO', label: 'Torneio' },
]

export const DIAS: { value: DiaSemana; label: string }[] = [
  { value: 'seg', label: 'Segunda' },
  { value: 'ter', label: 'Terça' },
  { value: 'qua', label: 'Quarta' },
  { value: 'qui', label: 'Quinta' },
  { value: 'sex', label: 'Sexta' },
  { value: 'sab', label: 'Sábado' },
  { value: 'dom', label: 'Domingo' },
]

const ORDEM_DIAS: DiaSemana[] = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom']

export function rotuloPlano(plano: Plano): string {
  return PLANOS.find((item) => item.value === plano)?.label ?? plano
}

export function rotuloFuncao(funcao: Funcao): string {
  return FUNCOES.find((item) => item.value === funcao)?.label ?? funcao
}

export function rotuloStatus(status: StatusAula): string {
  return STATUS.find((item) => item.value === status)?.label ?? status
}

export function rotuloTipoEvento(tipo: TipoEvento): string {
  return TIPOS_EVENTO.find((item) => item.value === tipo)?.label ?? tipo
}

export function tipoBloqueia(tipo: TipoEvento): boolean {
  return tipo === 'FERIADO' || tipo === 'AGENDA_FECHADA'
}

export function ordenarDias(dias: DiaSemana[]): DiaSemana[] {
  return ORDEM_DIAS.filter((dia) => dias.includes(dia))
}
