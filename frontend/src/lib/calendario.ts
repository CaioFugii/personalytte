const FUSO = 'America/Sao_Paulo'

export function hojeSP(agora = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(agora)
}

export function civilValida(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false
  const [ano, mes, dia] = valor.split('-').map(Number)
  const data = new Date(Date.UTC(ano, mes - 1, dia))
  return data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia
}

export function addDias(iso: string, dias: number): string {
  const [ano, mes, dia] = iso.split('-').map(Number)
  const data = new Date(Date.UTC(ano, mes - 1, dia))
  data.setUTCDate(data.getUTCDate() + dias)
  const y = data.getUTCFullYear()
  const m = String(data.getUTCMonth() + 1).padStart(2, '0')
  const d = String(data.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Semana civil de segunda a domingo. */
export function inicioDaSemana(iso: string): string {
  const [ano, mes, dia] = iso.split('-').map(Number)
  const dow = new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay()
  const desdeSegunda = dow === 0 ? 6 : dow - 1
  return addDias(iso, -desdeSegunda)
}

export function diasDaSemana(iso: string): string[] {
  const segunda = inicioDaSemana(iso)
  return Array.from({ length: 7 }, (_, indice) => addDias(segunda, indice))
}

export function instanteCivil(isoDate: string): Date {
  return new Date(`${isoDate}T12:00:00-03:00`)
}

export function partesSP(iso: string): { data: string; hora: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso))
  const pegar = (tipo: Intl.DateTimeFormatPartTypes) => parts.find((parte) => parte.type === tipo)?.value ?? ''
  let hora = pegar('hour')
  if (hora === '24') hora = '00'
  return {
    data: `${pegar('year')}-${pegar('month')}-${pegar('day')}`,
    hora: `${hora.padStart(2, '0')}:${pegar('minute').padStart(2, '0')}`,
  }
}

function offsetSP(data: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: FUSO,
    timeZoneName: 'longOffset',
  }).formatToParts(data)
  const nome = parts.find((parte) => parte.type === 'timeZoneName')?.value ?? ''
  const match = nome.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/)
  if (!match) return '-03:00'
  return `${match[1]}${match[2].padStart(2, '0')}:${(match[3] ?? '00').padStart(2, '0')}`
}

/** Data e hora civis de Brasília, sem passar pelo fuso do computador. */
export function instanteBrasilia(data: string, hora: string): string {
  const hhmm = /^\d{2}:\d{2}$/.test(hora) ? `${hora}:00` : hora
  const meioDia = new Date(`${data}T12:00:00-03:00`)
  const offset = Number.isNaN(meioDia.getTime()) ? '-03:00' : offsetSP(meioDia)
  return `${data}T${hhmm}${offset}`
}

export function aulaJaComecou(inicio: string, agora = new Date()): boolean {
  return new Date(inicio).getTime() <= agora.getTime()
}

export function formatarDataCivil(iso: string): string {
  const [ano, mes, dia] = iso.split('-')
  if (!ano || !mes || !dia) return '—'
  return `${dia}/${mes}/${ano}`
}

export function formatarHora(iso: string): string {
  return partesSP(iso).hora
}

export function formatarCadastro(valor: string | null | undefined): string {
  if (!valor) return '—'
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return formatarDataCivil(valor)
  const data = new Date(valor)
  if (Number.isNaN(data.getTime())) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(data)
}

export function formatarDiaLongo(iso: string): string {
  const texto = new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(instanteCivil(iso))
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

export function formatarDiaCurto(iso: string): string {
  const texto = new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO,
    weekday: 'short',
  })
    .format(instanteCivil(iso))
    .replace('.', '')
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

export function formatarIntervaloSemana(segunda: string): string {
  const domingo = addDias(segunda, 6)
  const inicio = instanteCivil(segunda)
  const fim = instanteCivil(domingo)
  const mesmoMes = segunda.slice(0, 7) === domingo.slice(0, 7)
  const dia = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, day: 'numeric' })
  const diaMes = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, day: 'numeric', month: 'long' })
  const completo = new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  if (mesmoMes) return `${dia.format(inicio)} a ${completo.format(fim)}`
  if (segunda.slice(0, 4) === domingo.slice(0, 4)) return `${diaMes.format(inicio)} a ${completo.format(fim)}`
  return `${completo.format(inicio)} a ${completo.format(fim)}`
}

export function formatarIntervalo(inicioIso: string, fimIso: string): string {
  const inicio = partesSP(inicioIso)
  const fim = partesSP(fimIso)
  if (inicio.data === fim.data) return `${formatarDataCivil(inicio.data)}, ${inicio.hora}–${fim.hora}`
  return `${formatarDataCivil(inicio.data)} ${inicio.hora} – ${formatarDataCivil(fim.data)} ${fim.hora}`
}

export function eventoCruzaDia(inicio: string, fim: string, dia: string): boolean {
  const inicioMs = new Date(inicio).getTime()
  const fimMs = new Date(fim).getTime()
  const dia0 = new Date(`${dia}T00:00:00-03:00`).getTime()
  const dia1 = new Date(`${addDias(dia, 1)}T00:00:00-03:00`).getTime()
  return inicioMs < dia1 && fimMs > dia0
}

export function cobreDiaInteiro(inicio: string, fim: string, dia: string): boolean {
  const inicioMs = new Date(inicio).getTime()
  const fimMs = new Date(fim).getTime()
  const dia0 = new Date(`${dia}T00:00:00-03:00`).getTime()
  const dia1 = new Date(`${addDias(dia, 1)}T00:00:00-03:00`).getTime()
  return inicioMs <= dia0 && fimMs >= dia1
}

export function saudacao(agora = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: FUSO,
    hour: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(agora)
  let hora = Number(parts.find((parte) => parte.type === 'hour')?.value ?? '0')
  if (hora === 24) hora = 0
  if (hora < 12) return 'Bom dia'
  if (hora < 18) return 'Boa tarde'
  return 'Boa noite'
}

export function digitosTelefone(valor: string): string {
  return valor.replace(/\D/g, '').slice(0, 11)
}

export function formatarTelefone(valor: string | null | undefined): string {
  if (!valor) return '—'
  const digitos = valor.replace(/\D/g, '')
  if (digitos.length === 11) return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`
  if (digitos.length === 10) return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`
  return valor
}

export function horaCurta(valor: string | null | undefined): string {
  if (!valor) return ''
  return valor.slice(0, 5)
}
