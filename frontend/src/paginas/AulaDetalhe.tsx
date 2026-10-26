import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, mensagemDeErro } from '../api/client'
import type { Aluno, Aula, Categoria, Responsavel, StatusAula } from '../api/types'
import { useGet } from '../api/useGet'
import { notificar, useNotificar } from '../componentes/toast'
import {
  Botao,
  Cabecalho,
  Campo,
  classeCampo,
  LinkBotao,
  Marcadores,
  PainelEstado,
  SeloCategoria,
  useTitulo,
} from '../componentes/ui'
import { aulaJaComecou, formatarIntervalo, inicioDaSemana, instanteBrasilia, partesSP } from '../lib/calendario'
import { rotuloStatus, STATUS } from '../lib/rotulos'

type FormAula = {
  alunoId: string
  responsavelId: string
  data: string
  hora: string
  status: StatusAula
  experimental: boolean
  telefone: string
  criarReposicao: boolean
  reposicaoResponsavelId: string
  reposicaoData: string
  reposicaoHora: string
}

function doAula(aula: Aula): FormAula {
  const partes = partesSP(aula.inicio)
  return {
    alunoId: aula.aluno.id,
    responsavelId: aula.responsavel.id,
    data: partes.data,
    hora: partes.hora,
    status: aula.status,
    experimental: aula.experimental,
    telefone: aula.aluno.telefone ?? '',
    criarReposicao: false,
    reposicaoResponsavelId: aula.responsavel.id,
    reposicaoData: '',
    reposicaoHora: '',
  }
}

function chaveAula(aula: Aula): string {
  return [
    aula.id,
    aula.inicio,
    aula.fim,
    aula.status,
    aula.experimental,
    aula.aluno.telefone ?? '',
    aula.aluno.id,
    aula.aluno.categoria,
    aula.responsavel.id,
    aula.reposicaoDeAulaId ?? '',
    aula.ligadaAoPlano,
    aula.cancelamento?.justificativa ?? '',
    aula.cancelamento?.geraReposicao ?? '',
  ].join('|')
}

export function AulaDetalhe() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const aulaQ = useGet<Aula>(id ? `/api/aulas/${id}` : null)
  const alunosQ = useGet<Aluno[]>('/api/alunos')
  const respQ = useGet<Responsavel[]>('/api/integrantes/responsaveis')
  const aula = aulaQ.dados
  useTitulo(aula ? aula.aluno.nome : 'Aula')

  const [agora, setAgora] = useState(() => new Date())
  const [chaveVista, setChaveVista] = useState<string | null>(null)
  const [form, setForm] = useState<FormAula | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [cancelando, setCancelando] = useState(false)
  const [pedindoCancelamento, setPedindoCancelamento] = useState(false)

  const chave = aula ? chaveAula(aula) : null
  if (chave !== chaveVista) {
    setChaveVista(chave)
    setForm(aula ? doAula(aula) : null)
  }

  useEffect(() => {
    const timer = window.setInterval(() => setAgora(new Date()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  const alunos = Array.isArray(alunosQ.dados) ? alunosQ.dados : []
  const responsaveis = Array.isArray(respQ.dados) ? respQ.dados : []
  const opcoesAluno = useMemo(() => {
    if (!aula) return []
    const base: { id: string; nome: string; categoria: Categoria | null }[] = alunos.map((item) => ({
      id: item.id,
      nome: item.nome,
      categoria: item.categoria,
    }))
    if (!base.some((item) => item.id === aula.aluno.id)) {
      base.unshift({ id: aula.aluno.id, nome: aula.aluno.nome, categoria: aula.aluno.categoria })
    }
    return base.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [alunos, aula])
  const opcoesResp = useMemo(() => {
    if (!aula) return []
    const base = responsaveis.map((item) => ({ id: item.id, nome: item.nome }))
    if (!base.some((item) => item.id === aula.responsavel.id)) {
      base.unshift({ id: aula.responsavel.id, nome: aula.responsavel.nome })
    }
    return base.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [responsaveis, aula])
  const professores = useMemo(
    () =>
      responsaveis
        .filter((item) => item.funcao === 'PROFESSOR')
        .map((item) => ({ id: item.id, nome: item.nome }))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [responsaveis],
  )
  const professorDe = (id: string) => (professores.some((item) => item.id === id) ? id : '')
  const reposicaoProfessorId = form ? professorDe(form.reposicaoResponsavelId) : ''

  const carregando =
    (aulaQ.carregando && !aula) ||
    (alunosQ.carregando && !Array.isArray(alunosQ.dados)) ||
    (respQ.carregando && !Array.isArray(respQ.dados))
  const erroCarga = aulaQ.erro || (!aula && (alunosQ.erro || respQ.erro))
  const comecou = aula ? aulaJaComecou(aula.inicio, agora) : false
  const repoeCancelada = aula?.status === 'CANCELADA' && aula.cancelamento?.geraReposicao === true
  const opcoesStatus = aula?.status === 'CANCELADA' ? STATUS : STATUS.filter((item) => item.value !== 'CANCELADA')
  useNotificar(aula && (alunosQ.erro || respQ.erro) ? 'erro' : null, alunosQ.erro || respQ.erro)
  useNotificar(comecou ? 'aviso' : null, 'Esta aula já começou. Data e horário não podem ser alterados.')

  async function salvar(event: FormEvent) {
    event.preventDefault()
    if (!aula || !form) return
    if (!form.alunoId || !form.responsavelId) {
      notificar('erro', 'Informe o aluno e o responsável.')
      return
    }
    if (!comecou && (!civilPreenchida(form.data) || !form.hora)) {
      notificar('erro', 'Informe a data e o horário.')
      return
    }
    const criaReposicao = form.criarReposicao && (form.status === 'FALTA' || (repoeCancelada && form.status === 'CANCELADA'))
    if (criaReposicao) {
      if (!reposicaoProfessorId || !civilPreenchida(form.reposicaoData) || !form.reposicaoHora) {
        notificar('erro', 'Informe o professor e o início da reposição, ou salve sem reposição.')
        return
      }
    }

    const corpo: Record<string, unknown> = {}
    if (form.alunoId !== aula.aluno.id) corpo.alunoId = form.alunoId
    if (form.responsavelId !== aula.responsavel.id) corpo.responsavelId = form.responsavelId
    if (form.status !== aula.status) corpo.status = form.status
    if (form.experimental !== aula.experimental) corpo.experimental = form.experimental
    const temporarioSelecionado = aula.aluno.temporario && form.alunoId === aula.aluno.id
    if (temporarioSelecionado && form.telefone.trim() !== (aula.aluno.telefone ?? '')) {
      corpo.telefone = form.telefone.trim() ? form.telefone.trim() : null
    }
    if (!comecou) {
      const atual = partesSP(aula.inicio)
      if (form.data !== atual.data || form.hora !== atual.hora) {
        corpo.inicio = instanteBrasilia(form.data, form.hora)
      }
    }
    if (criaReposicao) {
      if (form.status === 'FALTA') corpo.status = 'FALTA'
      corpo.reposicao = {
        responsavelId: reposicaoProfessorId,
        inicio: instanteBrasilia(form.reposicaoData, form.reposicaoHora),
      }
    }
    if (Object.keys(corpo).length === 0) {
      notificar('ok', 'Nada para salvar.')
      return
    }

    setSalvando(true)
    try {
      await api(`/api/aulas/${aula.id}`, { method: 'PATCH', body: JSON.stringify(corpo) })
      const dataAgenda = !comecou && civilPreenchida(form.data) ? form.data : partesSP(aula.inicio).data
      navigate(`/agenda?semana=${inicioDaSemana(dataAgenda)}`, {
        state: {
          sucesso: !criaReposicao
            ? 'Alterações salvas.'
            : form.status === 'FALTA'
              ? 'Falta registrada e reposição criada.'
              : 'Reposição agendada.',
        },
      })
    } catch (err) {
      notificar('erro', mensagemDeErro(err))
    } finally {
      setSalvando(false)
    }
  }

  async function cancelar(dados: DadosCancelamento) {
    if (!aula || aula.status === 'CANCELADA') return
    setCancelando(true)
    try {
      await api(`/api/aulas/${aula.id}/cancelar`, { method: 'POST', body: JSON.stringify(dados) })
      navigate(`/agenda?semana=${inicioDaSemana(partesSP(aula.inicio).data)}`, {
        state: { sucesso: dados.reposicao ? 'Aula cancelada e reposição criada.' : 'Aula cancelada.' },
      })
    } catch (err) {
      notificar('erro', mensagemDeErro(err))
      setCancelando(false)
    }
  }

  function tentar() {
    aulaQ.recarregar()
    alunosQ.recarregar()
    respQ.recarregar()
  }

  return (
    <div>
      {pedindoCancelamento && aula ? (
        <ModalCancelamento
          professores={professores}
          professorPadrao={professorDe(aula.responsavel.id)}
          enviando={cancelando}
          onConfirmar={(dados) => void cancelar(dados)}
          onFechar={() => {
            if (!cancelando) setPedindoCancelamento(false)
          }}
        />
      ) : null}
      <Cabecalho
        sobretitulo="Planejamento"
        titulo={aula ? aula.aluno.nome : 'Aula'}
        descricao={aula ? formatarIntervalo(aula.inicio, aula.fim) : undefined}
        acoes={
          <>
            {aula ? (
              <LinkBotao to={`/agenda/dia?date=${partesSP(aula.inicio).data}`} variante="secundario">
                Agenda do dia
              </LinkBotao>
            ) : (
              <LinkBotao to="/agenda" variante="secundario">
                Agenda
              </LinkBotao>
            )}
          </>
        }
      />

      {carregando ? <PainelEstado status>Carregando…</PainelEstado> : null}
      {erroCarga && !aula ? (
        <PainelEstado>
          <p className="mb-3 text-clay">{erroCarga}</p>
          <Botao variante="secundario" onClick={tentar}>
            Tentar de novo
          </Botao>
        </PainelEstado>
      ) : null}

      {aula && form ? (
        <div className="grid gap-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <SeloCategoria categoria={aula.aluno.categoria} />
            <span className="text-muted">{rotuloStatus(aula.status)}</span>
            <Marcadores aula={aula} />
            <span className="text-muted">{aula.ligadaAoPlano ? 'Plano semanal' : 'Avulsa'}</span>
            <Link to={`/alunos/${aula.aluno.id}`} className="font-semibold text-tide-dark">
              Ficha do aluno
            </Link>
            {aula.reposicaoDeAulaId ? (
              <Link to={`/agenda/aulas/${aula.reposicaoDeAulaId}`} className="font-semibold text-tide-dark">
                Ver aula de origem
              </Link>
            ) : null}
          </div>
          <p className="text-sm text-muted">Responsável: {aula.responsavel.nome}</p>
          {aula.cancelamento ? (
            <div className="rounded-2xl border border-line bg-paper p-4 text-sm">
              <p className="font-semibold">Cancelamento</p>
              <p className="mt-1 whitespace-pre-line">{aula.cancelamento.justificativa}</p>
              <p className="mt-2 text-muted">
                {aula.cancelamento.geraReposicao ? 'Gera reposição de aula.' : 'Não gera reposição de aula.'}
              </p>
            </div>
          ) : null}

          <form onSubmit={(event) => void salvar(event)} className="grid gap-4 rounded-2xl bg-paper p-5 shadow-[0_10px_28px_rgba(14,60,67,0.06)]">
            <div className="grid gap-4 md:grid-cols-2">
              <Campo label="Aluno" htmlFor="aluno">
                <select
                  id="aluno"
                  required
                  value={form.alunoId}
                  onChange={(event) => setForm({ ...form, alunoId: event.target.value })}
                  className={classeCampo}
                >
                  {opcoesAluno.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nome}{item.categoria ? ` · ${item.categoria}` : ''}
                    </option>
                  ))}
                </select>
              </Campo>
              {aula.aluno.temporario && form.alunoId === aula.aluno.id ? (
                <Campo label="Telefone (opcional)" htmlFor="telefone" dica="Cadastro temporário desta aula experimental.">
                  <input
                    id="telefone"
                    value={form.telefone}
                    onChange={(event) => setForm({ ...form, telefone: event.target.value })}
                    className={classeCampo}
                    inputMode="tel"
                    autoComplete="tel"
                  />
                </Campo>
              ) : null}
              <Campo label="Responsável" htmlFor="responsavel">
                <select
                  id="responsavel"
                  required
                  value={form.responsavelId}
                  onChange={(event) => setForm({ ...form, responsavelId: event.target.value })}
                  className={classeCampo}
                >
                  {opcoesResp.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nome}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo label="Data" htmlFor="data" dica="Horário de Brasília">
                <input
                  id="data"
                  type="date"
                  required={!comecou}
                  disabled={comecou}
                  value={form.data}
                  onChange={(event) => setForm({ ...form, data: event.target.value })}
                  className={classeCampo}
                />
              </Campo>
              <Campo label="Horário" htmlFor="hora">
                <input
                  id="hora"
                  type="time"
                  required={!comecou}
                  disabled={comecou}
                  value={form.hora}
                  onChange={(event) => setForm({ ...form, hora: event.target.value })}
                  className={classeCampo}
                />
              </Campo>
              <Campo label="Status" htmlFor="status">
                <select
                  id="status"
                  value={form.status}
                  onChange={(event) => {
                    const status = event.target.value as StatusAula
                    setForm({
                      ...form,
                      status,
                      criarReposicao: status === 'FALTA' ? form.criarReposicao : false,
                    })
                  }}
                  className={classeCampo}
                >
                  {opcoesStatus.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </Campo>
              <label className="mt-7 flex items-center gap-2 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={form.experimental}
                  onChange={(event) => setForm({ ...form, experimental: event.target.checked })}
                  className="accent-tide"
                />
                Aula experimental
              </label>
            </div>

            {form.status === 'FALTA' || (repoeCancelada && form.status === 'CANCELADA') ? (
              <fieldset className="rounded-lg border border-line p-4">
                <legend className="px-1 font-semibold">Reposição</legend>
                <p className="mb-3 text-sm text-muted">
                  {form.status === 'FALTA'
                    ? 'A falta pode ser salva sem reposição. A reposição é opcional.'
                    : 'Este cancelamento gera reposição. Agende quando tiver a data.'}
                </p>
                <label className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <input
                    type="checkbox"
                    checked={form.criarReposicao}
                    onChange={(event) => setForm({ ...form, criarReposicao: event.target.checked })}
                    className="accent-tide"
                  />
                  Criar reposição
                </label>
                {form.criarReposicao ? (
                  <div className="grid gap-4 md:grid-cols-3">
                    <Campo label="Professor da reposição" htmlFor="resp-reposicao">
                      <select
                        id="resp-reposicao"
                        required
                        value={reposicaoProfessorId}
                        onChange={(event) => setForm({ ...form, reposicaoResponsavelId: event.target.value })}
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
                    <Campo label="Data da reposição" htmlFor="data-reposicao">
                      <input
                        id="data-reposicao"
                        type="date"
                        required
                        value={form.reposicaoData}
                        onChange={(event) => setForm({ ...form, reposicaoData: event.target.value })}
                        className={classeCampo}
                      />
                    </Campo>
                    <Campo label="Horário da reposição" htmlFor="hora-reposicao">
                      <input
                        id="hora-reposicao"
                        type="time"
                        required
                        value={form.reposicaoHora}
                        onChange={(event) => setForm({ ...form, reposicaoHora: event.target.value })}
                        className={classeCampo}
                      />
                    </Campo>
                  </div>
                ) : null}
              </fieldset>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Botao type="submit" disabled={salvando || cancelando}>
                {salvando ? 'Salvando…' : 'Salvar'}
              </Botao>
              {aula.status !== 'CANCELADA' ? (
                <Botao variante="perigo" disabled={salvando || cancelando} onClick={() => setPedindoCancelamento(true)}>
                  {cancelando ? 'Cancelando…' : 'Cancelar aula'}
                </Botao>
              ) : null}
            </div>
          </form>
        </div>
      ) : null}
    </div>
  )
}

function civilPreenchida(valor: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(valor)
}

type DadosCancelamento = {
  justificativa: string
  geraReposicao: boolean
  reposicao?: { responsavelId: string; inicio: string }
}

function ModalCancelamento({
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
    if (agendaAgora && (!professorId || !civilPreenchida(data) || !hora)) {
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
