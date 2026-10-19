import { useEffect, useRef, useState } from 'react'
import { abortou, api, mensagemDeErro } from './client'

type Estado<T> = {
  dados: T | null
  erro: string | null
  carregando: boolean
}

export function useGet<T>(caminho: string | null) {
  const [tick, setTick] = useState(0)
  const [estado, setEstado] = useState<Estado<T>>({
    dados: null,
    erro: null,
    carregando: caminho !== null,
  })
  const caminhoVisto = useRef(caminho)

  if (caminhoVisto.current !== caminho) {
    caminhoVisto.current = caminho
    setEstado({ dados: null, erro: null, carregando: caminho !== null })
  }

  useEffect(() => {
    if (!caminho) return
    const ctrl = new AbortController()
    setEstado((atual) => ({ ...atual, carregando: true, erro: null }))
    api<T>(caminho, { signal: ctrl.signal })
      .then((dados) => {
        if (!ctrl.signal.aborted) setEstado({ dados, erro: null, carregando: false })
      })
      .catch((erro: unknown) => {
        if (abortou(erro) || ctrl.signal.aborted) return
        setEstado((atual) => ({
          dados: atual.dados,
          erro: mensagemDeErro(erro),
          carregando: false,
        }))
      })
    return () => ctrl.abort()
  }, [caminho, tick])

  return {
    dados: estado.dados,
    erro: estado.erro,
    carregando: estado.carregando,
    recarregar: () => setTick((n) => n + 1),
  }
}
