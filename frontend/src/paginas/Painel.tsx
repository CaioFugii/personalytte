import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api, mensagemDeErro } from '../api/client'
import type { Aviso, Dashboard } from '../api/types'
import { useGet } from '../api/useGet'
import { AcoesEvento, ResumoEvento } from '../componentes/evento'
import { notificar, useNotificar } from '../componentes/toast'
import { LinkNovoAgendamento } from './NovoAgendamento'
import {
  Botao,
  Cabecalho,
  Campo,
  classeCampo,
  classeCartao,
  classeIconeAcao,
  cx,
  IconeLapis,
  IconeLixeira,
  PainelEstado,
  SeloCategoria,
  SeloStatus,
  useTitulo,
} from '../componentes/ui'
import { useConfirmacao } from '../componentes/confirmacao'
import { useSessao } from '../contexto/Sessao'
import { formatarDiaLongo, formatarIntervalo, hojeSP, partesSP, saudacao } from '../lib/calendario'

function ehPainel(valor: Dashboard | null): valor is Dashboard {
  if (!valor || typeof valor !== 'object') return false
  return (
    typeof valor.aulasHoje === 'number' &&
    typeof valor.confirmadas === 'number' &&
    typeof valor.alunosCadastrados === 'number' &&
    typeof valor.alunosDoDia === 'number' &&
    (valor.proximoHorario === null || typeof valor.proximoHorario === 'object') &&
    Array.isArray(valor.eventosDaSemana) &&
    Array.isArray(valor.avisos)
  )
}

function EditorAviso({
  inicial,
  salvando,
  onSalvar,
  onCancelar,
}: {
  inicial?: Aviso
  salvando: boolean
  onSalvar: (titulo: string, mensagem: string) => Promise<void>
  onCancelar: () => void
}) {
  const [titulo, setTitulo] = useState(inicial?.titulo ?? '')
  const [mensagem, setMensagem] = useState(inicial?.mensagem ?? '')

  async function aoEnviar(event: FormEvent) {
    event.preventDefault()
    if (!titulo.trim() || !mensagem.trim()) {
      notificar('erro', 'Informe o título e a mensagem.')
      return
    }
    await onSalvar(titulo.trim(), mensagem.trim())
  }

  return (
    <form onSubmit={(event) => void aoEnviar(event)} className="grid gap-3 rounded-2xl bg-sand/70 p-4">
      <Campo label="Título" htmlFor={inicial?.id ? `titulo-${inicial.id}` : 'titulo-novo'}>
        <input
          id={inicial?.id ? `titulo-${inicial.id}` : 'titulo-novo'}
          required
          value={titulo}
          onChange={(event) => setTitulo(event.target.value)}
          className={classeCampo}
        />
      </Campo>
      <Campo label="Mensagem" htmlFor={inicial?.id ? `mensagem-${inicial.id}` : 'mensagem-novo'}>
        <textarea
          id={inicial?.id ? `mensagem-${inicial.id}` : 'mensagem-novo'}
          required
          rows={4}
          value={mensagem}
          onChange={(event) => setMensagem(event.target.value)}
          className={classeCampo}
        />
      </Campo>
      <div className="flex flex-wrap gap-2">
        <Botao type="submit" disabled={salvando}>
          {salvando ? 'Salvando…' : 'Salvar aviso'}
        </Botao>
        <Botao variante="secundario" onClick={onCancelar}>
          Voltar
        </Botao>
      </div>
    </form>
  )
}

export function Painel() {
  useTitulo('Painel')
  const { usuario } = useSessao()
  const consulta = useGet<Dashboard>('/api/dashboard')
  const admin = usuario?.papel === 'administrador'
  const hoje = hojeSP()
  const [editor, setEditor] = useState<'novo' | string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const { pedir, dialogo } = useConfirmacao()
  const dados = ehPainel(consulta.dados) ? consulta.dados : null
  const formatoInvalido = Boolean(consulta.dados) && !dados
  useNotificar(formatoInvalido ? 'erro' : null, 'A resposta do painel veio em um formato inesperado.')

  async function salvarAviso(titulo: string, mensagem: string, id?: string) {
    setSalvando(true)
    try {
      if (id) {
        await api(`/api/avisos/${id}`, { method: 'PATCH', body: JSON.stringify({ titulo, mensagem }) })
      } else {
        await api('/api/avisos', { method: 'POST', body: JSON.stringify({ titulo, mensagem }) })
      }
      setEditor(null)
      consulta.recarregar()
    } catch (erro) {
      notificar('erro', mensagemDeErro(erro))
    } finally {
      setSalvando(false)
    }
  }

  async function apagarAviso(aviso: Aviso) {
    if (!aviso.id) return
    const confirma = await pedir({
      titulo: 'Apagar aviso',
      mensagem: 'Apagar este aviso? Ele sai do painel para toda a equipe.',
      confirmar: 'Apagar',
      perigo: true,
    })
    if (!confirma) return
    try {
      await api(`/api/avisos/${aviso.id}`, { method: 'DELETE' })
      if (editor === aviso.id) setEditor(null)
      consulta.recarregar()
    } catch (erro) {
      notificar('erro', mensagemDeErro(erro))
    }
  }

  return (
    <div>
      {dialogo}
      <Cabecalho
        sobretitulo="Visão geral"
        titulo={usuario ? `${saudacao()}, ${usuario.nome}` : 'Painel'}
        descricao={formatarDiaLongo(hoje)}
        acoes={<LinkNovoAgendamento />}
      />

      {consulta.carregando && !dados ? <PainelEstado status>Carregando…</PainelEstado> : null}
      {consulta.erro && !dados ? (
        <PainelEstado>
          <p className="mb-3 text-clay">{consulta.erro}</p>
          <Botao variante="secundario" onClick={consulta.recarregar}>
            Tentar de novo
          </Botao>
        </PainelEstado>
      ) : null}
      {dados ? (
        <div className="grid gap-6">
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Numero to={`/agenda/dia?date=${hoje}`} rotulo="Aulas hoje" valor={dados.aulasHoje} />
            <Numero to={`/agenda/dia?date=${hoje}`} rotulo="Confirmadas" valor={dados.confirmadas} />
            <Numero to="/alunos" rotulo="Alunos cadastrados" valor={dados.alunosCadastrados} />
            <Numero to={`/agenda/dia?date=${hoje}`} rotulo="Alunos do dia" valor={dados.alunosDoDia} />
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className={cx(classeCartao, 'p-5')}>
              <h2 className="text-xl font-bold">Próximo horário</h2>
              {dados.proximoHorario?.aluno && dados.proximoHorario.responsavel ? (
                <Link
                  to={`/agenda/aulas/${dados.proximoHorario.id}`}
                  className="mt-3 block rounded-md border border-line px-3 py-3 hover:border-tide"
                >
                  <p className="text-sm text-muted">{formatarIntervalo(dados.proximoHorario.inicio, dados.proximoHorario.fim)}</p>
                  <p className="mt-1 flex items-center gap-2 text-lg font-semibold">
                    {dados.proximoHorario.aluno.nome}
                    <SeloCategoria categoria={dados.proximoHorario.aluno.categoria} />
                  </p>
                  <p className="text-sm text-muted">Responsável: {dados.proximoHorario.responsavel.nome}</p>
                  <div className="mt-2">
                    <SeloStatus status={dados.proximoHorario.status} />
                  </div>
                </Link>
              ) : (
                <p className="mt-3 text-muted">Nenhuma aula por vir agora.</p>
              )}
            </section>

            <section className={cx(classeCartao, 'p-5')}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-xl font-bold">Eventos da semana</h2>
                <Link to="/agenda" className="text-sm font-semibold text-tide-dark">
                  Abrir a semana
                </Link>
              </div>
              {dados.eventosDaSemana.length === 0 ? (
                <p className="text-muted">Nenhum evento nesta semana.</p>
              ) : (
                <ul className="grid gap-2">
                  {dados.eventosDaSemana.map((evento, indice) => (
                    <li key={evento.id ?? `${evento.inicio}-${indice}`} className="relative">
                      <ResumoEvento
                        evento={evento}
                        nomes={new Map()}
                        href={`/agenda/dia?date=${partesSP(evento.inicio).data}`}
                        className={admin ? 'pr-20' : undefined}
                      />
                      {admin ? (
                        <div className="absolute top-2 right-2">
                          <AcoesEvento
                            evento={evento}
                            onApagado={consulta.recarregar}
                            onErro={(mensagem) => {
                              if (mensagem) notificar('erro', mensagem)
                            }}
                          />
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section className={cx(classeCartao, 'p-5')}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-bold">Avisos</h2>
              {admin && editor !== 'novo' ? (
                <Botao onClick={() => setEditor('novo')}>
                  Novo aviso
                </Botao>
              ) : null}
            </div>
            {editor === 'novo' ? (
              <div className="mb-4">
                <EditorAviso
                  salvando={salvando}
                  onCancelar={() => setEditor(null)}
                  onSalvar={(titulo, mensagem) => salvarAviso(titulo, mensagem)}
                />
              </div>
            ) : null}
            {dados.avisos.length === 0 ? (
              <p className="text-muted">Nenhum aviso no momento.</p>
            ) : (
              <ul className="grid gap-3">
                {dados.avisos.map((aviso, indice) => (
                  <li key={aviso.id ?? `aviso-${indice}`} className="relative rounded-2xl bg-sand px-4 py-3">
                    {editor === aviso.id && aviso.id ? (
                      <EditorAviso
                        inicial={aviso}
                        salvando={salvando}
                        onCancelar={() => setEditor(null)}
                        onSalvar={(titulo, mensagem) => salvarAviso(titulo, mensagem, aviso.id)}
                      />
                    ) : (
                      <>
                        {admin && aviso.id ? (
                          <div className="absolute top-3 right-3 flex gap-1">
                            <Botao
                              variante="secundario"
                              className={classeIconeAcao}
                              aria-label={`Editar ${aviso.titulo}`}
                              title="Editar"
                              onClick={() => setEditor(aviso.id ?? null)}
                            >
                              <IconeLapis />
                            </Botao>
                            <Botao
                              variante="perigo"
                              className={classeIconeAcao}
                              aria-label={`Apagar ${aviso.titulo}`}
                              title="Apagar"
                              onClick={() => void apagarAviso(aviso)}
                            >
                              <IconeLixeira />
                            </Botao>
                          </div>
                        ) : null}
                        <h3 className={cx('font-semibold', admin && aviso.id && 'pr-20')}>{aviso.titulo}</h3>
                        <p className={cx('mt-1 whitespace-pre-wrap text-sm', admin && aviso.id && 'pr-20')}>{aviso.mensagem}</p>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}
    </div>
  )
}

function Numero({ to, rotulo, valor }: { to: string; rotulo: string; valor: number }) {
  return (
    <Link to={to} className={cx(classeCartao, 'px-5 py-4')}>
      <p className="text-4xl leading-none font-bold tabular-nums">{Number.isFinite(valor) ? valor : '—'}</p>
      <p className="mt-2 text-sm text-muted">{rotulo}</p>
    </Link>
  )
}
