import type { Aula, StatusAula } from '../api/types'
import { formatarHora } from './calendario'

const EMOJI: Partial<Record<StatusAula, string>> = {
  CONFIRMADA: '✅',
  FALTA: '❌',
}

function linhaDoAluno(aula: Aula): string {
  const nome = aula.experimental ? `${aula.aluno.nome} • Experimental` : aula.aluno.nome
  const emoji = EMOJI[aula.status]
  return emoji ? `${nome}${emoji}` : nome
}

/** Texto da agenda do dia, pronto para colar no WhatsApp. Aula cancelada não entra. */
export function textoAgendaDia(aulas: Aula[]): string {
  const ordenadas = [...aulas].sort((a, b) => {
    const diferenca = new Date(a.inicio).getTime() - new Date(b.inicio).getTime()
    if (diferenca !== 0) return diferenca
    return a.aluno.nome.localeCompare(b.aluno.nome, 'pt-BR')
  })
  const grupos: { horario: string; linhas: string[] }[] = []
  for (const aula of ordenadas) {
    if (aula.status === 'CANCELADA') continue
    const horario = `${formatarHora(aula.inicio)}-${formatarHora(aula.fim)}`
    const linha = linhaDoAluno(aula)
    const ultimo = grupos.at(-1)
    if (ultimo?.horario === horario) {
      ultimo.linhas.push(linha)
      continue
    }
    grupos.push({ horario, linhas: [linha] })
  }
  if (grupos.length === 0) return 'Nenhuma aula neste dia.'
  return grupos.map((grupo) => [grupo.horario, ...grupo.linhas].join('\n')).join('\n\n')
}
