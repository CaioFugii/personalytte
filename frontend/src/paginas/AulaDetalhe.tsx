import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, mensagemDeErro } from '../api/client'
import type { Aluno, Aula, Categoria, Responsavel, StatusAula } from '../api/types'
import { useGet } from '../api/useGet'
import { useConfirmacao } from '../componentes/confirmacao'
import {
  Banner,
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
import { aulaJaComecou, formatarIntervalo, instanteBrasilia, partesSP } from '../lib/calendario'
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
  ].join('|')
}

export function AulaDetalhe() {
  const { id = '' } = useParams()
  const aulaQ = useGet<Aula>(id ? `/api/aulas/${id}` : null)
  const alunosQ = useGet<Aluno[]>('/api/alunos')
  const respQ = useGet<Responsavel[]>('/api/integrantes/responsaveis')
  const aula = aulaQ.dados
  useTitulo(aula ? aula.aluno.nome : 'Aula')

  const [agora, setAgora] = useState(() => new Date())
  const [chaveVista, setChaveVista] = useState<string | null>(null)
  const [form, setForm] = useState<FormAula | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [cancelando, setCancelando] = useState(false)
  const { pedir, dialogo } = useConfirmacao()

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

  const carregando =
    (aulaQ.carregando && !aula) ||
    (alunosQ.carregando && !Array.isArray(alunosQ.dados)) ||
    (respQ.carregando && !Array.isArray(respQ.dados))
  const erroCarga = aulaQ.erro || (!aula && (alunosQ.erro || respQ.erro))
  const comecou = aula ? aulaJaComecou(aula.inicio, agora) : false

  async function salvar(event: FormEvent) {
    event.preventDefault()
    if (!aula || !form) return
    setErro(null)
    setOk(null)
    if (!form.alunoId || !form.responsavelId) {
      setErro('Informe o aluno e o responsável.')
      return
    }
    if (!comecou && (!civilPreenchida(form.data) || !form.hora)) {
      setErro('Informe a data e o horário.')
      return
    }
    if (form.status === 'FALTA' && form.criarReposicao) {
      if (!form.reposicaoResponsavelId || !civilPreenchida(form.reposicaoData) || !form.reposicaoHora) {
        setErro('Informe o responsável e o início da reposição, ou salve a falta sem reposição.')
        return
      }
    }
    if (form.status === 'CANCELADA' && aula.status !== 'CANCELADA') {
      const confirma = await pedir({
        titulo: 'Cancelar aula',
        mensagem: 'Gravar esta aula como Cancelada?',
        confirmar: 'Gravar',
        perigo: true,
      })
      if (!confirma) return
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
    const criaReposicao = form.status === 'FALTA' && form.criarReposicao
    if (criaReposicao) {
      corpo.status = 'FALTA'
      corpo.reposicao = {
        responsavelId: form.reposicaoResponsavelId,
        inicio: instanteBrasilia(form.reposicaoData, form.reposicaoHora),
      }
    }
    if (Object.keys(corpo).length === 0) {
      setOk('Nada para salvar.')
      return
    }

    setSalvando(true)
    try {
      await api(`/api/aulas/${aula.id}`, { method: 'PATCH', body: JSON.stringify(corpo) })
      setOk(criaReposicao ? 'Falta registrada e reposição criada.' : 'Alterações salvas.')
      setForm((atual) =>
        atual
          ? { ...atual, criarReposicao: false, reposicaoData: '', reposicaoHora: '' }
          : atual,
      )
      aulaQ.recarregar()
    } catch (err) {
      setErro(mensagemDeErro(err))
    } finally {
      setSalvando(false)
    }
  }

  async function cancelar() {
    if (!aula || aula.status === 'CANCELADA') return
    const confirma = await pedir({
      titulo: 'Cancelar aula',
      mensagem: 'Cancelar esta aula? O horário fica livre.',
      confirmar: 'Cancelar aula',
      perigo: true,
    })
    if (!confirma) return
    setErro(null)
    setOk(null)
    setCancelando(true)
    try {
      await api(`/api/aulas/${aula.id}/cancelar`, { method: 'POST' })
      setOk('Aula cancelada.')
      aulaQ.recarregar()
    } catch (err) {
      setErro(mensagemDeErro(err))
    } finally {
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
      {dialogo}
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
          {(alunosQ.erro || respQ.erro) && (
            <Banner tom="erro">{alunosQ.erro || respQ.erro}</Banner>
          )}
          {erro ? <Banner tom="erro">{erro}</Banner> : null}
          {ok ? <Banner tom="ok">{ok}</Banner> : null}
          {comecou ? (
            <Banner tom="aviso">Esta aula já começou. Data e horário não podem ser alterados.</Banner>
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
                  {STATUS.map((item) => (
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

            {form.status === 'FALTA' ? (
              <fieldset className="rounded-lg border border-line p-4">
                <legend className="px-1 font-semibold">Reposição</legend>
                <p className="mb-3 text-sm text-muted">A falta pode ser salva sem reposição. A reposição é opcional.</p>
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
                    <Campo label="Responsável da reposição" htmlFor="resp-reposicao">
                      <select
                        id="resp-reposicao"
                        required
                        value={form.reposicaoResponsavelId}
                        onChange={(event) => setForm({ ...form, reposicaoResponsavelId: event.target.value })}
                        className={classeCampo}
                      >
                        <option value="">Selecione</option>
                        {opcoesResp.map((item) => (
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
                <Botao variante="perigo" disabled={salvando || cancelando} onClick={() => void cancelar()}>
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
