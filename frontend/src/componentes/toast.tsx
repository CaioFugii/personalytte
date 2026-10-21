import { useEffect } from 'react'
import { toast, Toaster } from 'sonner'

export type TomNotificacao = 'erro' | 'ok' | 'aviso'

export function notificar(tom: TomNotificacao, texto: string) {
  const opcoes = { id: `${tom}:${texto}` }
  if (tom === 'erro') toast.error(texto, opcoes)
  else if (tom === 'ok') toast.success(texto, opcoes)
  else toast.warning(texto, opcoes)
}

export function useNotificar(tom: TomNotificacao | null, texto: string | null | undefined) {
  useEffect(() => {
    if (tom && texto) notificar(tom, texto)
  }, [tom, texto])
}

export function Notificacoes() {
  return (
    <Toaster
      position="top-right"
      closeButton
      richColors
      theme="light"
      containerAriaLabel="Notificações"
      style={{ fontFamily: 'inherit' }}
      toastOptions={{ closeButtonAriaLabel: 'Fechar', duration: 5000 }}
    />
  )
}
