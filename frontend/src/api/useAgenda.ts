import { useEffect, useRef, useState } from 'react'
import type { Aula, Evento, Responsavel } from './types'
import { abortou, api, ErroApi, mensagemDeErro } from './client'

type EstadoAgenda = {
  aulas: Aula[]
  eventos: Evento[]
  nomes: Map<string, string>
  erro: string | null
  carregando: boolean
}

function ordenarAulas(aulas: Aula[]): Aula[] {
  return [...aulas].sort((a, b) => {
    const diferenca = new Date(a.inicio).getTime() - new Date(b.inicio).getTime()
    if (diferenca !== 0) return diferenca
    return a.aluno.nome.localeCompare(b.aluno.nome, 'pt-BR')
  })
}

export function useAgenda(de: string, ate: string) {
  const [tick, setTick] = useState(0)
  const [estado, setEstado] = useState<EstadoAgenda>({
    aulas: [],
    eventos: [],
    nomes: new Map(),
    erro: null,
    carregando: true,
  })
  const intervaloVisto = useRef(`${de}|${ate}`)
  if (intervaloVisto.current !== `${de}|${ate}`) {
    intervaloVisto.current = `${de}|${ate}`
    setEstado({ aulas: [], eventos: [], nomes: new Map(), erro: null, carregando: true })
  }

  useEffect(() => {
    const ctrl = new AbortController()
    setEstado((atual) => ({ ...atual, carregando: true, erro: null }))
    Promise.all([
      api<unknown>(`/api/aulas?de=${de}&ate=${ate}`, { signal: ctrl.signal }),
      api<unknown>(`/api/eventos?de=${de}&ate=${ate}`, { signal: ctrl.signal }),
      api<Responsavel[]>('/api/integrantes/responsaveis', { signal: ctrl.signal }).catch((erro: unknown) => {
        if (abortou(erro)) throw erro
        return [] as Responsavel[]
      }),
    ])
      .then(([aulas, eventos, responsaveis]) => {
        if (!Array.isArray(aulas) || !Array.isArray(eventos) || !Array.isArray(responsaveis)) {
          throw new ErroApi(500, 'DADOS_INVALIDOS', 'A resposta da agenda veio em um formato inesperado.')
        }
        const nomes = new Map<string, string>()
        for (const pessoa of responsaveis) {
          if (pessoa && typeof pessoa.id === 'string' && typeof pessoa.nome === 'string') {
            nomes.set(pessoa.id, pessoa.nome)
          }
        }
        if (ctrl.signal.aborted) return
        setEstado({
          aulas: ordenarAulas(aulas as Aula[]),
          eventos: [...(eventos as Evento[])].sort(
            (a, b) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime(),
          ),
          nomes,
          erro: null,
          carregando: false,
        })
      })
      .catch((erro: unknown) => {
        if (abortou(erro) || ctrl.signal.aborted) return
        setEstado({
          aulas: [],
          eventos: [],
          nomes: new Map(),
          erro: mensagemDeErro(erro),
          carregando: false,
        })
      })
    return () => ctrl.abort()
  }, [de, ate, tick])

  return { ...estado, recarregar: () => setTick((n) => n + 1) }
}
