import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { classeBotao } from './ui'

type Pedido = {
  titulo: string
  mensagem: string
  confirmar?: string
  cancelar?: string
  perigo?: boolean
}

type PedidoAberto = Pedido & { resolver: (confirmado: boolean) => void }

export function useConfirmacao() {
  const pedidoRef = useRef<PedidoAberto | null>(null)
  const [pedido, setPedido] = useState<PedidoAberto | null>(null)

  const responder = useCallback((confirmado: boolean) => {
    pedidoRef.current?.resolver(confirmado)
    pedidoRef.current = null
    setPedido(null)
  }, [])

  function pedir(dados: Pedido) {
    pedidoRef.current?.resolver(false)
    return new Promise<boolean>((resolver) => {
      const aberto = { ...dados, resolver }
      pedidoRef.current = aberto
      setPedido(aberto)
    })
  }

  const dialogo = pedido ? (
    <ModalConfirmacao
      titulo={pedido.titulo}
      mensagem={pedido.mensagem}
      confirmar={pedido.confirmar ?? 'Confirmar'}
      cancelar={pedido.cancelar ?? 'Cancelar'}
      perigo={pedido.perigo ?? false}
      onConfirmar={() => responder(true)}
      onCancelar={() => responder(false)}
    />
  ) : null

  return { pedir, dialogo }
}

function ModalConfirmacao({
  titulo,
  mensagem,
  confirmar,
  cancelar,
  perigo,
  onConfirmar,
  onCancelar,
}: {
  titulo: string
  mensagem: string
  confirmar: string
  cancelar: string
  perigo: boolean
  onConfirmar: () => void
  onCancelar: () => void
}) {
  const tituloId = useId()
  const descricaoId = useId()
  const cancelarRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    cancelarRef.current?.focus()
    const anterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function aoTecla(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCancelar()
      }
    }
    document.addEventListener('keydown', aoTecla)
    return () => {
      document.body.style.overflow = anterior
      document.removeEventListener('keydown', aoTecla)
    }
  }, [onCancelar])

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onMouseDown={onCancelar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        aria-describedby={descricaoId}
        className="w-full max-w-md rounded-3xl bg-paper p-6 shadow-[0_24px_60px_rgba(14,60,67,0.18)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id={tituloId} className="text-2xl font-bold tracking-tight">
          {titulo}
        </h2>
        <p id={descricaoId} className="mt-2 text-sm leading-6">
          {mensagem}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button ref={cancelarRef} type="button" className={classeBotao('suave')} onClick={onCancelar}>
            {cancelar}
          </button>
          <button type="button" className={classeBotao(perigo ? 'perigo' : 'primario')} onClick={onConfirmar}>
            {confirmar}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
