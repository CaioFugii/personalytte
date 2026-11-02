import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { civilValida, instanteBrasilia } from '../lib/calendario'
import { notificar } from './toast'
import { Botao, Campo, classeCampo } from './ui'

export type DadosCancelamento = {
  justificativa: string
  geraReposicao: boolean
  reposicao?: { responsavelId: string; inicio: string }
}

export function ModalCancelamento({
  professores,
  professorPadrao,
  enviando,
  onConfirmar,
  onFechar,
}: {
  professores: { id: string; nome: string }[]
  professorPadrao: string
  enviando: boolean
  onConfirmar: (dados: DadosCancelamento) => void
  onFechar: () => void
}) {
  const tituloId = useId()
  const justificativaRef = useRef<HTMLTextAreaElement>(null)
  const fecharAtual = useRef(onFechar)
  fecharAtual.current = onFechar
  const [justificativa, setJustificativa] = useState('')
  const [geraReposicao, setGeraReposicao] = useState<boolean | null>(null)
  const [professorId, setProfessorId] = useState(professorPadrao)
  const [data, setData] = useState('')
  const [hora, setHora] = useState('')

  useEffect(() => {
    justificativaRef.current?.focus()
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

  function confirmar(event: FormEvent) {
    event.preventDefault()
    if (!justificativa.trim()) {
      notificar('erro', 'Informe a justificativa do cancelamento.')
      return
    }
    if (geraReposicao === null) {
      notificar('erro', 'Informe se o cancelamento gera reposição.')
      return
    }
    const agendaAgora = geraReposicao && (data !== '' || hora !== '')
    if (agendaAgora && (!professorId || !civilValida(data) || !hora)) {
      notificar('erro', 'Informe o professor, a data e o horário da reposição, ou deixe a data e o horário vazios.')
      return
    }
    onConfirmar({
      justificativa: justificativa.trim(),
      geraReposicao,
      ...(agendaAgora ? { reposicao: { responsavelId: professorId, inicio: instanteBrasilia(data, hora) } } : {}),
    })
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onMouseDown={onFechar}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        onSubmit={confirmar}
        className="grid w-full max-w-lg gap-4 rounded-3xl bg-paper p-6 shadow-[0_24px_60px_rgba(14,60,67,0.18)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id={tituloId} className="text-2xl font-bold tracking-tight">
          Cancelar aula
        </h2>
        <p className="text-sm leading-6">O horário fica livre. A justificativa fica gravada na aula.</p>
        <Campo label="Justificativa" htmlFor="justificativa-cancelamento">
          <textarea
            id="justificativa-cancelamento"
            ref={justificativaRef}
            required
            rows={3}
            value={justificativa}
            onChange={(event) => setJustificativa(event.target.value)}
            className={classeCampo}
          />
        </Campo>
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Gera reposição de aula?</legend>
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="gera-reposicao"
                checked={geraReposicao === true}
                onChange={() => setGeraReposicao(true)}
                className="accent-tide"
              />
              Sim
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="gera-reposicao"
                checked={geraReposicao === false}
                onChange={() => setGeraReposicao(false)}
                className="accent-tide"
              />
              Não
            </label>
          </div>
        </fieldset>
        {geraReposicao ? (
          <fieldset className="rounded-lg border border-line p-4">
            <legend className="px-1 text-sm font-semibold">Agendar a reposição agora (opcional)</legend>
            <p className="mb-3 text-sm text-muted">Sem data, a reposição fica para agendar depois na própria aula.</p>
            <div className="grid gap-4 sm:grid-cols-3">
              <Campo label="Professor" htmlFor="resp-reposicao-cancelamento">
                <select
                  id="resp-reposicao-cancelamento"
                  value={professorId}
                  onChange={(event) => setProfessorId(event.target.value)}
                  className={classeCampo}
                >
                  <option value="">Selecione</option>
                  {professores.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nome}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo label="Data" htmlFor="data-reposicao-cancelamento">
                <input
                  id="data-reposicao-cancelamento"
                  type="date"
                  value={data}
                  onChange={(event) => setData(event.target.value)}
                  className={classeCampo}
                />
              </Campo>
              <Campo label="Horário" htmlFor="hora-reposicao-cancelamento">
                <input
                  id="hora-reposicao-cancelamento"
                  type="time"
                  value={hora}
                  onChange={(event) => setHora(event.target.value)}
                  className={classeCampo}
                />
              </Campo>
            </div>
          </fieldset>
        ) : null}
        <div className="flex justify-end gap-2">
          <Botao variante="secundario" disabled={enviando} onClick={onFechar}>
            Voltar
          </Botao>
          <Botao type="submit" variante="perigo" disabled={enviando}>
            {enviando ? 'Cancelando…' : 'Cancelar aula'}
          </Botao>
        </div>
      </form>
    </div>,
    document.body,
  )
}
