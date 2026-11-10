import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api, mensagemDeErro } from '../api/client'
import type { Aluno, Aula, Evento, Responsavel, TipoEvento } from '../api/types'
import { useGet } from '../api/useGet'
import {
  Botao,
  Cabecalho,
  Campo,
  classeCampo,
  cx,
  LinkBotao,
  PainelEstado,
  useTitulo,
} from '../componentes/ui'
import { useSessao } from '../contexto/Sessao'
import { notificar, useNotificar } from '../componentes/toast'
import { civilValida, hojeSP, inicioDaSemana, instanteBrasilia, partesSP } from '../lib/calendario'
import { categoriasPresentes, rotuloCategoria, TIPOS_EVENTO } from '../lib/rotulos'

const LIMITE_GRUPO = 4
const LIMITE_PRIMEIRA_AULA = 6

function limiteDoHorario(hora: string): number {
  return hora === '07:00' || hora === '07:00:00' ? LIMITE_PRIMEIRA_AULA : LIMITE_GRUPO
}

const GRADE_HORARIOS = Array.from({ length: 16 }, (_, indice) => `${String(indice + 7).padStart(2, '0')}:00`)

function minutosDoHorario(hora: string): number {
  const [horas, minutos] = hora.slice(0, 5).split(':').map(Number)
  return horas * 60 + minutos
}

function horariosCruzam(um: string, outro: string): boolean {
  return Math.abs(minutosDoHorario(um) - minutosDoHorario(outro)) < 60
}

function cabeNoDia(hora: string): boolean {
  return minutosDoHorario(hora) + 60 < 24 * 60
}

type HorarioLivre = { hora: string; vagas: number; limite: number; categorias: Array<Aula['aluno']['categoria']> }

function horariosLivres(aulas: Aula[], responsavelId: string, alunoIds: string[], pedidos: number): HorarioLivre[] {
  const ocupam = aulas.filter((aula) => aula.status !== 'CANCELADA' && aula.status !== 'FALTA')
  const horas = new Set(GRADE_HORARIOS)
  for (const aula of ocupam) {
    if (aula.responsavel.id !== responsavelId) continue
    const hora = partesSP(aula.inicio).hora
    if (cabeNoDia(hora)) horas.add(hora)
  }
  return [...horas]
    .filter(cabeNoDia)
    .sort((a, b) => minutosDoHorario(a) - minutosDoHorario(b))
    .flatMap((hora) => {
      const limite = limiteDoHorario(hora)
      const doProfessor = ocupam.filter(
        (aula) => aula.responsavel.id === responsavelId && horariosCruzam(partesSP(aula.inicio).hora, hora),
      )
      const mesmoInicio = doProfessor.filter((aula) => partesSP(aula.inicio).hora === hora)
      if (doProfessor.length !== mesmoInicio.length) return []
      const alunoOcupado = aulas.some(
        (aula) => alunoIds.includes(aula.aluno.id) && horariosCruzam(partesSP(aula.inicio).hora, hora),
      )
      if (alunoOcupado) return []
      const vagas = limite - mesmoInicio.length
      if (vagas < pedidos) return []
      return [{ hora, vagas, limite, categorias: mesmoInicio.map((aula) => aula.aluno.categoria) }]
    })
}

function rotuloHorarioLivre(item: HorarioLivre): string {
  const vagas = item.vagas === 1 ? '1 vaga' : `${item.vagas} vagas`
  if (item.categorias.length === 0) return `${item.hora} · ${vagas} · nenhum aluno`
  const nivel = categoriasPresentes(item.categorias) ?? 'sem categoria'
  return `${item.hora} · ${vagas} · ${nivel}`
}

function alunoPeloNome(alunos: Aluno[], texto: string, selecionados: Aluno[]): Aluno | null {
  const nome = texto.trim().toLowerCase()
  if (!nome) return null
  const iguais = alunos.filter((aluno) => aluno.nome.trim().toLowerCase() === nome)
  if (iguais.length !== 1 || selecionados.some((item) => item.id === iguais[0].id)) return null
  return iguais[0]
}

function professoresDe(lista: Responsavel[], atual?: { id: string; nome: string } | null): Responsavel[] {
  const professores = lista.filter((pessoa) => pessoa.funcao === 'PROFESSOR')
  if (atual && !professores.some((pessoa) => pessoa.id === atual.id)) {
    professores.unshift({ id: atual.id, nome: atual.nome, funcao: 'PROFESSOR' })
  }
  return professores.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

export function NovoAgendamento() {
  useTitulo('Novo agendamento')
  const { usuario } = useSessao()
  const [params] = useSearchParams()
  const tipo = params.get('tipo')
  const admin = usuario?.papel === 'administrador'

  if (tipo === 'evento' && usuario && !admin) {
    return <Navigate to="/agenda/novo" replace state={{ aviso: 'Só o administrador agenda eventos.' }} />
  }

  return (
    <div>
      <Cabecalho
        sobretitulo="Planejamento"
        titulo="Novo agendamento"
        descricao={tipo === 'aula' ? 'Aula avulsa' : tipo === 'evento' ? 'Evento' : 'Escolha o que entra na agenda'}
        acoes={
          <LinkBotao to="/agenda" variante="secundario">
            Voltar à agenda
          </LinkBotao>
        }
      />
      {tipo === 'aula' ? <FormAula /> : null}
      {tipo === 'evento' && admin ? <FormEvento /> : null}
    </div>
  )
}

export function LinkNovoAgendamento() {
  const location = useLocation()
  return (
    <LinkBotao to="/agenda/novo" state={{ fundo: location }}>
      + Novo agendamento
    </LinkBotao>
  )
}

export function ModalEscolha() {
  useTitulo('Novo agendamento')
  const { usuario } = useSessao()
  const admin = usuario?.papel === 'administrador'
  const navigate = useNavigate()
  const location = useLocation()
  const [opcao, setOpcao] = useState<'aula' | 'evento'>('aula')
  const tituloId = useId()
  const fecharRef = useRef<HTMLButtonElement>(null)
  const fecharAtual = useRef<() => void>(() => {})

  function fechar() {
    const fundo = (location.state as { fundo?: unknown } | null)?.fundo
    if (fundo) navigate(-1)
    else navigate('/agenda', { replace: true })
  }

  fecharAtual.current = fechar

  useEffect(() => {
    fecharRef.current?.focus()
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

  function agendar() {
    if (opcao === 'evento' && !admin) return
    navigate(`/agenda/novo?tipo=${opcao}`, { replace: true })
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onMouseDown={fechar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        className="w-full max-w-2xl rounded-3xl bg-paper p-6 shadow-[0_24px_60px_rgba(14,60,67,0.18)] sm:p-8"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id={tituloId} className="text-2xl font-bold tracking-tight">
            Novo agendamento
          </h2>
          <button
            ref={fecharRef}
            type="button"
            className="grid h-9 w-9 place-items-center rounded-full text-ink hover:bg-sand"
            aria-label="Fechar"
            onClick={fechar}
          >
            <span aria-hidden="true" className="text-xl leading-none">
              ×
            </span>
          </button>
        </div>
        <p className="mt-6 text-center text-xl font-bold">O que você deseja agendar?</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <CartaoOpcao
            titulo="Aula"
            texto="Agende uma aula para um aluno."
            selecionado={opcao === 'aula'}
            onClick={() => setOpcao('aula')}
            icone={<IconeChapeu />}
          />
          <CartaoOpcao
            titulo="Evento"
            texto={admin ? 'Cadastre um torneio ou outro evento.' : 'Somente o administrador agenda eventos.'}
            selecionado={opcao === 'evento'}
            disabled={!admin}
            onClick={() => setOpcao('evento')}
            icone={<IconeTrofeu />}
          />
        </div>
        <div className="mt-8 flex justify-center">
          <Botao onClick={agendar} className="min-w-40">
            Agendar
          </Botao>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function CartaoOpcao({
  titulo,
  texto,
  selecionado,
  disabled,
  onClick,
  icone,
}: {
  titulo: string
  texto: string
  selecionado: boolean
  disabled?: boolean
  onClick: () => void
  icone: ReactNode
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={selecionado}
      onClick={onClick}
      className={cx(
        'rounded-2xl border bg-white px-4 py-6 text-center',
        selecionado ? 'border-tide ring-2 ring-tide' : 'border-line hover:border-tide',
        disabled && 'cursor-not-allowed opacity-60',
      )}
    >
      <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-lime text-tide">{icone}</span>
      <span className="mt-4 block text-lg font-bold">{titulo}</span>
      <span className="mt-1 block text-sm text-muted">{texto}</span>
    </button>
  )
}

function IconeChapeu() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 10 12 5l9.5 5L12 15z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.5 12.2V16c1.6 1.6 3.4 2.4 5.5 2.4s3.9-.8 5.5-2.4v-3.8" />
    </svg>
  )
}

function IconeTrofeu() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 4h8v6a4 4 0 0 1-8 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 6H5.5A2.5 2.5 0 0 0 8 10.5M16 6h2.5A2.5 2.5 0 0 1 16 10.5M12 14v3M9 20h6M10 17h4" />
    </svg>
  )
}

function FormAula() {
  const navigate = useNavigate()
  const alunosQ = useGet<Aluno[]>('/api/alunos')
  const respQ = useGet<Responsavel[]>('/api/integrantes/responsaveis')
  const alunos = Array.isArray(alunosQ.dados) ? alunosQ.dados : []
  const responsaveis = Array.isArray(respQ.dados) ? respQ.dados : []
  const hoje = hojeSP()
  const [texto, setTexto] = useState('')
  const [selecionados, setSelecionados] = useState<Aluno[]>([])
  const [telefone, setTelefone] = useState('')
  const [aberto, setAberto] = useState(false)
  const [responsavelId, setResponsavelId] = useState('')
  const [data, setData] = useState('')
  const [hora, setHora] = useState('')
  const [experimental, setExperimental] = useState(false)
  const [usarReposicao, setUsarReposicao] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const diaValido = civilValida(data)
  const aulasDia = useGet<Aula[]>(diaValido ? `/api/aulas?de=${data}&ate=${data}` : null)
  const aulasDoDia = Array.isArray(aulasDia.dados) ? aulasDia.dados : []
  const consultaPronta = Boolean(responsavelId) && diaValido && !aulasDia.carregando && !aulasDia.erro && Array.isArray(aulasDia.dados)
  const livres = useMemo(() => {
    if (!consultaPronta) return []
    return horariosLivres(aulasDoDia, responsavelId, selecionados.map((aluno) => aluno.id), Math.max(selecionados.length, 1))
  }, [consultaPronta, aulasDoDia, responsavelId, selecionados])
  const escolhido = livres.find((item) => item.hora === hora)

  useEffect(() => {
    if (!consultaPronta) return
    if (hora && !livres.some((item) => item.hora === hora)) setHora('')
  }, [consultaPronta, hora, livres])

  const sugestoes = useMemo(() => {
    const consulta = texto.trim().toLowerCase()
    const digitos = texto.replace(/\D/g, '')
    return alunos
      .filter((aluno) => {
        if (selecionados.some((item) => item.id === aluno.id)) return false
        if (!consulta) return true
        return (
          aluno.nome.toLowerCase().includes(consulta) ||
          (aluno.email ?? '').toLowerCase().includes(consulta) ||
          (digitos.length > 0 && aluno.telefone.includes(digitos))
        )
      })
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      .slice(0, 8)
  }, [alunos, selecionados, texto])

  const alunoReposicao = !experimental && selecionados.length === 1 ? selecionados[0] : null
  const vagasReposicao = alunoReposicao?.reposicoesDisponiveis ?? 0
  const podeUsarReposicao = vagasReposicao > 0
  useEffect(() => {
    if (!podeUsarReposicao) setUsarReposicao(false)
  }, [podeUsarReposicao])
  const limite = escolhido ? escolhido.vagas : limiteDoHorario(hora)
  const grupoCheio = usarReposicao ? selecionados.length >= 1 : selecionados.length >= limite
  const digitadoCadastrado = alunoPeloNome(alunos, texto, selecionados)
  const cadastroTemporario = experimental && selecionados.length === 0 && !digitadoCadastrado
  const carregando = (alunosQ.carregando && !alunosQ.dados) || (respQ.carregando && !respQ.dados)
  const erroCarga = alunosQ.erro || respQ.erro
  useNotificar(!carregando && !erroCarga && !experimental && alunos.length === 0 ? 'aviso' : null, 'Não há aluno ativo para agendar.')

  function escolher(aluno: Aluno) {
    if (grupoCheio) return
    setSelecionados([...selecionados, aluno])
    setTexto('')
    setAberto(false)
  }

  function remover(id: string) {
    setSelecionados(selecionados.filter((aluno) => aluno.id !== id))
  }

  async function aoEnviar(event: FormEvent) {
    event.preventDefault()
    const nome = texto.trim()
    const digitado = alunoPeloNome(alunos, nome, selecionados)
    const ids = selecionados.map((aluno) => aluno.id)
    if (!usarReposicao && digitado && ids.length < limite) ids.push(digitado.id)
    const temporario = ids.length === 0 && experimental && nome !== ''
    if (!responsavelId || !civilValida(data) || !hora || (ids.length === 0 && !temporario)) {
      notificar('erro', experimental ? 'Informe o aluno, o professor, a data e o horário.' : 'Selecione um aluno cadastrado, o professor, a data e o horário.')
      return
    }
    if (consultaPronta && !livres.some((item) => item.hora === hora)) {
      notificar('erro', 'Esse horário não está disponível.')
      return
    }
    if (usarReposicao && (ids.length !== 1 || (selecionados[0]?.reposicoesDisponiveis ?? 0) < 1)) {
      notificar('erro', 'Selecione um aluno com reposição disponível.')
      return
    }
    if (ids.length > limite) {
      notificar('erro', limite === LIMITE_PRIMEIRA_AULA ? 'A aula das 7h aceita até 6 alunos.' : 'Nesse horário o grupo aceita até 4 alunos.')
      return
    }
    if (data < hoje) {
      notificar('erro', 'Não é possível agendar uma data anterior a hoje.')
      return
    }
    setEnviando(true)
    const base = { responsavelId, inicio: instanteBrasilia(data, hora), experimental }
    try {
      if (usarReposicao) {
        await api('/api/aulas/reposicao', {
          method: 'POST',
          body: JSON.stringify({ alunoId: ids[0], responsavelId, inicio: base.inicio }),
        })
      } else if (ids.length > 1) {
        await api('/api/aulas/grupo', { method: 'POST', body: JSON.stringify({ ...base, alunoIds: ids }) })
      } else {
        await api('/api/aulas', {
          method: 'POST',
          body: JSON.stringify(
            temporario
              ? { ...base, alunoTemporario: { nome, telefone: telefone.trim() ? telefone.trim() : null } }
              : { ...base, alunoId: ids[0] },
          ),
        })
      }
      navigate(`/agenda?semana=${inicioDaSemana(data)}`, {
        state: {
          sucesso: usarReposicao
            ? 'Reposição agendada.'
            : ids.length > 1
              ? `Aula em grupo agendada para ${ids.length} alunos.`
              : 'Aula agendada.',
        },
      })
    } catch (err) {
      notificar('erro', mensagemDeErro(err))
      setEnviando(false)
    }
  }

  function dicaDoHorario(): string {
    if (!responsavelId || !diaValido) return 'Escolha o professor e a data para ver os horários livres.'
    if (aulasDia.carregando) return 'Carregando horários…'
    if (aulasDia.erro) return aulasDia.erro
    if (livres.length === 0) return 'Não há horário livre para este professor nesse dia.'
    return ''
  }

  if (carregando) return <PainelEstado status>Carregando…</PainelEstado>
  if (erroCarga) {
    return (
      <PainelEstado>
        <p className="mb-3 text-clay">{erroCarga}</p>
        <Botao
          variante="secundario"
          onClick={() => {
            alunosQ.recarregar()
            respQ.recarregar()
          }}
        >
          Tentar de novo
        </Botao>
      </PainelEstado>
    )
  }

  return (
    <form onSubmit={(event) => void aoEnviar(event)} className="grid max-w-3xl gap-4 rounded-2xl bg-paper p-5 shadow-[0_10px_28px_rgba(14,60,67,0.06)]">
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input
          type="checkbox"
          checked={experimental}
          onChange={(event) => setExperimental(event.target.checked)}
          className="accent-tide"
        />
        Aula experimental
      </label>
      <Campo
        label={usarReposicao ? 'Aluno' : `Alunos (até ${limite})`}
        htmlFor="aluno-aula"
        dica={
          usarReposicao
            ? 'A reposição vale para este aluno.'
            : selecionados.length > limite
            ? `Nesse horário o grupo aceita até ${limite} alunos.`
            : grupoCheio
              ? `O grupo já tem ${limite} alunos.`
              : experimental && selecionados.length === 0
                ? 'Busque um cadastrado ou digite o nome. Quem não está na lista vira cadastro temporário.'
                : escolhido && escolhido.vagas < escolhido.limite
                  ? `Esse horário ainda aceita ${escolhido.vagas} ${escolhido.vagas === 1 ? 'aluno' : 'alunos'}.`
                  : hora === '07:00' || hora === '07:00:00'
                    ? 'Busque por nome, e-mail ou telefone e selecione. A aula das 7h junta até 6 alunos.'
                    : 'Busque por nome, e-mail ou telefone e selecione. A aula em grupo junta até 4 alunos no mesmo horário.'
        }
      >
        {selecionados.length > 0 ? (
          <ul className="mb-2 flex flex-wrap gap-2" aria-label="Alunos escolhidos">
            {selecionados.map((aluno) => (
              <li key={aluno.id} className="flex items-center gap-1 rounded-full bg-sand py-1 pr-1 pl-3 text-sm">
                {aluno.nome}
                <button
                  type="button"
                  aria-label={`Remover ${aluno.nome}`}
                  onClick={() => remover(aluno.id)}
                  className="grid h-6 w-6 place-items-center rounded-full hover:bg-line"
                >
                  <span aria-hidden="true">×</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="relative">
          <input
            id="aluno-aula"
            role="combobox"
            aria-expanded={aberto}
            aria-autocomplete="list"
            aria-controls="sugestoes-aluno"
            value={texto}
            disabled={grupoCheio}
            onChange={(event) => {
              setTexto(event.target.value)
              setAberto(true)
            }}
            onFocus={() => setAberto(true)}
            onBlur={() => window.setTimeout(() => setAberto(false), 150)}
            className={classeCampo}
            autoComplete="off"
          />
          {aberto && texto.trim() && sugestoes.length > 0 ? (
            <ul
              id="sugestoes-aluno"
              role="listbox"
              className="mt-1 max-h-56 w-full overflow-auto rounded-md border border-line bg-paper shadow-sm"
            >
              {sugestoes.map((aluno) => (
                <li key={aluno.id} role="option" aria-selected={false}>
                  <button
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault()
                      escolher(aluno)
                    }}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-sand"
                  >
                    {aluno.nome} · {rotuloCategoria(aluno.categoria)}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </Campo>
      {podeUsarReposicao ? (
        <div>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              id="usar-reposicao"
              type="checkbox"
              checked={usarReposicao}
              onChange={(event) => setUsarReposicao(event.target.checked)}
              className="accent-tide"
            />
            Usar reposição
          </label>
          <p className="mt-1 text-sm text-muted">
            Este aluno tem {vagasReposicao === 1 ? '1 reposição disponível' : `${vagasReposicao} reposições disponíveis`}. A aula consome a vaga mais antiga.
          </p>
        </div>
      ) : null}
      {cadastroTemporario ? (
        <Campo label="Telefone (opcional)" htmlFor="telefone-temporario" dica="Só deste cadastro temporário. Não entra na lista de alunos.">
          <input
            id="telefone-temporario"
            value={telefone}
            onChange={(event) => setTelefone(event.target.value)}
            className={classeCampo}
          />
        </Campo>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        <Campo label="Professor" htmlFor="resp-aula">
          <select
            id="resp-aula"
            required
            value={responsavelId}
            onChange={(event) => setResponsavelId(event.target.value)}
            className={classeCampo}
          >
            <option value="">Selecione</option>
            {professoresDe(responsaveis).map((pessoa) => (
              <option key={pessoa.id} value={pessoa.id}>
                {pessoa.nome}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Data" htmlFor="data-aula" dica="Horário de Brasília">
          <input
            id="data-aula"
            type="date"
            required
            min={hoje}
            value={data}
            onChange={(event) => setData(event.target.value)}
            className={classeCampo}
          />
        </Campo>
        <Campo label="Horário" htmlFor="hora-aula" dica={dicaDoHorario()}>
          <select
            id="hora-aula"
            required
            value={hora}
            disabled={!responsavelId || !diaValido || aulasDia.carregando || Boolean(aulasDia.erro) || (consultaPronta && livres.length === 0)}
            onChange={(event) => setHora(event.target.value)}
            className={classeCampo}
          >
            <option value="">{livres.length === 0 && consultaPronta ? 'Nenhum horário livre' : 'Selecione'}</option>
            {hora && !livres.some((item) => item.hora === hora) ? <option value={hora}>{hora}</option> : null}
            {livres.map((item) => (
              <option key={item.hora} value={item.hora}>
                {rotuloHorarioLivre(item)}
              </option>
            ))}
          </select>
          {aulasDia.erro ? (
            <button type="button" className="mt-2 text-sm font-semibold text-tide" onClick={() => aulasDia.recarregar()}>
              Tentar de novo
            </button>
          ) : null}
        </Campo>
      </div>
      <div className="flex gap-2">
        <Botao type="submit" disabled={enviando || (!experimental && alunos.length === 0) || (diaValido && aulasDia.carregando)}>
          {enviando ? 'Salvando…' : 'Agendar aula'}
        </Botao>
        <LinkBotao to="/agenda/novo" variante="secundario">
          Voltar à escolha
        </LinkBotao>
      </div>
    </form>
  )
}

function FormEvento({ evento }: { evento?: Evento }) {
  const navigate = useNavigate()
  const respQ = useGet<Responsavel[]>('/api/integrantes/responsaveis')
  const responsaveis = Array.isArray(respQ.dados) ? respQ.dados : []
  const inicioOriginal = evento ? partesSP(evento.inicio) : null
  const fimOriginal = evento ? partesSP(evento.fim) : null
  const [tipo, setTipo] = useState<TipoEvento>(evento?.tipo ?? 'FERIADO')
  const [nome, setNome] = useState(evento?.nome ?? '')
  const [dataInicio, setDataInicio] = useState(inicioOriginal?.data ?? '')
  const [horaInicio, setHoraInicio] = useState(inicioOriginal?.hora ?? '')
  const [dataFim, setDataFim] = useState(fimOriginal?.data ?? '')
  const [horaFim, setHoraFim] = useState(fimOriginal?.hora ?? '')
  const [contato, setContato] = useState(evento?.contato ?? '')
  const [responsavelId, setResponsavelId] = useState(evento?.responsavelId ?? '')
  const hoje = hojeSP()
  const editando = Boolean(evento?.id)
  const [enviando, setEnviando] = useState(false)
  useNotificar(respQ.erro ? 'erro' : null, respQ.erro)

  async function aoEnviar(event: FormEvent) {
    event.preventDefault()
    if (!nome.trim() || !civilValida(dataInicio) || !horaInicio || !civilValida(dataFim) || !horaFim) {
      notificar('erro', 'Informe nome, início e fim.')
      return
    }
    if (tipo === 'AUSENCIA' && !responsavelId) {
      notificar('erro', 'Informe o professor da ausência.')
      return
    }
    if (dataFim < dataInicio) {
      notificar('erro', 'A data de fim não pode ser anterior à data de início.')
      return
    }
    const mudouInicio = !inicioOriginal || dataInicio !== inicioOriginal.data || horaInicio !== inicioOriginal.hora
    const mudouFim = !fimOriginal || dataFim !== fimOriginal.data || horaFim !== fimOriginal.hora
    if ((mudouInicio && dataInicio < hoje) || (mudouFim && dataFim < hoje)) {
      notificar('erro', 'Não é possível agendar uma data anterior a hoje.')
      return
    }
    const inicio = evento && !mudouInicio ? evento.inicio : instanteBrasilia(dataInicio, horaInicio)
    const fim = evento && !mudouFim ? evento.fim : instanteBrasilia(dataFim, horaFim)
    if (new Date(fim).getTime() <= new Date(inicio).getTime()) {
      notificar('erro', 'O fim precisa ser posterior ao início.')
      return
    }
    setEnviando(true)
    try {
      await api(editando ? `/api/eventos/${evento?.id}` : '/api/eventos', {
        method: editando ? 'PATCH' : 'POST',
        body: JSON.stringify({
          tipo,
          nome: nome.trim(),
          inicio,
          fim,
          contato: contato.trim() ? contato.trim() : null,
          bloqueiaAulas: false,
          responsavelId: tipo === 'AUSENCIA' ? responsavelId : null,
        }),
      })
      navigate(`/agenda?semana=${inicioDaSemana(dataInicio)}`, {
        state: { sucesso: editando ? 'Evento salvo.' : 'Evento agendado.' },
      })
    } catch (err) {
      notificar('erro', mensagemDeErro(err))
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={(event) => void aoEnviar(event)} className="grid max-w-3xl gap-4 rounded-2xl bg-paper p-5 shadow-[0_10px_28px_rgba(14,60,67,0.06)]">
      <Campo label="Tipo" htmlFor="tipo-evento">
        <select
          id="tipo-evento"
          value={tipo}
          onChange={(event) => {
            const proximo = event.target.value as TipoEvento
            setTipo(proximo)
            if (proximo !== 'AUSENCIA') setResponsavelId('')
          }}
          className={classeCampo}
        >
          {TIPOS_EVENTO.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </Campo>
      <p className="text-sm text-muted">{textoDoTipo(tipo)}</p>
      <Campo label="Nome" htmlFor="nome-evento">
        <input id="nome-evento" required value={nome} onChange={(event) => setNome(event.target.value)} className={classeCampo} />
      </Campo>
      <div className="grid gap-4 md:grid-cols-2">
        <Campo label="Data de início" htmlFor="data-inicio" dica="Horário de Brasília. O evento pode atravessar dias.">
          <input
            id="data-inicio"
            type="date"
            required
            min={dataInicio && dataInicio < hoje ? undefined : hoje}
            value={dataInicio}
            onChange={(event) => {
              const valor = event.target.value
              setDataInicio(valor)
              if (valor && (!dataFim || dataFim < valor)) setDataFim(valor)
            }}
            className={classeCampo}
          />
        </Campo>
        <Campo label="Horário de início" htmlFor="hora-inicio">
          <input
            id="hora-inicio"
            type="time"
            required
            value={horaInicio}
            onChange={(event) => setHoraInicio(event.target.value)}
            className={classeCampo}
          />
        </Campo>
        <Campo label="Data de fim" htmlFor="data-fim" dica="Não fica antes da data de início. No mesmo dia, o horário de fim precisa ser depois.">
          <input
            id="data-fim"
            type="date"
            required
            min={dataInicio || (dataFim && dataFim < hoje ? undefined : hoje)}
            value={dataFim}
            onChange={(event) => {
              const valor = event.target.value
              setDataFim(dataInicio && valor && valor < dataInicio ? dataInicio : valor)
            }}
            className={classeCampo}
          />
        </Campo>
        <Campo label="Horário de fim" htmlFor="hora-fim">
          <input
            id="hora-fim"
            type="time"
            required
            value={horaFim}
            onChange={(event) => setHoraFim(event.target.value)}
            className={classeCampo}
          />
        </Campo>
      </div>
      <Campo label="Contato (opcional)" htmlFor="contato-evento">
        <input id="contato-evento" value={contato} onChange={(event) => setContato(event.target.value)} className={classeCampo} />
      </Campo>
      {tipo === 'AUSENCIA' ? (
        <Campo label="Professor" htmlFor="resp-ausencia">
          <select
            id="resp-ausencia"
            required
            value={responsavelId}
            onChange={(event) => setResponsavelId(event.target.value)}
            className={classeCampo}
          >
            <option value="">Selecione</option>
            {professoresDe(responsaveis, evento?.responsavel).map((pessoa) => (
              <option key={pessoa.id} value={pessoa.id}>
                {pessoa.nome}
              </option>
            ))}
          </select>
        </Campo>
      ) : null}
      <div className="flex gap-2">
        <Botao type="submit" disabled={enviando}>
          {enviando ? 'Salvando…' : editando ? 'Salvar' : 'Agendar evento'}
        </Botao>
        <LinkBotao to={editando ? `/agenda?semana=${inicioDaSemana(dataInicio || hoje)}` : '/agenda/novo'} variante="secundario">
          {editando ? 'Voltar à agenda' : 'Voltar à escolha'}
        </LinkBotao>
      </div>
    </form>
  )
}

export function EditarEvento() {
  const { id = '' } = useParams()
  const consulta = useGet<Evento>(id ? `/api/eventos/${id}` : null)
  const evento = consulta.dados?.id === id ? consulta.dados : null
  useTitulo(evento ? `Editar ${evento.nome}` : 'Editar evento')
  const volta = evento ? `/agenda?semana=${inicioDaSemana(partesSP(evento.inicio).data)}` : '/agenda'

  return (
    <div>
      <Cabecalho
        sobretitulo="Planejamento"
        titulo="Editar evento"
        descricao={evento?.nome}
        acoes={
          <LinkBotao to={volta} variante="secundario">
            Voltar à agenda
          </LinkBotao>
        }
      />
      {consulta.carregando && !evento ? <PainelEstado status>Carregando…</PainelEstado> : null}
      {consulta.erro && !evento ? (
        <PainelEstado>
          <p className="mb-3 text-clay">{consulta.erro}</p>
          <Botao variante="secundario" onClick={consulta.recarregar}>
            Tentar de novo
          </Botao>
        </PainelEstado>
      ) : null}
      {evento ? <FormEvento key={evento.id} evento={evento} /> : null}
    </div>
  )
}

function textoDoTipo(tipo: TipoEvento): string {
  const base = 'O horário impede uma aula nova, e uma aula já marcada impede este evento. Aulas que já existem não são canceladas.'
  if (tipo === 'AUSENCIA') return `${base} Informe o responsável da ausência.`
  return base
}
