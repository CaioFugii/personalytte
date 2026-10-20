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
import { civilValida, hojeSP, instanteBrasilia } from '../lib/calendario'
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
          Horário avulso. A experimental também aceita um nome ainda sem cadastro.
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
  const nomeTemporario = experimental && !alunoEscolhido && texto.trim().length > 0
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
    <form onSubmit={(event) => void aoEnviar(event)} className="grid max-w-3xl gap-4 rounded-lg border border-line bg-paper p-4">
      <p className="text-sm text-muted">A aula nasce como Aguardando, dura 60 minutos e fica fora do plano semanal.</p>
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
          {aberto && sugestoes.length > 0 ? (
            <ul
              id="sugestoes-aluno"
              role="listbox"
              className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-md border border-line bg-paper shadow-sm"
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
      {nomeTemporario ? (
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
  const [responsavelId, setResponsavelId] = useState('')
  const hoje = hojeSP()
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
    if (dataInicio < hoje || dataFim < hoje) {
      setErro('Não é possível agendar uma data anterior a hoje.')
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
            min={hoje}
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
            min={hoje}
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
  const base = 'O horário impede uma aula nova, e uma aula já marcada impede este evento. Aulas que já existem não são canceladas.'
  if (tipo === 'AUSENCIA') return `${base} Informe o responsável da ausência.`
  return base
}
