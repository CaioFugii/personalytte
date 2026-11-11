import type { Aula, Evento } from '../api/types'
import { formatarDiaLongo, instanteBrasilia, partesSP } from './calendario'
import { categoriasPresentes } from './rotulos'

/** Inícios oferecidos: 07:00 às 22:00, sem a janela das 12:00 às 14:00. */
export const HORARIOS_OFERTA = [
  '07:00',
  '08:00',
  '09:00',
  '10:00',
  '11:00',
  '14:00',
  '15:00',
  '16:00',
  '17:00',
  '18:00',
  '19:00',
  '20:00',
  '21:00',
  '22:00',
] as const

const DURACAO_MS = 60 * 60 * 1000

export type LinhaOferta = { texto: string; professor: string | null; lotado?: boolean }

export type CelulaOferta = {
  tipo: 'vago' | 'vagas' | 'lotado' | 'ocupado' | 'fechado'
  linhas: LinhaOferta[]
}

function minutos(hora: string): number {
  const [horas, mins] = hora.slice(0, 5).split(':').map(Number)
  return horas * 60 + mins
}

function ocupaVaga(aula: Aula): boolean {
  return aula.status !== 'CANCELADA' && aula.status !== 'FALTA'
}

function limiteDoHorario(hora: string): number {
  return hora === '07:00' ? 6 : 4
}

function eventoCobre(evento: Evento, dia: string, hora: string): boolean {
  const inicio = new Date(instanteBrasilia(dia, hora)).getTime()
  const fim = inicio + DURACAO_MS
  return new Date(evento.inicio).getTime() < fim && new Date(evento.fim).getTime() > inicio
}

function nivelDoGrupo(categorias: Array<Aula['aluno']['categoria']>): string {
  return categoriasPresentes(categorias) ?? 'Sem categoria'
}

function rotuloVagas(categorias: Array<Aula['aluno']['categoria']>, vagas: number): string {
  const lugar = vagas === 1 ? '1 vaga' : `${vagas} vagas`
  return `${nivelDoGrupo(categorias)} · ${lugar}`
}

export function celulaOferta(dia: string, hora: string, aulas: Aula[], eventos: Evento[]): CelulaOferta {
  if (eventos.some((evento) => eventoCobre(evento, dia, hora))) {
    return { tipo: 'fechado', linhas: [{ texto: 'Agenda fechada', professor: null }] }
  }

  const doDia = aulas.filter((aula) => ocupaVaga(aula) && partesSP(aula.inicio).data === dia)
  const noHorario = doDia.filter((aula) => partesSP(aula.inicio).hora.slice(0, 5) === hora)
  const cruzando = doDia.some(
    (aula) => minutos(partesSP(aula.inicio).hora) !== minutos(hora) && Math.abs(minutos(partesSP(aula.inicio).hora) - minutos(hora)) < 60,
  )

  const porProfessor = new Map<string, Aula[]>()
  for (const aula of noHorario) {
    const lista = porProfessor.get(aula.responsavel.id) ?? []
    lista.push(aula)
    porProfessor.set(aula.responsavel.id, lista)
  }

  const abertas: LinhaOferta[] = []
  const lotadas: LinhaOferta[] = []
  for (const grupo of porProfessor.values()) {
    const categorias = grupo.map((aula) => aula.aluno.categoria)
    const professor = grupo[0].responsavel.nome
    const vagas = limiteDoHorario(hora) - grupo.length
    if (vagas <= 0) {
      lotadas.push({ texto: `${nivelDoGrupo(categorias)} · Lotado`, professor, lotado: true })
      continue
    }
    abertas.push({ texto: rotuloVagas(categorias, vagas), professor })
  }
  const porNome = (a: LinhaOferta, b: LinhaOferta) => (a.professor ?? '').localeCompare(b.professor ?? '', 'pt-BR')
  abertas.sort(porNome)
  lotadas.sort(porNome)

  if (abertas.length > 0) return { tipo: 'vagas', linhas: [...abertas, ...lotadas] }
  if (lotadas.length > 0) return { tipo: 'lotado', linhas: lotadas }
  if (cruzando) return { tipo: 'ocupado', linhas: [{ texto: 'Ocupado', professor: null }] }
  return { tipo: 'vago', linhas: [{ texto: 'Horário vago', professor: null }] }
}

/** Texto da semana, sem nome de aluno, pronto para colar no WhatsApp. */
export function textoOferta(dias: string[], aulas: Aula[], eventos: Evento[], intervalo: string): string {
  const blocos = dias.map((dia) => {
    const linhas = HORARIOS_OFERTA.flatMap((hora) => {
      const celula = celulaOferta(dia, hora, aulas, eventos)
      return celula.linhas.map((linha) => {
        const detalhe = linha.professor ? `${linha.texto} · ${linha.professor}` : linha.texto
        return `${hora} — ${detalhe}`
      })
    })
    return [formatarDiaLongo(dia), ...linhas].join('\n')
  })
  return ['Horários com vaga', intervalo, ...blocos].join('\n\n')
}
