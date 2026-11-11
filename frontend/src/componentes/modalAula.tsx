import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { api, mensagemDeErro } from '../api/client'
import type { Aula, Responsavel, StatusAula } from '../api/types'
import { useGet } from '../api/useGet'
import { formatarIntervalo } from '../lib/calendario'
import { STATUS } from '../lib/rotulos'
import { ModalCancelamento, type DadosCancelamento } from './cancelamento'
import { notificar } from './toast'
import { Botao, Campo, classeCampo, SeloCategoria } from './ui'

export function ModalAula({
  aula,
  onFechar,
  onSalvo,
}: {
  aula: Aula
  onFechar: () => void
  onSalvo: () => void
}) {
  const tituloId = useId()
  const statusRef = useRef<HTMLSelectElement>(null)
  const fecharAtual = useRef(onFechar)
  fecharAtual.current = onFechar
  const [status, setStatus] = useState<StatusAula>(aula.status)
  const [criarReposicao, setCriarReposicao] = useState(
    aula.status === 'FALTA' && Boolean(aula.justificativaReposicao) && !aula.reposicaoAgendadaId,
  )
  const [justificativa, setJustificativa] = useState(aula.justificativaReposicao ?? '')
  const [salvando, setSalvando] = useState(false)
  const [cancelando, setCancelando] = useState(false)
  const [pedindoCancelamento, setPedindoCancelamento] = useState(false)
  const cancelamentoAberto = useRef(false)
  cancelamentoAberto.current = pedindoCancelamento
  const respQ = useGet<Responsavel[]>(pedindoCancelamento ? '/api/integrantes/responsaveis' : null)
  const professores = useMemo(
    () =>
      (Array.isArray(respQ.dados) ? respQ.dados : [])
        .filter((item) => item.funcao === 'PROFESSOR')
        .map((item) => ({ id: item.id, nome: item.nome }))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [respQ.dados],
  )
  const opcoes = aula.status === 'CANCELADA' ? STATUS : STATUS.filter((item) => item.value !== 'CANCELADA')

  useEffect(() => {
    if (pedindoCancelamento && respQ.erro) {
      notificar('erro', respQ.erro)
      setPedindoCancelamento(false)
    }
  }, [pedindoCancelamento, respQ.erro])

  useEffect(() => {
    statusRef.current?.focus()
    const anterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function aoTecla(event: KeyboardEvent) {
      if (event.key !== 'Escape' || cancelamentoAberto.current) return
      event.preventDefault()
      fecharAtual.current()
    }
    document.addEventListener('keydown', aoTecla)
    return () => {
      document.body.style.overflow = anterior
      document.removeEventListener('keydown', aoTecla)
    }
  }, [])

  async function salvar() {
    const corpo: Record<string, unknown> = {}
    if (status !== aula.status) corpo.status = status
    if (status === 'FALTA' && !aula.reposicaoAgendadaId) {
      if (criarReposicao) {
        if (!justificativa.trim()) {
          notificar('erro', 'Informe a justificativa da reposição.')
          return
        }
        corpo.status = 'FALTA'
        corpo.concederReposicao = { justificativa: justificativa.trim() }
      } else if (aula.justificativaReposicao) {
        corpo.concederReposicao = null
      }
    }
    if (Object.keys(corpo).length === 0) {
      onFechar()
      return
    }
    setSalvando(true)
    try {
      await api(`/api/aulas/${aula.id}`, { method: 'PATCH', body: JSON.stringify(corpo) })
      notificar('ok', corpo.concederReposicao ? 'Vaga de reposição registrada.' : 'Alterações salvas.')
      onSalvo()
      onFechar()
    } catch (erro) {
      notificar('erro', mensagemDeErro(erro))
      setSalvando(false)
    }
  }

  async function cancelar(dados: DadosCancelamento) {
    if (aula.status === 'CANCELADA') return
    setCancelando(true)
    try {
      await api(`/api/aulas/${aula.id}/cancelar`, { method: 'POST', body: JSON.stringify(dados) })
      notificar('ok', dados.reposicao ? 'Aula cancelada e reposição criada.' : 'Aula cancelada.')
      onSalvo()
      onFechar()
    } catch (erro) {
      notificar('erro', mensagemDeErro(erro))
      setCancelando(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/40 p-4" onMouseDown={onFechar}>
      {pedindoCancelamento && !respQ.carregando ? (
        <ModalCancelamento
          professores={professores}
          professorPadrao={professores.some((item) => item.id === aula.responsavel.id) ? aula.responsavel.id : ''}
          enviando={cancelando}
          onConfirmar={(dados) => void cancelar(dados)}
          onFechar={() => {
            if (!cancelando) setPedindoCancelamento(false)
          }}
        />
      ) : null}
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-paper p-6 shadow-[0_24px_60px_rgba(14,60,67,0.18)]"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault()
          void salvar()
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold tracking-[0.16em] text-tide uppercase">Aula</p>
            <h2 id={tituloId} className="text-2xl font-bold tracking-tight">
              {aula.aluno.nome}
            </h2>
            <p className="mt-1 text-sm text-muted">{formatarIntervalo(aula.inicio, aula.fim)}</p>
          </div>
          <button type="button" className="text-sm font-semibold text-muted" onClick={onFechar} disabled={salvando || cancelando}>
            Fechar
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <SeloCategoria categoria={aula.aluno.categoria} />
          <span className="text-muted">Professor: {aula.responsavel.nome}</span>
        </div>
        <div className="mt-4">
          <Campo label="Status" htmlFor={`status-aula-${aula.id}`}>
            <select
              id={`status-aula-${aula.id}`}
              ref={statusRef}
              value={status}
              disabled={salvando || cancelando}
              onChange={(event) => {
                const proximo = event.target.value as StatusAula
                setStatus(proximo)
                if (proximo !== 'FALTA') setCriarReposicao(false)
              }}
              className={classeCampo}
            >
              {opcoes.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </Campo>
        </div>
        {status === 'FALTA' ? (
          <fieldset className="mt-4 rounded-lg border border-line p-4">
            <legend className="px-1 font-semibold">Reposição</legend>
            <p className="mb-3 text-sm text-muted">
              Reposições disponíveis deste aluno:{' '}
              <span className="font-semibold text-ink tabular-nums">{aula.reposicoesDisponiveis}</span>
            </p>
            {aula.reposicaoAgendadaId ? (
              <div className="text-sm">
                <p>A reposição desta aula já está agendada.</p>
                {aula.justificativaReposicao ? <p className="mt-2">Justificativa: {aula.justificativaReposicao}</p> : null}
              </div>
            ) : (
              <>
                <p className="mb-3 text-sm text-muted">A vaga só entra com este quadro marcado e a justificativa preenchida.</p>
                <label className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <input
                    type="checkbox"
                    checked={criarReposicao}
                    disabled={salvando || cancelando}
                    onChange={(event) => setCriarReposicao(event.target.checked)}
                    className="accent-tide"
                  />
                  Criar reposição
                </label>
                {criarReposicao ? (
                  <Campo label="Justificativa da reposição" htmlFor={`justificativa-reposicao-${aula.id}`}>
                    <textarea
                      id={`justificativa-reposicao-${aula.id}`}
                      required
                      rows={3}
                      value={justificativa}
                      disabled={salvando || cancelando}
                      onChange={(event) => setJustificativa(event.target.value)}
                      className={classeCampo}
                    />
                  </Campo>
                ) : null}
              </>
            )}
          </fieldset>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-2">
          <Botao type="submit" disabled={salvando || cancelando}>
            Salvar
          </Botao>
          {aula.status !== 'CANCELADA' ? (
            <Botao
              type="button"
              variante="perigo"
              disabled={salvando || cancelando || respQ.carregando}
              onClick={() => setPedindoCancelamento(true)}
            >
              Cancelar aula
            </Botao>
          ) : null}
        </div>
      </form>
    </div>,
    document.body,
  )
}
