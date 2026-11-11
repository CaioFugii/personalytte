import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { api, mensagemDeErro } from '../api/client'
import type { Aluno, DiaSemana, GrupoFixo, Responsavel } from '../api/types'
import { useGet } from '../api/useGet'
import { useConfirmacao } from '../componentes/confirmacao'
import { notificar, useNotificar } from '../componentes/toast'
import { Botao, Cabecalho, classeBusca, classeCampo, cx, PainelEstado, SeloCategoria, useTitulo } from '../componentes/ui'
import { useBusca } from '../lib/busca'
import { HORARIOS_OFERTA } from '../lib/ofertaHorarios'
import { DIAS } from '../lib/rotulos'

const DIAS_LISTA = DIAS.filter((dia) => dia.value !== 'dom')
const CURTO_DIA: Record<DiaSemana, string> = {
  seg: 'Seg',
  ter: 'Ter',
  qua: 'Qua',
  qui: 'Qui',
  sex: 'Sex',
  sab: 'Sáb',
  dom: 'Dom',
}

function horaDoGrupo(grupo: GrupoFixo): string {
  return grupo.horarioInicio.slice(0, 5)
}

function horasDaGrade(grupos: GrupoFixo[], buscaAtiva: boolean): string[] {
  const extras = grupos.map(horaDoGrupo)
  if (buscaAtiva) return [...new Set(extras)].sort()
  return [...new Set<string>([...HORARIOS_OFERTA, ...extras])].sort()
}

function chave(grupo: GrupoFixo): string {
  return `${grupo.dia}|${grupo.horarioInicio}|${grupo.responsavel.id}`
}

function corresponde(grupo: GrupoFixo, busca: string): boolean {
  const texto = busca.trim().toLowerCase()
  if (!texto) return true
  if (grupo.responsavel.nome.toLowerCase().includes(texto)) return true
  return grupo.alunos.some((aluno) => aluno.nome.toLowerCase().includes(texto))
}

export function Grupos() {
  useTitulo('Grupos')
  const { busca, texto, setTexto } = useBusca()
  const consulta = useGet<GrupoFixo[]>('/api/grupos/semana')
  const alunosQ = useGet<Aluno[]>('/api/alunos')
  const respQ = useGet<Responsavel[]>('/api/integrantes/responsaveis')
  const lista = Array.isArray(consulta.dados) ? consulta.dados : null
  const alunos = Array.isArray(alunosQ.dados) ? alunosQ.dados : []
  const professores = (Array.isArray(respQ.dados) ? respQ.dados : [])
    .filter((pessoa) => pessoa.funcao === 'PROFESSOR' || pessoa.funcao === 'SOCIO')
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  const visiveis = lista?.filter((grupo) => corresponde(grupo, busca)) ?? []
  const [pendente, setPendente] = useState<string | null>(null)
  const [aberto, setAberto] = useState<GrupoFixo | null>(null)
  const [novo, setNovo] = useState<{ dia: DiaSemana; horario: string } | null>(null)
  const [confirmando, setConfirmando] = useState(false)
  const listaVista = useRef(lista)
  const { pedir, dialogo } = useConfirmacao()
  useNotificar(consulta.dados && !lista ? 'erro' : null, 'A resposta da lista veio em um formato inesperado.')
  useNotificar(lista && respQ.erro ? 'erro' : null, respQ.erro)
  const erroCarga = !lista ? consulta.erro || alunosQ.erro : null

  useEffect(() => {
    if (!aberto || !lista || lista === listaVista.current) return
    listaVista.current = lista
    const mesmo = lista.find((grupo) => chave(grupo) === chave(aberto))
    if (mesmo) setAberto(mesmo)
    else setAberto(null)
  }, [lista, aberto])

  function opcoesProfessor(grupo: GrupoFixo): Responsavel[] {
    if (professores.some((pessoa) => pessoa.id === grupo.responsavel.id)) return professores
    const atual: Responsavel = { id: grupo.responsavel.id, nome: grupo.responsavel.nome, funcao: 'PROFESSOR' }
    return [...professores, atual].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }

  async function trocarProfessor(grupo: GrupoFixo, novoResponsavelId: string) {
    if (!novoResponsavelId || novoResponsavelId === grupo.responsavel.id) return
    const nome = opcoesProfessor(grupo).find((pessoa) => pessoa.id === novoResponsavelId)?.nome ?? 'o novo professor'
    setConfirmando(true)
    const confirma = await pedir({
      titulo: 'Trocar professor',
      mensagem: `Trocar o professor de ${rotuloDia(grupo.dia)} às ${grupo.horarioInicio} para ${nome}? As próximas aulas em Aguardando deste horário passam para esse professor. Aula já confirmada permanece.`,
      confirmar: 'Trocar',
    })
    setConfirmando(false)
    if (!confirma) return
    setPendente(chave(grupo))
    try {
      await api('/api/grupos/semana', {
        method: 'PATCH',
        body: JSON.stringify({
          dia: grupo.dia,
          horarioInicio: grupo.horarioInicio,
          responsavelId: grupo.responsavel.id,
          novoResponsavelId,
        }),
      })
      setAberto({ ...grupo, responsavel: { id: novoResponsavelId, nome } })
      notificar('ok', 'Professor atualizado.')
      consulta.recarregar()
    } catch (erro) {
      notificar('erro', mensagemDeErro(erro))
    } finally {
      setPendente(null)
    }
  }

  async function alterarLimite(grupo: GrupoFixo, capacidade: number) {
    if (capacidade === grupo.capacidade) return
    setConfirmando(true)
    const confirma = await pedir({
      titulo: capacidade > grupo.capacidade ? 'Ampliar grupo' : 'Reduzir grupo',
      mensagem: capacidade > grupo.capacidade
        ? `Ampliar ${rotuloDia(grupo.dia)} às ${grupo.horarioInicio} para ${capacidade} alunos? As próximas aulas deste horário passam a ter esse limite.`
        : `Reduzir ${rotuloDia(grupo.dia)} às ${grupo.horarioInicio} para ${capacidade} alunos? Só é possível se o horário tiver no máximo ${capacidade} alunos.`,
      confirmar: capacidade > grupo.capacidade ? 'Ampliar' : 'Reduzir',
    })
    setConfirmando(false)
    if (!confirma) return
    setPendente(chave(grupo))
    try {
      await api('/api/grupos/semana', {
        method: 'PATCH',
        body: JSON.stringify({
          dia: grupo.dia,
          horarioInicio: grupo.horarioInicio,
          responsavelId: grupo.responsavel.id,
          capacidade,
        }),
      })
      notificar('ok', 'Limite atualizado.')
      consulta.recarregar()
    } catch (erro) {
      notificar('erro', mensagemDeErro(erro))
    } finally {
      setPendente(null)
    }
  }

  async function criar(dia: DiaSemana, dados: { horarioInicio: string; responsavelId: string; capacidade: number; alunoIds: string[] }) {
    setPendente('novo')
    try {
      await api('/api/grupos/semana', {
        method: 'POST',
        body: JSON.stringify({ dia, ...dados }),
      })
      notificar('ok', 'Grupo criado.')
      setNovo(null)
      consulta.recarregar()
    } catch (erro) {
      notificar('erro', mensagemDeErro(erro))
    } finally {
      setPendente(null)
    }
  }

  async function adicionar(grupo: GrupoFixo, alunoId: string) {
    if (!alunoId) return
    setPendente(chave(grupo))
    try {
      await api('/api/grupos/semana/alunos', {
        method: 'POST',
        body: JSON.stringify({
          dia: grupo.dia,
          horarioInicio: grupo.horarioInicio,
          responsavelId: grupo.responsavel.id,
          alunoId,
        }),
      })
      notificar('ok', 'Aluno adicionado ao grupo.')
      consulta.recarregar()
    } catch (erro) {
      notificar('erro', mensagemDeErro(erro))
    } finally {
      setPendente(null)
    }
  }

  async function remover(grupo: GrupoFixo, aluno: GrupoFixo['alunos'][number]) {
    setConfirmando(true)
    const confirma = await pedir({
      titulo: 'Remover aluno',
      mensagem: `Remover ${aluno.nome} de ${rotuloDia(grupo.dia)} às ${grupo.horarioInicio}? As próximas aulas em Aguardando deste horário saem da agenda.`,
      confirmar: 'Remover',
      perigo: true,
    })
    setConfirmando(false)
    if (!confirma) return
    setPendente(`${chave(grupo)}:${aluno.id}`)
    try {
      await api('/api/grupos/semana/alunos', {
        method: 'DELETE',
        body: JSON.stringify({
          dia: grupo.dia,
          horarioInicio: grupo.horarioInicio,
          responsavelId: grupo.responsavel.id,
          alunoId: aluno.id,
        }),
      })
      notificar('ok', 'Aluno removido do grupo.')
      consulta.recarregar()
    } catch (erro) {
      notificar('erro', mensagemDeErro(erro))
    } finally {
      setPendente(null)
    }
  }

  return (
    <div>
      {dialogo}
      {novo ? (
        <NovoGrupo
          dia={novo.dia}
          horarioInicial={novo.horario}
          alunos={alunos.filter((aluno) => aluno.ativo)}
          professores={professores}
          pendente={pendente !== null}
          onFechar={() => setNovo(null)}
          onCriar={(dados) => void criar(novo.dia, dados)}
        />
      ) : null}
      {aberto ? (
        <EditorGrupo
          grupo={aberto}
          alunos={alunos}
          professores={opcoesProfessor(aberto)}
          pendente={pendente !== null}
          bloquearEscape={confirmando}
          onFechar={() => setAberto(null)}
          onTrocarProfessor={(id) => void trocarProfessor(aberto, id)}
          onAlterarLimite={(capacidade) => void alterarLimite(aberto, capacidade)}
          onAdicionar={(alunoId) => void adicionar(aberto, alunoId)}
          onRemover={(aluno) => void remover(aberto, aluno)}
        />
      ) : null}
      <Cabecalho
        sobretitulo="Gestão"
        titulo="Grupos"
        descricao="De segunda a sábado, com o horário à esquerda e o dia em cima. Novo grupo cria um horário fixo. Editar abre o professor, o limite e os alunos. As próximas aulas em Aguardando acompanham essa lista."
      />
      <form role="search" className="mb-4" onSubmit={(event) => event.preventDefault()}>
        <label htmlFor="busca-grupos" className="sr-only">
          Busca
        </label>
        <input
          id="busca-grupos"
          value={texto}
          onChange={(event) => setTexto(event.target.value)}
          placeholder="Professor ou aluno"
          className={classeBusca}
        />
      </form>
      {(consulta.carregando || alunosQ.carregando) && !lista ? <PainelEstado status>Carregando…</PainelEstado> : null}
      {erroCarga ? (
        <PainelEstado>
          <p className="mb-3 text-clay">{erroCarga}</p>
          <Botao
            variante="secundario"
            onClick={() => {
              consulta.recarregar()
              alunosQ.recarregar()
            }}
          >
            Tentar de novo
          </Botao>
        </PainelEstado>
      ) : null}
      {lista ? (
        <GradeGrupos
          grupos={visiveis}
          busca={busca}
          onEditar={setAberto}
          onNovo={(dia, horario) => setNovo({ dia, horario })}
        />
      ) : null}
    </div>
  )
}

function GradeGrupos({
  grupos,
  busca,
  onEditar,
  onNovo,
}: {
  grupos: GrupoFixo[]
  busca: string
  onEditar: (grupo: GrupoFixo) => void
  onNovo: (dia: DiaSemana, horario: string) => void
}) {
  const horas = horasDaGrade(grupos, Boolean(busca.trim()))
  return (
    <div className="overflow-x-auto rounded-3xl bg-paper p-4 shadow-[0_10px_28px_rgba(14,60,67,0.06)]">
      {horas.length === 0 ? <p className="text-muted">Nenhum grupo encontrado.</p> : null}
      {horas.length > 0 ? (
        <table className="w-full min-w-[72rem] table-fixed border-separate border-spacing-1 text-left">
          <caption className="sr-only">Grupos de segunda a sábado, com o horário à esquerda.</caption>
          <thead>
            <tr>
              <th scope="col" className="w-16">
                <span className="sr-only">Horário</span>
              </th>
              {DIAS_LISTA.map((dia) => (
                <th key={dia.value} scope="col" className="rounded-xl px-2 py-2 text-center text-ink">
                  <span className="block text-xs font-semibold tracking-wide uppercase">{CURTO_DIA[dia.value]}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {horas.map((hora) => (
              <tr key={hora}>
                <th scope="row" className="pr-2 text-right text-sm font-bold tabular-nums text-tide-dark">
                  {hora}
                </th>
                {DIAS_LISTA.map((dia) => {
                  const doHorario = grupos
                    .filter((grupo) => grupo.dia === dia.value && horaDoGrupo(grupo) === hora)
                    .sort((a, b) => a.responsavel.nome.localeCompare(b.responsavel.nome, 'pt-BR'))
                  return (
                    <td key={dia.value} className="rounded-xl align-top">
                      <div className="grid gap-1.5">
                        {doHorario.map((grupo) => {
                          const cheio = grupo.alunos.length >= grupo.capacidade
                          return (
                            <section
                              key={chave(grupo)}
                              className={cx('rounded-xl px-2 py-1.5 text-xs', cheio ? 'bg-blush' : 'border border-line bg-sand')}
                            >
                              <div className="flex items-start justify-between gap-1">
                                <p className="font-semibold text-ink">{grupo.responsavel.nome}</p>
                                <button
                                  type="button"
                                  className="shrink-0 rounded-full border border-line bg-paper px-2 py-0.5 text-[10px] font-semibold text-tide-dark hover:bg-sand"
                                  onClick={() => onEditar(grupo)}
                                >
                                  Editar
                                </button>
                              </div>
                              <p className={cx('mt-0.5 tabular-nums', cheio ? 'font-semibold text-clay' : 'text-muted')}>
                                {grupo.alunos.length} de {grupo.capacidade}
                                {cheio ? ' · Cheio' : ''}
                              </p>
                              <ul className="mt-1 grid gap-1">
                                {grupo.alunos.map((aluno) => (
                                  <li key={aluno.id} className="inline-flex min-w-0 flex-wrap items-center gap-1">
                                    <span className="truncate">{aluno.nome}</span>
                                    <SeloCategoria categoria={aluno.categoria} />
                                  </li>
                                ))}
                              </ul>
                            </section>
                          )
                        })}
                        {busca.trim() || doHorario.length > 0 ? null : (
                          <button
                            type="button"
                            className="rounded-xl bg-sand px-2 py-1.5 text-left text-xs font-semibold text-muted hover:text-tide-dark"
                            onClick={() => onNovo(dia.value, hora)}
                          >
                            Novo grupo
                          </button>
                        )}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  )
}

function NovoGrupo({
  dia,
  horarioInicial,
  alunos,
  professores,
  pendente,
  onFechar,
  onCriar,
}: {
  dia: DiaSemana
  horarioInicial: string
  alunos: Aluno[]
  professores: Responsavel[]
  pendente: boolean
  onFechar: () => void
  onCriar: (dados: { horarioInicio: string; responsavelId: string; capacidade: number; alunoIds: string[] }) => void
}) {
  const tituloId = useId()
  const fecharRef = useRef<HTMLButtonElement>(null)
  const rotulo = rotuloDia(dia)
  const [horarioInicio, setHorarioInicio] = useState(horarioInicial)
  const [responsavelId, setResponsavelId] = useState('')
  const [capacidade, setCapacidade] = useState<4 | 6>(4)
  const [escolhidos, setEscolhidos] = useState<Aluno[]>([])
  const disponiveis = alunos
    .filter((aluno) => !escolhidos.some((item) => item.id === aluno.id))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  const cheio = escolhidos.length >= capacidade

  useEffect(() => {
    fecharRef.current?.focus()
    const anterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function aoTecla(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onFechar()
    }
    document.addEventListener('keydown', aoTecla)
    return () => {
      document.body.style.overflow = anterior
      document.removeEventListener('keydown', aoTecla)
    }
  }, [onFechar])

  function criar() {
    if (!horarioInicio) {
      notificar('erro', 'Informe o horário.')
      return
    }
    if (!responsavelId) {
      notificar('erro', 'Informe o professor.')
      return
    }
    if (escolhidos.length === 0) {
      notificar('erro', 'Informe ao menos um aluno.')
      return
    }
    if (escolhidos.length > capacidade) {
      notificar('erro', `O limite comporta até ${capacidade} alunos.`)
      return
    }
    onCriar({
      horarioInicio: horarioInicio.slice(0, 5),
      responsavelId,
      capacidade,
      alunoIds: escolhidos.map((aluno) => aluno.id),
    })
  }

  return createPortal(
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/40 p-4" onMouseDown={onFechar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-paper p-6 shadow-[0_24px_60px_rgba(14,60,67,0.18)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold tracking-[0.16em] text-tide uppercase">Grupo</p>
            <h2 id={tituloId} className="text-2xl font-bold tracking-tight">
              Novo grupo de {rotulo}
            </h2>
          </div>
          <button ref={fecharRef} type="button" className="text-sm font-semibold text-muted" onClick={onFechar}>
            Fechar
          </button>
        </div>
        <div className="mt-4 grid gap-4">
          <label className="grid gap-1 text-sm font-semibold" htmlFor="novo-horario">
            Horário
            <input
              id="novo-horario"
              type="time"
              className={classeCampo}
              value={horarioInicio}
              disabled={pendente}
              onChange={(event) => setHorarioInicio(event.target.value)}
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold" htmlFor="novo-professor">
            Professor
            <select
              id="novo-professor"
              className={classeCampo}
              value={responsavelId}
              disabled={pendente}
              onChange={(event) => setResponsavelId(event.target.value)}
            >
              <option value="">Selecione</option>
              {professores.map((pessoa) => (
                <option key={pessoa.id} value={pessoa.id}>
                  {pessoa.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold" htmlFor="novo-limite">
            Limite de alunos
            <select
              id="novo-limite"
              className={classeCampo}
              value={capacidade}
              disabled={pendente}
              onChange={(event) => setCapacidade(event.target.value === '6' ? 6 : 4)}
            >
              <option value={4}>4 alunos</option>
              <option value={6}>6 alunos</option>
            </select>
          </label>
          <div>
            <p className="text-sm font-semibold">Alunos</p>
            <ul className="mt-2 grid gap-2">
              {escolhidos.map((aluno) => (
                <li key={aluno.id} className="flex items-center justify-between gap-2">
                  <span className="inline-flex min-w-0 flex-wrap items-center gap-1">
                    <span className="truncate">{aluno.nome}</span>
                    <SeloCategoria categoria={aluno.categoria} />
                  </span>
                  <button
                    type="button"
                    className="shrink-0 text-xs font-semibold text-clay disabled:opacity-50"
                    disabled={pendente}
                    onClick={() => setEscolhidos((atual) => atual.filter((item) => item.id !== aluno.id))}
                  >
                    Remover
                  </button>
                </li>
              ))}
            </ul>
            <label className="sr-only" htmlFor="novo-aluno">
              Adicionar aluno
            </label>
            <select
              id="novo-aluno"
              className={`${classeCampo} mt-3`}
              value=""
              disabled={cheio || pendente || disponiveis.length === 0}
              onChange={(event) => {
                const aluno = alunos.find((item) => item.id === event.target.value)
                if (!aluno) return
                setEscolhidos((atual) => [...atual, aluno].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')))
              }}
            >
              <option value="">{cheio ? 'Grupo cheio' : 'Adicionar aluno'}</option>
              {disponiveis.map((aluno) => (
                <option key={aluno.id} value={aluno.id}>
                  {aluno.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end">
            <Botao type="button" disabled={pendente} onClick={criar}>
              {pendente ? 'Salvando…' : 'Criar grupo'}
            </Botao>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function EditorGrupo({
  grupo,
  alunos,
  professores,
  pendente,
  bloquearEscape,
  onFechar,
  onTrocarProfessor,
  onAlterarLimite,
  onAdicionar,
  onRemover,
}: {
  grupo: GrupoFixo
  alunos: Aluno[]
  professores: Responsavel[]
  pendente: boolean
  bloquearEscape: boolean
  onFechar: () => void
  onTrocarProfessor: (responsavelId: string) => void
  onAlterarLimite: (capacidade: number) => void
  onAdicionar: (alunoId: string) => void
  onRemover: (aluno: GrupoFixo['alunos'][number]) => void
}) {
  const tituloId = useId()
  const fecharRef = useRef<HTMLButtonElement>(null)
  const dia = rotuloDia(grupo.dia)
  const fora = alunos
    .filter((aluno) => !grupo.alunos.some((item) => item.id === aluno.id))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  const cheio = grupo.alunos.length >= grupo.capacidade

  useEffect(() => {
    fecharRef.current?.focus()
    const anterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function aoTecla(event: KeyboardEvent) {
      if (event.key !== 'Escape' || bloquearEscape) return
      event.preventDefault()
      onFechar()
    }
    document.addEventListener('keydown', aoTecla)
    return () => {
      document.body.style.overflow = anterior
      document.removeEventListener('keydown', aoTecla)
    }
  }, [bloquearEscape, onFechar])

  return createPortal(
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/40 p-4" onMouseDown={onFechar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-paper p-6 shadow-[0_24px_60px_rgba(14,60,67,0.18)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold tracking-[0.16em] text-tide uppercase">Grupo</p>
            <h2 id={tituloId} className="text-2xl font-bold tracking-tight">
              {dia.charAt(0).toUpperCase()}{dia.slice(1)} às {grupo.horarioInicio}
            </h2>
          </div>
          <button ref={fecharRef} type="button" className="text-sm font-semibold text-muted" onClick={onFechar}>
            Fechar
          </button>
        </div>
        <div className="mt-4 grid gap-4">
          <label className="grid gap-1 text-sm font-semibold" htmlFor="editor-professor">
            Professor
            <select
              id="editor-professor"
              className={classeCampo}
              value={grupo.responsavel.id}
              disabled={pendente}
              onChange={(event) => onTrocarProfessor(event.target.value)}
            >
              {professores.map((pessoa) => (
                <option key={pessoa.id} value={pessoa.id}>
                  {pessoa.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold" htmlFor="editor-limite">
            Limite de alunos
            <select
              id="editor-limite"
              className={classeCampo}
              value={grupo.capacidade}
              disabled={pendente}
              onChange={(event) => onAlterarLimite(Number(event.target.value))}
            >
              <option value={4} disabled={grupo.alunos.length > 4}>4 alunos</option>
              <option value={6}>6 alunos</option>
            </select>
          </label>
          <div>
            <p className="text-sm font-semibold">Alunos</p>
            <p className="mt-1 text-xs text-muted tabular-nums">{grupo.alunos.length} de {grupo.capacidade}</p>
            <ul className="mt-2 grid gap-2">
              {grupo.alunos.map((aluno) => (
                <li key={aluno.id} className="flex items-center justify-between gap-2">
                  <span className="inline-flex min-w-0 flex-wrap items-center gap-1">
                    <span className="truncate">{aluno.nome}</span>
                    <SeloCategoria categoria={aluno.categoria} />
                  </span>
                  <button
                    type="button"
                    className="shrink-0 text-xs font-semibold text-clay disabled:opacity-50"
                    disabled={pendente}
                    onClick={() => onRemover(aluno)}
                  >
                    Remover
                  </button>
                </li>
              ))}
            </ul>
            <label className="sr-only" htmlFor="editor-adicionar">
              Adicionar aluno
            </label>
            <select
              id="editor-adicionar"
              className={`${classeCampo} mt-3`}
              value=""
              disabled={cheio || pendente || fora.length === 0}
              onChange={(event) => onAdicionar(event.target.value)}
            >
              <option value="">{cheio ? 'Grupo cheio' : 'Adicionar aluno'}</option>
              {fora.map((aluno) => (
                <option key={aluno.id} value={aluno.id}>
                  {aluno.nome}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function rotuloDia(dia: DiaSemana): string {
  return DIAS.find((item) => item.value === dia)?.label.toLowerCase() ?? dia
}
