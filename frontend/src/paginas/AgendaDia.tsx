import { useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAgenda } from '../api/useAgenda'
import { AcoesEvento, ResumoEvento } from '../componentes/evento'
import { notificar } from '../componentes/toast'
import {
  Botao,
  Cabecalho,
  classeTabela,
  classeThead,
  Marcadores,
  PainelEstado,
  SeloCategoria,
  SeloStatus,
  useTitulo,
} from '../componentes/ui'
import { useSessao } from '../contexto/Sessao'
import { addDias, civilValida, formatarDiaLongo, formatarHora, hojeSP } from '../lib/calendario'
import { Abas } from './AgendaSemana'
import { LinkNovoAgendamento } from './NovoAgendamento'

export function AgendaDia() {
  useTitulo('Agenda do dia')
  const [params, setParams] = useSearchParams()
  const bruta = params.get('date')
  const data = bruta && civilValida(bruta) ? bruta : hojeSP()
  const agenda = useAgenda(data, data)
  const { usuario } = useSessao()
  const admin = usuario?.papel === 'administrador'

  useEffect(() => {
    if (bruta !== null && !civilValida(bruta)) {
      setParams({ date: hojeSP() }, { replace: true })
    }
  }, [bruta, setParams])

  function ir(proxima: string) {
    setParams({ date: proxima })
  }

  const carregandoLista = agenda.carregando && agenda.aulas.length === 0 && agenda.eventos.length === 0

  return (
    <div>
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
            <LinkNovoAgendamento />
          </>
        }
      />
      <Abas semana={`/agenda?semana=${data}`} dia={`/agenda/dia?date=${data}`} atual="dia" />

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
                      <tr key={aula.id} className="border-t border-line">
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
                          <SeloStatus status={aula.status} />
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
