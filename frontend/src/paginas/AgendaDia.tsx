import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, mensagemDeErro } from '../api/client'
import type { Aula, Responsavel, StatusAula } from '../api/types'
import { useAgenda } from '../api/useAgenda'
import { useGet } from '../api/useGet'
import { ModalCancelamento, type DadosCancelamento } from '../componentes/cancelamento'
import { ModalTextoAgenda } from '../componentes/exportarAgenda'
import { AcoesEvento, ResumoEvento } from '../componentes/evento'
import { notificar } from '../componentes/toast'
import { textoAgendaDia } from '../lib/exportarAgendaDia'
import {
  Botao,
  Cabecalho,
  classeFundoAula,
  classeSeloAula,
  classeTabela,
  classeThead,
  cx,
  Marcadores,
  PainelEstado,
  SeloCategoria,
  useTitulo,
} from '../componentes/ui'
import { useSessao } from '../contexto/Sessao'
import { addDias, civilValida, formatarDiaLongo, formatarHora, hojeSP, inicioDaSemana } from '../lib/calendario'
import { STATUS } from '../lib/rotulos'
import { Abas } from './AgendaSemana'
import { LinkNovoAgendamento } from './NovoAgendamento'

export function AgendaDia() {
  useTitulo('Agenda do dia')
  const [params, setParams] = useSearchParams()
  const bruta = params.get('date')
  const data = bruta && civilValida(bruta) ? bruta : hojeSP()
  const agenda = useAgenda(data, data)
  const respQ = useGet<Responsavel[]>('/api/integrantes/responsaveis')
  const { usuario } = useSessao()
  const admin = usuario?.papel === 'administrador'
  const [pendente, setPendente] = useState<string | null>(null)
  const [aulaCancelando, setAulaCancelando] = useState<Aula | null>(null)
  const [textoExportado, setTextoExportado] = useState<string | null>(null)

  const professores = useMemo(
    () =>
      (Array.isArray(respQ.dados) ? respQ.dados : [])
        .filter((item) => item.funcao === 'PROFESSOR')
        .map((item) => ({ id: item.id, nome: item.nome }))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [respQ.dados],
  )

  useEffect(() => {
    if (bruta !== null && !civilValida(bruta)) {
      setParams({ date: hojeSP() }, { replace: true })
    }
  }, [bruta, setParams])

  function ir(proxima: string) {
    setParams({ date: proxima })
  }

  async function copiarTexto(texto: string) {
    try {
      await navigator.clipboard.writeText(texto)
      notificar('ok', 'Texto copiado. Cole no WhatsApp.')
    } catch {
      notificar('aviso', 'Selecione o texto e copie.')
    }
  }

  function abrirTexto() {
    const texto = textoAgendaDia(agenda.aulas)
    setTextoExportado(texto)
    void copiarTexto(texto)
  }

  async function mudarStatus(aula: Aula, status: StatusAula) {
    if (status === aula.status || pendente) return
    if (status === 'CANCELADA') {
      setAulaCancelando(aula)
      return
    }
    setPendente(aula.id)
    try {
      await api(`/api/aulas/${aula.id}`, { method: 'PATCH', body: JSON.stringify({ status }) })
      agenda.recarregar()
    } catch (erro) {
      notificar('erro', mensagemDeErro(erro))
    } finally {
      setPendente(null)
    }
  }

  async function cancelar(dados: DadosCancelamento) {
    if (!aulaCancelando || aulaCancelando.status === 'CANCELADA') return
    setPendente(aulaCancelando.id)
    try {
      await api(`/api/aulas/${aulaCancelando.id}/cancelar`, { method: 'POST', body: JSON.stringify(dados) })
      setAulaCancelando(null)
      agenda.recarregar()
    } catch (erro) {
      notificar('erro', mensagemDeErro(erro))
    } finally {
      setPendente(null)
    }
  }

  const carregandoLista = agenda.carregando && agenda.aulas.length === 0 && agenda.eventos.length === 0

  return (
    <div>
      {aulaCancelando ? (
        <ModalCancelamento
          professores={professores}
          professorPadrao={professores.some((item) => item.id === aulaCancelando.responsavel.id) ? aulaCancelando.responsavel.id : ''}
          enviando={pendente === aulaCancelando.id}
          onConfirmar={(dados) => void cancelar(dados)}
          onFechar={() => {
            if (!pendente) setAulaCancelando(null)
          }}
        />
      ) : null}
      {textoExportado !== null ? (
        <ModalTextoAgenda
          texto={textoExportado}
          onCopiar={() => void copiarTexto(textoExportado)}
          onFechar={() => setTextoExportado(null)}
        />
      ) : null}
      <Cabecalho
        sobretitulo="Planejamento"
        titulo="Agenda do dia"
        descricao={formatarDiaLongo(data)}
        acoes={
          <>
            <Botao variante="secundario" onClick={() => ir(addDias(data, -1))}>
              Anterior
            </Botao>
            <Botao variante="secundario" onClick={() => ir(hojeSP())}>
              Hoje
            </Botao>
            <Botao variante="secundario" onClick={() => ir(addDias(data, 1))}>
              Próximo
            </Botao>
            <label className="sr-only" htmlFor="data-dia">
              Data
            </label>
            <input
              id="data-dia"
              type="date"
              value={data}
              onChange={(event) => {
                if (civilValida(event.target.value)) ir(event.target.value)
              }}
              className="h-10 rounded-full border border-line bg-paper px-3 text-sm"
            />
            <Botao variante="secundario" disabled={carregandoLista || Boolean(agenda.erro)} onClick={abrirTexto}>
              Copiar texto
            </Botao>
            <LinkNovoAgendamento />
          </>
        }
      />
      <Abas
        semana={`/agenda?semana=${inicioDaSemana(data)}`}
        dia={`/agenda/dia?date=${data}`}
        vagas={`/agenda/vagas?semana=${inicioDaSemana(data)}`}
        atual="dia"
      />

      {carregandoLista ? <PainelEstado status>Carregando…</PainelEstado> : null}
      {agenda.erro ? (
        <PainelEstado>
          <p className="mb-3 text-clay">{agenda.erro}</p>
          <Botao variante="secundario" onClick={agenda.recarregar}>
            Tentar de novo
          </Botao>
        </PainelEstado>
      ) : null}

      {!agenda.erro && !carregandoLista ? (
        <div className="grid gap-6">
          {agenda.carregando ? (
            <p role="status" className="text-sm text-muted">
              Atualizando…
            </p>
          ) : null}
          <section>
            <h2 className="mb-2 text-xl font-bold">Eventos</h2>
            {agenda.eventos.length === 0 ? (
              <p className="text-muted">Nenhum evento neste dia.</p>
            ) : (
              <ul className="grid gap-2">
                {agenda.eventos.map((evento, indice) => (
                  <li key={evento.id ?? `${evento.inicio}-${indice}`} className="relative">
                    <ResumoEvento evento={evento} nomes={agenda.nomes} dia={data} className={admin ? 'pr-20' : undefined} />
                    {admin ? (
                      <div className="absolute top-2 right-2">
                        <AcoesEvento
                          evento={evento}
                          onApagado={agenda.recarregar}
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
          <section>
            <h2 className="mb-2 text-xl font-bold">Aulas</h2>
            {agenda.aulas.length === 0 ? (
              <p className="text-muted">Nenhuma aula neste dia.</p>
            ) : (
              <div className={classeTabela}>
                <table className="w-full min-w-[720px] border-collapse text-sm">
                  <thead className={classeThead}>
                    <tr>
                      <th className="px-3 py-3" scope="col">
                        Horário
                      </th>
                      <th className="px-3 py-3" scope="col">
                        Aluno
                      </th>
                      <th className="px-3 py-3" scope="col">
                        Responsável
                      </th>
                      <th className="px-3 py-3" scope="col">
                        Categoria
                      </th>
                      <th className="px-3 py-3" scope="col">
                        Status
                      </th>
                      <th className="px-3 py-3" scope="col">
                        Marcador
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {agenda.aulas.map((aula) => (
                      <tr
                        key={aula.id}
                        className={cx(
                          'border-t border-line',
                          aula.experimental && aula.status === 'CONFIRMADA' && classeFundoAula(aula),
                        )}
                      >
                        <td className="px-3 py-3 whitespace-nowrap tabular-nums">
                          <Link to={`/agenda/aulas/${aula.id}`} className="font-semibold text-tide-dark">
                            {formatarHora(aula.inicio)}–{formatarHora(aula.fim)}
                          </Link>
                        </td>
                        <td className="px-3 py-3">{aula.aluno.nome}</td>
                        <td className="px-3 py-3">{aula.responsavel.nome}</td>
                        <td className="px-3 py-3">
                          <SeloCategoria categoria={aula.aluno.categoria} />
                        </td>
                        <td className="px-3 py-3">
                          <label className="sr-only" htmlFor={`status-${aula.id}`}>
                            Status de {aula.aluno.nome}
                          </label>
                          <select
                            id={`status-${aula.id}`}
                            value={aula.status}
                            disabled={pendente === aula.id}
                            onChange={(event) => void mudarStatus(aula, event.target.value as StatusAula)}
                            className={cx(
                              'cursor-pointer rounded-full border-0 py-1 pr-7 pl-2 text-xs font-semibold disabled:cursor-wait disabled:opacity-70',
                              classeSeloAula(aula),
                            )}
                          >
                            {STATUS.map((item) => (
                              <option key={item.value} value={item.value}>
                                {item.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-3">
                          <Marcadores aula={aula} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </div>
  )
}
