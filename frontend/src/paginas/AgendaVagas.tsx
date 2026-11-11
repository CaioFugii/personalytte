import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAgenda } from '../api/useAgenda'
import { ModalTextoAgenda } from '../componentes/exportarAgenda'
import { notificar } from '../componentes/toast'
import { Botao, Cabecalho, cx, PainelEstado, useTitulo } from '../componentes/ui'
import {
  addDias,
  civilValida,
  diasDaSemana,
  formatarDiaCurto,
  formatarIntervaloSemana,
  hojeSP,
  inicioDaSemana,
} from '../lib/calendario'
import { celulaOferta, HORARIOS_OFERTA, textoOferta, type CelulaOferta } from '../lib/ofertaHorarios'
import { Abas } from './AgendaSemana'
import { LinkNovoAgendamento } from './NovoAgendamento'

const FUNDO: Record<CelulaOferta['tipo'], string> = {
  vago: 'bg-sand text-muted',
  vagas: 'bg-mint text-tide-dark',
  lotado: 'bg-blush text-clay',
  ocupado: 'bg-line/60 text-muted',
  fechado: 'bg-[#f6edd8] text-ink',
}

export function AgendaVagas() {
  useTitulo('Horários com vaga')
  const [params, setParams] = useSearchParams()
  const bruta = params.get('semana')
  const ancora = bruta && civilValida(bruta) ? bruta : hojeSP()
  const segunda = inicioDaSemana(ancora)
  const sabado = addDias(segunda, 5)
  const dias = diasDaSemana(segunda).slice(0, 6)
  const hoje = hojeSP()
  const agenda = useAgenda(segunda, sabado)
  const [texto, setTexto] = useState<string | null>(null)
  const intervalo = formatarIntervaloSemana(segunda, sabado)

  useEffect(() => {
    if (bruta !== null && !civilValida(bruta)) {
      setParams({ semana: hojeSP() }, { replace: true })
    }
  }, [bruta, setParams])

  const grade = useMemo(
    () => dias.map((dia) => HORARIOS_OFERTA.map((hora) => celulaOferta(dia, hora, agenda.aulas, agenda.eventos))),
    [dias, agenda.aulas, agenda.eventos],
  )

  function ir(data: string) {
    setParams({ semana: inicioDaSemana(data) })
  }

  async function copiarTexto(valor: string) {
    try {
      await navigator.clipboard.writeText(valor)
      notificar('ok', 'Texto copiado. Cole no WhatsApp.')
    } catch {
      notificar('erro', 'Não foi possível copiar. Selecione o texto e copie.')
    }
  }

  function abrirTexto() {
    setTexto(textoOferta(dias, agenda.aulas, agenda.eventos, intervalo))
  }

  const carregando = agenda.carregando && agenda.aulas.length === 0 && agenda.eventos.length === 0

  return (
    <div>
      {texto !== null ? (
        <ModalTextoAgenda
          texto={texto}
          titulo="Texto para compartilhar"
          descricao="Pronto para colar no WhatsApp. Sem nome de aluno."
          rotuloCampo="Texto dos horários com vaga"
          onCopiar={() => void copiarTexto(texto)}
          onFechar={() => setTexto(null)}
        />
      ) : null}
      <Cabecalho
        sobretitulo="Planejamento"
        titulo="Horários com vaga"
        descricao={`${intervalo}. Para oferecer horário a aluno novo ou já cadastrado.`}
        acoes={
          <>
            <Botao variante="secundario" onClick={() => ir(addDias(segunda, -7))}>
              Anterior
            </Botao>
            <Botao variante="secundario" onClick={() => ir(hojeSP())}>
              Hoje
            </Botao>
            <Botao variante="secundario" onClick={() => ir(addDias(segunda, 7))}>
              Próxima
            </Botao>
            <Botao variante="secundario" disabled={carregando || Boolean(agenda.erro)} onClick={abrirTexto}>
              Copiar texto
            </Botao>
            <LinkNovoAgendamento />
          </>
        }
      />
      <Abas
        semana={`/agenda?semana=${segunda}`}
        dia="/agenda/dia"
        vagas={`/agenda/vagas?semana=${segunda}`}
        atual="vagas"
      />

      {carregando ? <PainelEstado status>Carregando…</PainelEstado> : null}
      {agenda.erro ? (
        <PainelEstado>
          <p className="mb-3 text-clay">{agenda.erro}</p>
          <Botao variante="secundario" onClick={agenda.recarregar}>
            Tentar de novo
          </Botao>
        </PainelEstado>
      ) : null}
      {!agenda.erro && !carregando ? (
        <div className="overflow-x-auto rounded-3xl bg-paper p-4 shadow-[0_10px_28px_rgba(14,60,67,0.06)]">
          {agenda.carregando ? (
            <p role="status" className="mb-2 text-sm text-muted">
              Atualizando…
            </p>
          ) : null}
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold tracking-[0.14em] text-tide uppercase">Personalytte</p>
              <h2 className="text-2xl font-bold tracking-tight">Horários com vaga</h2>
              <p className="text-muted">{intervalo}</p>
            </div>
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-label="Legenda">
              <li>Horário vago</li>
              <li>Categoria e vagas</li>
              <li>Lotado</li>
              <li>Agenda fechada</li>
            </ul>
          </div>
          <table className="w-full min-w-[72rem] border-separate border-spacing-1 text-left">
            <caption className="sr-only">Horários com vaga, {intervalo}. Das 7h às 22h, sem 12h e 13h.</caption>
            <thead>
              <tr>
                <th scope="col">
                  <span className="sr-only">Horário</span>
                </th>
                {dias.map((dia) => (
                  <th
                    key={dia}
                    scope="col"
                    className={cx('rounded-xl px-2 py-2 text-center', dia === hoje ? 'bg-tide text-white' : 'text-ink')}
                  >
                    <span className="block text-xs font-semibold tracking-wide uppercase">{formatarDiaCurto(dia)}</span>
                    <span className="text-lg leading-none font-bold">{Number(dia.slice(8))}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {HORARIOS_OFERTA.map((hora, indiceHora) => (
                <tr key={hora}>
                  <th scope="row" className="pr-2 text-right text-sm font-bold tabular-nums text-tide-dark">
                    {hora}
                  </th>
                  {dias.map((dia, indiceDia) => {
                    const celula = grade[indiceDia][indiceHora]
                    return (
                      <td
                        key={dia}
                        data-dia={dia}
                        data-hora={hora}
                        className={cx('rounded-xl px-2 py-1.5 align-top text-xs', FUNDO[celula.tipo])}
                      >
                        {celula.linhas.map((linha, indice) => (
                          <p
                            key={`${linha.texto}-${linha.professor ?? indice}`}
                            className={cx(
                              indice > 0 && 'mt-1',
                              linha.lotado && celula.tipo !== 'lotado' && 'rounded-lg bg-blush px-1.5 py-1 text-clay',
                            )}
                          >
                            <span className="font-semibold">{linha.texto}</span>
                            {linha.professor ? <span className="mt-0.5 block">{linha.professor}</span> : null}
                          </p>
                        ))}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}
