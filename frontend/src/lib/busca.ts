import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

export function useBusca() {
  const [params, setParams] = useSearchParams()
  const busca = params.get('busca') ?? ''
  const [texto, setTexto] = useState(busca)

  useEffect(() => {
    setTexto(busca)
  }, [busca])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (texto.trim() === busca) return
      const proxima = texto.trim()
      setParams(proxima ? { busca: proxima } : {}, { replace: true })
    }, 300)
    return () => window.clearTimeout(timer)
  }, [texto, busca, setParams])

  return { busca, texto, setTexto }
}
