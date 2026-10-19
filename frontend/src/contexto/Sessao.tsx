import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { abortou, api } from '../api/client'
import type { IntegranteAtual } from '../api/types'

type SessaoValor = {
  usuario: IntegranteAtual | null
  carregando: boolean
  entrar: (email: string, senha: string) => Promise<void>
  sair: () => Promise<void>
  definirUsuario: (usuario: IntegranteAtual | null) => void
}

const SessaoContexto = createContext<SessaoValor | null>(null)

export function SessaoProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<IntegranteAtual | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    const ctrl = new AbortController()
    api<IntegranteAtual>('/api/sessao/atual', { signal: ctrl.signal, redirectOn401: false })
      .then((atual) => {
        if (!ctrl.signal.aborted) setUsuario(atual)
      })
      .catch((erro: unknown) => {
        if (abortou(erro) || ctrl.signal.aborted) return
        setUsuario(null)
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setCarregando(false)
      })
    return () => ctrl.abort()
  }, [])

  const entrar = useCallback(async (email: string, senha: string) => {
    const atual = await api<IntegranteAtual>('/api/sessao', {
      method: 'POST',
      body: JSON.stringify({ email, senha }),
      redirectOn401: false,
    })
    setUsuario(atual)
  }, [])

  const sair = useCallback(async () => {
    await api('/api/sessao/encerrar', { method: 'POST', redirectOn401: false })
    setUsuario(null)
  }, [])

  const valor = useMemo(
    () => ({ usuario, carregando, entrar, sair, definirUsuario: setUsuario }),
    [usuario, carregando, entrar, sair],
  )

  return <SessaoContexto.Provider value={valor}>{children}</SessaoContexto.Provider>
}

export function useSessao(): SessaoValor {
  const contexto = useContext(SessaoContexto)
  if (!contexto) throw new Error('Sessão indisponível')
  return contexto
}
