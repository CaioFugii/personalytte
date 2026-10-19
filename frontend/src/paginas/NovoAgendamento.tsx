import { useMemo, useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { api, mensagemDeErro, temId } from '../api/client'
import type { Aluno, Responsavel, TipoEvento } from '../api/types'
import { useGet } from '../api/useGet'
import {
  Banner,
  Botao,
  Cabecalho,
  Campo,
  classeCampo,
  LinkBotao,
  PainelEstado,
  useTitulo,
} from '../componentes/ui'
import { useSessao } from '../contexto/Sessao'
import { civilValida, instanteBrasilia } from '../lib/calendario'
import { rotuloFuncao, tipoBloqueia, TIPOS_EVENTO } from '../lib/rotulos'

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
      {tipo !== 'aula' && tipo !== 'evento' ? <Escolha admin={Boolean(admin)} /> : null}
    </div>
  )
}

function Escolha({ admin }: { admin: boolean }) {
  const [, setParams] = useSearchParams()
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <button
        type="button"
        onClick={() => setParams({ tipo: 'aula' })}
        className="rounded-lg border border-line bg-paper p-5 text-left hover:border-tide"
      >
        <span className="font-display text-2xl font-semibold">Aula</span>
        <span className="mt-2 block text-sm text-muted">
          Horário avulso de um aluno já cadastrado. Pode ser marcada como experimental.
        </span>
      </button>
      {admin ? (
        <button
          type="button"
          onClick={() => setParams({ tipo: 'evento' })}
          className="rounded-lg border border-line bg-paper p-5 text-left hover:border-tide"
        >
          <span className="font-display text-2xl font-semibold">Evento</span>
          <span className="mt-2 block text-sm text-muted">
            Feriado, agenda fechada, ausência de professor, aniversário ou torneio.
          </span>
        </button>
      ) : (
        <div className="rounded-lg border border-dashed border-line bg-paper/70 p-5">
          <span className="font-display text-2xl font-semibold text-muted">Evento</span>
          <span className="mt-2 block text-sm text-muted">Somente o administrador agenda eventos.</span>
        </div>
      )}
    </div>
  )
}

function FormAula() {
  const navigate = useNavigate()
  const alunosQ = useGet<Aluno[]>('/api/alunos')
  const respQ = useGet<Responsavel[]>('/api/integrantes/responsaveis')
  const alunos = Array.isArray(alunosQ.dados) ? alunosQ.dados : []
  const responsaveis = Array.isArray(respQ.dados) ? respQ.dados : []
  const [filtro, setFiltro] = useState('')
  const [alunoId, setAlunoId] = useState('')
  const [responsavelId, setResponsavelId] = useState('')
  const [data, setData] = useState('')
  const [hora, setHora] = useState('')
  const [experimental, setExperimental] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const visiveis = useMemo(() => {
    const texto = filtro.trim().toLowerCase()
    const digitos = filtro.replace(/\D/g, '')
    const lista = alunos.filter((aluno) => {
      if (!texto) return true
      return (
        aluno.nome.toLowerCase().includes(texto) ||
        (aluno.email ?? '').toLowerCase().includes(texto) ||
        (digitos.length > 0 && aluno.telefone.includes(digitos))
      )
    })
    if (alunoId && !lista.some((aluno) => aluno.id === alunoId)) {
      const escolhido = alunos.find((aluno) => aluno.id === alunoId)
      if (escolhido) lista.unshift(escolhido)
    }
    return [...lista].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [alunos, filtro, alunoId])

  const carregando = (alunosQ.carregando && !alunosQ.dados) || (respQ.carregando && !respQ.dados)
  const erroCarga = alunosQ.erro || respQ.erro

  async function aoEnviar(event: FormEvent) {
    event.preventDefault()
    if (!alunoId || !responsavelId || !civilValida(data) || !hora) {
      setErro('Informe aluno, responsável, data e horário.')
      return
    }
    setErro(null)
    setEnviando(true)
    try {
      const criada = await api<unknown>('/api/aulas', {
        method: 'POST',
        body: JSON.stringify({
          alunoId,
          responsavelId,
          inicio: instanteBrasilia(data, hora),
          experimental,
        }),
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
    <form onSubmit={(event) => void aoEnviar(event)} className="grid max-w-3xl gap-4 rounded-lg border border-line bg-paper p-4">
      <p className="text-sm text-muted">A aula nasce como Aguardando, dura 60 minutos e fica fora do plano semanal.</p>
      {erro ? <Banner tom="erro">{erro}</Banner> : null}
      {alunos.length === 0 ? <Banner tom="aviso">Não há aluno ativo para agendar.</Banner> : null}
      <Campo label="Buscar aluno" htmlFor="filtro-aluno" dica="Nome, e-mail ou telefone">
        <input id="filtro-aluno" value={filtro} onChange={(event) => setFiltro(event.target.value)} className={classeCampo} />
      </Campo>
      <div className="grid gap-4 md:grid-cols-2">
        <Campo label="Aluno" htmlFor="aluno-aula">
          <select
            id="aluno-aula"
            required
            value={alunoId}
            onChange={(event) => setAlunoId(event.target.value)}
            className={classeCampo}
          >
            <option value="">Selecione</option>
            {visiveis.map((aluno) => (
              <option key={aluno.id} value={aluno.id}>
                {aluno.nome} · {aluno.categoria}
              </option>
            ))}
          </select>
        </Campo>
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
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input
          type="checkbox"
          checked={experimental}
          onChange={(event) => setExperimental(event.target.checked)}
          className="accent-tide"
        />
        Aula experimental
      </label>
      <div className="flex gap-2">
        <Botao type="submit" disabled={enviando || alunos.length === 0}>
          {enviando ? 'Salvando…' : 'Agendar aula'}
        </Botao>
        <LinkBotao to="/agenda/novo" variante="secundario">
          Voltar à escolha
        </LinkBotao>
      </div>
    </form>
  )
}

function FormEvento() {
  const navigate = useNavigate()
  const respQ = useGet<Responsavel[]>('/api/integrantes/responsaveis')
  const responsaveis = Array.isArray(respQ.dados) ? respQ.dados : []
  const [tipo, setTipo] = useState<TipoEvento>('FERIADO')
  const [nome, setNome] = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [horaInicio, setHoraInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [horaFim, setHoraFim] = useState('')
  const [contato, setContato] = useState('')
  const [bloqueia, setBloqueia] = useState(false)
  const [responsavelId, setResponsavelId] = useState('')
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
    const inicio = instanteBrasilia(dataInicio, horaInicio)
    const fim = instanteBrasilia(dataFim, horaFim)
    if (new Date(fim).getTime() <= new Date(inicio).getTime()) {
      setErro('O fim precisa ser posterior ao início.')
      return
    }
    setErro(null)
    setEnviando(true)
    try {
      await api('/api/eventos', {
        method: 'POST',
        body: JSON.stringify({
          tipo,
          nome: nome.trim(),
          inicio,
          fim,
          contato: contato.trim() ? contato.trim() : null,
          bloqueiaAulas: tipoBloqueia(tipo) ? bloqueia : false,
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
    <form onSubmit={(event) => void aoEnviar(event)} className="grid max-w-3xl gap-4 rounded-lg border border-line bg-paper p-4">
      {erro ? <Banner tom="erro">{erro}</Banner> : null}
      {respQ.erro ? <Banner tom="erro">{respQ.erro}</Banner> : null}
      <Campo label="Tipo" htmlFor="tipo-evento">
        <select
          id="tipo-evento"
          value={tipo}
          onChange={(event) => {
            const proximo = event.target.value as TipoEvento
            setTipo(proximo)
            if (!tipoBloqueia(proximo)) setBloqueia(false)
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
            value={dataInicio}
            onChange={(event) => setDataInicio(event.target.value)}
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
        <Campo label="Data de fim" htmlFor="data-fim">
          <input
            id="data-fim"
            type="date"
            required
            value={dataFim}
            onChange={(event) => setDataFim(event.target.value)}
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
      {tipoBloqueia(tipo) ? (
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={bloqueia}
            onChange={(event) => setBloqueia(event.target.checked)}
            className="accent-tide"
          />
          Bloqueia aulas
        </label>
      ) : null}
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
          {enviando ? 'Salvando…' : 'Agendar evento'}
        </Botao>
        <LinkBotao to="/agenda/novo" variante="secundario">
          Voltar à escolha
        </LinkBotao>
      </div>
    </form>
  )
}

function textoDoTipo(tipo: TipoEvento): string {
  if (tipo === 'FERIADO' || tipo === 'AGENDA_FECHADA') {
    return 'Com o bloqueio ligado, uma aula nova nesse intervalo é recusada e as futuras em Aguardando ou Confirmada passam a Cancelada.'
  }
  if (tipo === 'AUSENCIA') {
    return 'A ausência cancela e bloqueia só as aulas desse responsável.'
  }
  return 'Aniversário e torneio aparecem na agenda. A aula desse horário continua válida.'
}
