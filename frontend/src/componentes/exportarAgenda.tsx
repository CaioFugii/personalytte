import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Botao } from './ui'

export function ModalImagemAgenda({
  paginas,
  podeCompartilhar,
  onBaixar,
  onCompartilhar,
  onFechar,
}: {
  paginas: { url: string; nome: string }[]
  podeCompartilhar: boolean
  onBaixar: () => void
  onCompartilhar: () => void
  onFechar: () => void
}) {
  const tituloId = useId()
  const fecharAtual = useRef(onFechar)
  fecharAtual.current = onFechar
  const varias = paginas.length > 1

  useEffect(() => {
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
          Imagem da agenda
        </h2>
        <p className="text-sm text-muted">
          {varias
            ? 'Duas páginas, prontas para mandar no WhatsApp. Confira, baixe ou compartilhe as duas.'
            : 'Pronto para mandar no WhatsApp. Confira a imagem e baixe ou compartilhe.'}
        </p>
        <div className="grid max-h-[55vh] gap-3 overflow-auto rounded-2xl bg-sand p-3">
          {paginas.map((pagina, indice) => (
            <figure key={pagina.nome} className="grid gap-2">
              {varias ? (
                <figcaption className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Página {indice + 1} de {paginas.length}
                </figcaption>
              ) : null}
              <img src={pagina.url} alt={`Agenda do dia, página ${indice + 1} de ${paginas.length}`} className="mx-auto block w-full max-w-sm rounded-xl" />
            </figure>
          ))}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Botao variante="secundario" onClick={onFechar}>
            Fechar
          </Botao>
          <Botao variante="secundario" onClick={onBaixar}>
            {varias ? 'Baixar imagens' : 'Baixar imagem'}
          </Botao>
          {podeCompartilhar ? <Botao onClick={onCompartilhar}>Compartilhar</Botao> : null}
        </div>
      </div>
    </div>,
    document.body,
  )
}
