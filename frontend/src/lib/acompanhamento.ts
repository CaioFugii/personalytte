import type { Aula } from '../api/types'

export type LinhaAcompanhamento = {
  alunoId: string
  nome: string
  temporario: boolean
  faltas: Aula[]
  confirmacoes: Aula[]
  cancelamentos: Aula[]
  reposicoes: Aula[]
}

export type VistaAcompanhamento = 'todas' | 'faltas' | 'confirmacoes' | 'cancelamentos' | 'reposicoes'

export function acompanharMes(aulas: Aula[]): LinhaAcompanhamento[] {
  const porAluno = new Map<string, LinhaAcompanhamento>()
  const ordenadas = [...aulas].sort((a, b) => {
    const diferenca = new Date(a.inicio).getTime() - new Date(b.inicio).getTime()
    if (diferenca !== 0) return diferenca
    return a.aluno.nome.localeCompare(b.aluno.nome, 'pt-BR')
  })
  for (const aula of ordenadas) {
    const falta = aula.status === 'FALTA'
    const confirmada = aula.status === 'CONFIRMADA'
    const cancelada = aula.status === 'CANCELADA'
    const reposicao = Boolean(aula.reposicaoDeAulaId)
    if (!falta && !confirmada && !cancelada && !reposicao) continue
    let linha = porAluno.get(aula.aluno.id)
    if (!linha) {
      linha = {
        alunoId: aula.aluno.id,
        nome: aula.aluno.nome,
        temporario: aula.aluno.temporario,
        faltas: [],
        confirmacoes: [],
        cancelamentos: [],
        reposicoes: [],
      }
      porAluno.set(aula.aluno.id, linha)
    }
    if (falta) linha.faltas.push(aula)
    if (confirmada) linha.confirmacoes.push(aula)
    if (cancelada) linha.cancelamentos.push(aula)
    if (reposicao) linha.reposicoes.push(aula)
  }
  return [...porAluno.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

export function filtrarVista(linhas: LinhaAcompanhamento[], vista: VistaAcompanhamento): LinhaAcompanhamento[] {
  if (vista === 'todas') return linhas
  return linhas.filter((linha) => linha[vista].length > 0)
}

export function totaisDoMes(linhas: LinhaAcompanhamento[]) {
  return {
    faltas: linhas.reduce((total, linha) => total + linha.faltas.length, 0),
    confirmacoes: linhas.reduce((total, linha) => total + linha.confirmacoes.length, 0),
    cancelamentos: linhas.reduce((total, linha) => total + linha.cancelamentos.length, 0),
    reposicoes: linhas.reduce((total, linha) => total + linha.reposicoes.length, 0),
  }
}
