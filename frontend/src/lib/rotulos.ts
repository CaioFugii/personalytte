import type { Categoria, DiaSemana, Funcao, Plano, StatusAula, TipoEvento } from '../api/types'

export const PLANOS: { value: Plano; label: string }[] = [
  { value: 'PARTICULAR', label: 'Particular' },
  { value: 'GYMPASS', label: 'Gympass' },
  { value: 'TOTALPASS', label: 'TotalPass' },
  { value: 'MENSAL', label: 'Mensal' },
]

export const CATEGORIAS: { value: Categoria; label: string }[] = [
  { value: 'INICIANTE', label: 'Iniciante' },
  { value: 'D', label: 'D' },
  { value: 'C', label: 'C' },
  { value: 'B', label: 'B' },
  { value: 'A', label: 'A' },
]

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

export function rotuloCategoria(categoria: Categoria | null | undefined): string {
  if (!categoria) return ''
  return CATEGORIAS.find((item) => item.value === categoria)?.label ?? categoria
}

export function rotuloCategoriaCurta(categoria: Categoria): string {
  return categoria === 'INICIANTE' ? 'Inic.' : rotuloCategoria(categoria)
}

/** Categorias presentes, sem repetir, na ordem Iniciante → A. */
export function categoriasPresentes(categorias: Array<Categoria | null | undefined>): string | null {
  const presentes = new Set(categorias.filter((item): item is Categoria => Boolean(item)))
  if (presentes.size === 0) return null
  return juntarLista(CATEGORIAS.filter((item) => presentes.has(item.value)).map((item) => item.label))
}

/** Categorias do grupo, da mais frequente para a menos. Empate segue Iniciante → A. */
export function resumoCategorias(categorias: Array<Categoria | null | undefined>): string | null {
  const contagem = new Map<Categoria, number>()
  for (const categoria of categorias) {
    if (!categoria) continue
    contagem.set(categoria, (contagem.get(categoria) ?? 0) + 1)
  }
  if (contagem.size === 0) return null
  const ordem = CATEGORIAS.map((item) => item.value)
  const lista = [...contagem.keys()].sort((a, b) => {
    const porQuantidade = (contagem.get(b) ?? 0) - (contagem.get(a) ?? 0)
    if (porQuantidade !== 0) return porQuantidade
    return ordem.indexOf(a) - ordem.indexOf(b)
  })
  return `Categorias: ${juntarLista(lista.map(rotuloCategoriaCurta))}`
}

function juntarLista(itens: string[]): string {
  if (itens.length <= 1) return itens[0] ?? ''
  if (itens.length === 2) return `${itens[0]} e ${itens[1]}`
  return `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`
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
