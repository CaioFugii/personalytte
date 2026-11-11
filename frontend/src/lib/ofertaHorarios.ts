import type { Aula, Evento, Grupo } from '../api/types'
import { formatarDiaLongo, instanteBrasilia, partesSP } from './calendario'
import { categoriasPresentes } from './rotulos'

/** Inícios oferecidos: 07:00 às 21:00, sem a janela das 12:00 às 14:00. */
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
] as const

const DURACAO_MS = 60 * 60 * 1000

export type LinhaOferta = { texto: string; professor: string | null; lotado?: boolean }

export type CelulaOferta = {
  tipo: 'vago' | 'vagas' | 'lotado' | 'ocupado' | 'fechado'
  linhas: LinhaOferta[]
}

function ocupaVaga(aula: Aula): boolean {
  return aula.status !== 'CANCELADA' && aula.status !== 'FALTA'
}

function eventoCobre(evento: Evento, dia: string, hora: string): boolean {
  const inicio = new Date(instanteBrasilia(dia, hora)).getTime()
  const fim = inicio + DURACAO_MS
  return new Date(evento.inicio).getTime() < fim && new Date(evento.fim).getTime() > inicio
}

function grupoCobre(grupo: Grupo, dia: string, hora: string): boolean {
  const inicio = new Date(instanteBrasilia(dia, hora)).getTime()
  const fim = inicio + DURACAO_MS
  return new Date(grupo.inicio).getTime() < fim && new Date(grupo.fim).getTime() > inicio
}

function comecaNaHora(grupo: Grupo, dia: string, hora: string): boolean {
  const partes = partesSP(grupo.inicio)
  return partes.data === dia && partes.hora.slice(0, 5) === hora
}

function nivelDoGrupo(categorias: Array<Aula['aluno']['categoria']>): string {
  return categoriasPresentes(categorias) ?? 'Sem categoria'
}

function rotuloVagas(categorias: Array<Aula['aluno']['categoria']>, vagas: number): string {
  const lugar = vagas === 1 ? '1 vaga' : `${vagas} vagas`
  return `${nivelDoGrupo(categorias)} · ${lugar}`
}

export function celulaOferta(dia: string, hora: string, grupos: Grupo[], eventos: Evento[]): CelulaOferta {
  if (eventos.some((evento) => eventoCobre(evento, dia, hora))) {
    return { tipo: 'fechado', linhas: [{ texto: 'Agenda fechada', professor: null }] }
  }

  const cobrindo = grupos.filter((grupo) => grupo.aulas.some(ocupaVaga) && grupoCobre(grupo, dia, hora))
  const noHorario = cobrindo.filter((grupo) => comecaNaHora(grupo, dia, hora))
  const cruzando = cobrindo.some((grupo) => !comecaNaHora(grupo, dia, hora))

  const abertas: LinhaOferta[] = []
  const lotadas: LinhaOferta[] = []
  for (const grupo of noHorario) {
    const ocupando = grupo.aulas.filter(ocupaVaga)
    const categorias = ocupando.map((aula) => aula.aluno.categoria)
    const vagas = grupo.capacidade - ocupando.length
    if (vagas <= 0) {
      lotadas.push({ texto: `${nivelDoGrupo(categorias)} · Lotado`, professor: grupo.responsavel.nome, lotado: true })
      continue
    }
    abertas.push({ texto: rotuloVagas(categorias, vagas), professor: grupo.responsavel.nome })
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
export function textoOferta(dias: string[], grupos: Grupo[], eventos: Evento[], intervalo: string): string {
  const blocos = dias.map((dia) => {
    const linhas = HORARIOS_OFERTA.flatMap((hora) => {
      const celula = celulaOferta(dia, hora, grupos, eventos)
      return celula.linhas.map((linha) => {
        const detalhe = linha.professor ? `${linha.texto} · ${linha.professor}` : linha.texto
        return `${hora} — ${detalhe}`
      })
    })
    return [formatarDiaLongo(dia), ...linhas].join('\n')
  })
  return ['Horários com vaga', intervalo, ...blocos].join('\n\n')
}
