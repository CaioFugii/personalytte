import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Botao } from './ui'

export function ModalTextoAgenda({
  texto,
  onCopiar,
  onFechar,
  titulo = 'Texto da agenda',
  descricao = 'Pronto para colar no WhatsApp.',
  rotuloCampo = 'Texto da agenda do dia',
}: {
  texto: string
  onCopiar: () => void
  onFechar: () => void
  titulo?: string
  descricao?: string
  rotuloCampo?: string
}) {
  const tituloId = useId()
  const fecharAtual = useRef(onFechar)
  fecharAtual.current = onFechar
  const campoRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    campoRef.current?.focus()
    campoRef.current?.select()
    const anterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function aoTecla(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        fecharAtual.current()
      }
    }
    document.addEventListener('keydown', aoTecla)
    return () => {
      document.body.style.overflow = anterior
      document.removeEventListener('keydown', aoTecla)
    }
  }, [])

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onMouseDown={onFechar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        className="grid w-full max-w-lg gap-4 rounded-3xl bg-paper p-6 shadow-[0_24px_60px_rgba(14,60,67,0.18)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id={tituloId} className="text-2xl font-bold tracking-tight">
          {titulo}
        </h2>
        <p className="text-sm text-muted">{descricao}</p>
        <textarea
          ref={campoRef}
          readOnly
          value={texto}
          rows={Math.min(16, Math.max(8, texto.split('\n').length))}
          aria-label={rotuloCampo}
          className="max-h-[55vh] w-full resize-y rounded-2xl border border-line bg-sand p-3 text-sm leading-relaxed"
        />
        <div className="flex flex-wrap justify-end gap-2">
          <Botao variante="secundario" onClick={onFechar}>
            Fechar
          </Botao>
          <Botao onClick={onCopiar}>Copiar</Botao>
        </div>
      </div>
    </div>,
    document.body,
  )
}
