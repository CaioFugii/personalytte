import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api, mensagemDeErro, temId } from '../api/client'
import type { Aluno, Evento, Responsavel, TipoEvento } from '../api/types'
import { useGet } from '../api/useGet'
import {
  Banner,
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
import { civilValida, hojeSP, instanteBrasilia, partesSP } from '../lib/calendario'
import { rotuloFuncao, TIPOS_EVENTO } from '../lib/rotulos'

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
  const [alunoId, setAlunoId] = useState('')
  const [telefone, setTelefone] = useState('')
  const [aberto, setAberto] = useState(false)
  const [responsavelId, setResponsavelId] = useState('')
  const [data, setData] = useState('')
  const [hora, setHora] = useState('')
  const [experimental, setExperimental] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const sugestoes = useMemo(() => {
    const consulta = texto.trim().toLowerCase()
    const digitos = texto.replace(/\D/g, '')
    return alunos
      .filter((aluno) => {
        if (!consulta) return true
        return (
          aluno.nome.toLowerCase().includes(consulta) ||
          (aluno.email ?? '').toLowerCase().includes(consulta) ||
          (digitos.length > 0 && aluno.telefone.includes(digitos))
        )
      })
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      .slice(0, 8)
  }, [alunos, texto])

  const peloNome = alunos.filter((aluno) => aluno.nome.trim().toLowerCase() === texto.trim().toLowerCase())
  const alunoEscolhido = alunoId || (peloNome.length === 1 ? peloNome[0].id : '')
  const cadastroTemporario = experimental && !alunoEscolhido
  const carregando = (alunosQ.carregando && !alunosQ.dados) || (respQ.carregando && !respQ.dados)
  const erroCarga = alunosQ.erro || respQ.erro

  function escolher(aluno: Aluno) {
    setAlunoId(aluno.id)
    setTexto(aluno.nome)
    setAberto(false)
  }

  async function aoEnviar(event: FormEvent) {
    event.preventDefault()
    const nome = texto.trim()
    const peloNome = alunos.filter((aluno) => aluno.nome.trim().toLowerCase() === nome.toLowerCase())
    const alunoEscolhido = alunoId || (peloNome.length === 1 ? peloNome[0].id : '')
    if (!responsavelId || !civilValida(data) || !hora || (!alunoEscolhido && !(experimental && nome))) {
      setErro(experimental ? 'Informe o aluno, o responsável, a data e o horário.' : 'Selecione um aluno cadastrado, o responsável, a data e o horário.')
      return
    }
    if (data < hoje) {
      setErro('Não é possível agendar uma data anterior a hoje.')
      return
    }
    setErro(null)
    setEnviando(true)
    const corpo: Record<string, unknown> = {
      responsavelId,
      inicio: instanteBrasilia(data, hora),
      experimental,
    }
    if (alunoEscolhido) corpo.alunoId = alunoEscolhido
    else corpo.alunoTemporario = { nome, telefone: telefone.trim() ? telefone.trim() : null }
    try {
      const criada = await api<unknown>('/api/aulas', {
        method: 'POST',
        body: JSON.stringify(corpo),
      })
      if (temId(criada)) navigate(`/agenda/aulas/${criada.id}`)
      else navigate(`/agenda/dia?date=${data}`)
    } catch (err) {
      setErro(mensagemDeErro(err))
      setEnviando(false)
    }
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
      {erro ? <Banner tom="erro">{erro}</Banner> : null}
      {!experimental && alunos.length === 0 ? <Banner tom="aviso">Não há aluno ativo para agendar.</Banner> : null}
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
        label="Aluno"
        htmlFor="aluno-aula"
        dica={
          experimental
            ? 'Busque um cadastrado ou digite o nome. Quem não está na lista vira cadastro temporário.'
            : 'Busque por nome, e-mail ou telefone e selecione.'
        }
      >
        <div className="relative">
          <input
            id="aluno-aula"
            role="combobox"
            aria-expanded={aberto}
            aria-autocomplete="list"
            aria-controls="sugestoes-aluno"
            value={texto}
            onChange={(event) => {
              setTexto(event.target.value)
              setAlunoId('')
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
                <li key={aluno.id} role="option" aria-selected={aluno.id === alunoId}>
                  <button
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault()
                      escolher(aluno)
                    }}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-sand"
                  >
                    {aluno.nome} · {aluno.categoria}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </Campo>
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
        <Campo label="Responsável" htmlFor="resp-aula">
          <select
            id="resp-aula"
            required
            value={responsavelId}
            onChange={(event) => setResponsavelId(event.target.value)}
            className={classeCampo}
          >
            <option value="">Selecione</option>
            {[...responsaveis]
              .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
              .map((pessoa) => (
                <option key={pessoa.id} value={pessoa.id}>
                  {pessoa.nome} · {rotuloFuncao(pessoa.funcao)}
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
        <Campo label="Horário" htmlFor="hora-aula">
          <input
            id="hora-aula"
            type="time"
            required
            value={hora}
            onChange={(event) => setHora(event.target.value)}
            className={classeCampo}
          />
        </Campo>
      </div>
      <div className="flex gap-2">
        <Botao type="submit" disabled={enviando || (!experimental && alunos.length === 0)}>
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
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function aoEnviar(event: FormEvent) {
    event.preventDefault()
    if (!nome.trim() || !civilValida(dataInicio) || !horaInicio || !civilValida(dataFim) || !horaFim) {
      setErro('Informe nome, início e fim.')
      return
    }
    if (tipo === 'AUSENCIA' && !responsavelId) {
      setErro('Informe o responsável da ausência.')
      return
    }
    if (dataFim < dataInicio) {
      setErro('A data de fim não pode ser anterior à data de início.')
      return
    }
    const mudouInicio = !inicioOriginal || dataInicio !== inicioOriginal.data || horaInicio !== inicioOriginal.hora
    const mudouFim = !fimOriginal || dataFim !== fimOriginal.data || horaFim !== fimOriginal.hora
    if ((mudouInicio && dataInicio < hoje) || (mudouFim && dataFim < hoje)) {
      setErro('Não é possível agendar uma data anterior a hoje.')
      return
    }
    const inicio = evento && !mudouInicio ? evento.inicio : instanteBrasilia(dataInicio, horaInicio)
    const fim = evento && !mudouFim ? evento.fim : instanteBrasilia(dataFim, horaFim)
    if (new Date(fim).getTime() <= new Date(inicio).getTime()) {
      setErro('O fim precisa ser posterior ao início.')
      return
    }
    setErro(null)
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
      navigate(`/agenda/dia?date=${dataInicio}`)
    } catch (err) {
      setErro(mensagemDeErro(err))
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={(event) => void aoEnviar(event)} className="grid max-w-3xl gap-4 rounded-2xl bg-paper p-5 shadow-[0_10px_28px_rgba(14,60,67,0.06)]">
      {erro ? <Banner tom="erro">{erro}</Banner> : null}
      {respQ.erro ? <Banner tom="erro">{respQ.erro}</Banner> : null}
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
        <Campo label="Responsável" htmlFor="resp-ausencia">
          <select
            id="resp-ausencia"
            required
            value={responsavelId}
            onChange={(event) => setResponsavelId(event.target.value)}
            className={classeCampo}
          >
            <option value="">Selecione</option>
            {[...responsaveis]
              .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
              .map((pessoa) => (
                <option key={pessoa.id} value={pessoa.id}>
                  {pessoa.nome} · {rotuloFuncao(pessoa.funcao)}
                </option>
              ))}
          </select>
        </Campo>
      ) : null}
      <div className="flex gap-2">
        <Botao type="submit" disabled={enviando}>
          {enviando ? 'Salvando…' : editando ? 'Salvar' : 'Agendar evento'}
        </Botao>
        <LinkBotao to={editando ? `/agenda/dia?date=${dataInicio || hoje}` : '/agenda/novo'} variante="secundario">
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
  const volta = evento ? `/agenda/dia?date=${partesSP(evento.inicio).data}` : '/agenda'

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
