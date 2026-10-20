import { useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAgenda } from '../api/useAgenda'
import { nomeDoResponsavel } from '../componentes/evento'
import { LinkNovoAgendamento } from './NovoAgendamento'
import {
  Botao,
  Cabecalho,
  classeFundoStatus,
  cx,
  PainelEstado,
  SeloStatus,
  useTitulo,
} from '../componentes/ui'
import {
  addDias,
  civilValida,
  diasDaSemana,
  eventoCruzaDia,
  formatarDiaCurto,
  formatarHora,
  formatarIntervaloSemana,
  hojeSP,
  inicioDaSemana,
  partesSP,
} from '../lib/calendario'
import { rotuloTipoEvento } from '../lib/rotulos'
import type { Aula, Evento } from '../api/types'

export function AgendaSemana() {
  useTitulo('Agenda da semana')
  const [params, setParams] = useSearchParams()
  const bruta = params.get('semana')
  const ancora = bruta && civilValida(bruta) ? bruta : hojeSP()
  const segunda = inicioDaSemana(ancora)
  const domingo = addDias(segunda, 6)
  const dias = diasDaSemana(segunda)
  const hoje = hojeSP()
  const agenda = useAgenda(segunda, domingo)
  const semanaVazia = !agenda.carregando && !agenda.erro && agenda.aulas.length === 0 && agenda.eventos.length === 0

  useEffect(() => {
    if (bruta !== null && !civilValida(bruta)) {
      setParams({ semana: hojeSP() }, { replace: true })
    }
  }, [bruta, setParams])

  function ir(data: string) {
    setParams({ semana: inicioDaSemana(data) })
  }

  return (
    <div>
      <Cabecalho
        sobretitulo="Planejamento"
        titulo="Agenda da semana"
        descricao={formatarIntervaloSemana(segunda)}
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
            <LinkNovoAgendamento />
          </>
        }
      />
      <Abas semana={`/agenda?semana=${segunda}`} dia="/agenda/dia" atual="semana" />

      {agenda.carregando && agenda.aulas.length === 0 && agenda.eventos.length === 0 ? (
        <PainelEstado status>Carregando…</PainelEstado>
      ) : null}
      {agenda.erro ? (
        <PainelEstado>
          <p className="mb-3 text-clay">{agenda.erro}</p>
          <Botao variante="secundario" onClick={agenda.recarregar}>
            Tentar de novo
          </Botao>
        </PainelEstado>
      ) : null}
      {!agenda.erro && !(agenda.carregando && agenda.aulas.length === 0 && agenda.eventos.length === 0) ? (
        <>
          {semanaVazia ? <p className="mb-3 text-muted">Nenhuma aula ou evento nesta semana.</p> : null}
          {agenda.carregando ? (
            <p role="status" className="mb-2 text-sm text-muted">
              Atualizando…
            </p>
          ) : null}
          <div className="overflow-x-auto pb-2">
            <div className="grid min-w-[56rem] grid-cols-7 gap-2">
              {dias.map((dia) => (
                <DiaColuna
                  key={dia}
                  dia={dia}
                  hoje={dia === hoje}
                  aulas={agenda.aulas.filter((aula) => partesSP(aula.inicio).data === dia)}
                  eventos={agenda.eventos.filter((evento) => eventoCruzaDia(evento.inicio, evento.fim, dia))}
                  nomes={agenda.nomes}
                />
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}

function DiaColuna({
  dia,
  hoje,
  aulas,
  eventos,
  nomes,
}: {
  dia: string
  hoje: boolean
  aulas: Aula[]
  eventos: Evento[]
  nomes: Map<string, string>
}) {
  return (
    <section className={cx('flex min-h-52 flex-col rounded-2xl bg-paper shadow-[0_8px_24px_rgba(14,60,67,0.05)]', hoje && 'ring-2 ring-tide')}>
      <Link to={`/agenda/dia?date=${dia}`} className="border-b border-line px-2 py-2 hover:bg-sand">
        <span className="block text-xs font-semibold tracking-wide text-muted uppercase">{formatarDiaCurto(dia)}</span>
        <span className="text-2xl leading-none font-bold">{Number(dia.slice(8))}</span>
        {hoje ? <span className="ml-2 text-xs font-semibold text-tide">Hoje</span> : null}
      </Link>
      <ul className="flex flex-1 flex-col gap-1 p-1.5">
        {eventos.map((evento, indice) => {
          const responsavel = nomeDoResponsavel(evento, nomes)
          return (
            <li key={evento.id ?? `${evento.inicio}-${indice}`} className="rounded-xl bg-[#f6edd8] px-1.5 py-1 text-xs">
              <span className="font-semibold">{rotuloTipoEvento(evento.tipo)}</span>
              <span className="block">{evento.nome}</span>
              {evento.bloqueiaAulas ? <span className="block font-semibold text-clay">Bloqueia aulas</span> : null}
              {evento.tipo === 'AUSENCIA' && responsavel ? (
                <span className="block text-muted">{responsavel}</span>
              ) : null}
            </li>
          )
        })}
        {aulas.map((aula) => (
          <li key={aula.id}>
            <Link
              to={`/agenda/aulas/${aula.id}`}
              className={cx(
                'block rounded-xl px-1.5 py-1 text-xs',
                classeFundoStatus(aula.status),
                aula.status === 'CANCELADA' && 'opacity-70',
              )}
            >
              <span className="font-semibold tabular-nums">{formatarHora(aula.inicio)}</span>
              <span className={cx('block', aula.status === 'CANCELADA' && 'line-through')}>{aula.aluno.nome}</span>
              <SeloStatus status={aula.status} />
              {aula.experimental || aula.reposicaoDeAulaId ? (
                <span className="mt-1 block text-tide-dark">
                  {[aula.experimental ? 'Experimental' : null, aula.reposicaoDeAulaId ? 'Reposição' : null]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
        {eventos.length === 0 && aulas.length === 0 ? <li className="px-1 py-2 text-xs text-muted">Nada neste dia.</li> : null}
      </ul>
    </section>
  )
}

export function Abas({ semana, dia, atual }: { semana: string; dia: string; atual: 'semana' | 'dia' }) {
  return (
    <div className="mb-4 flex gap-2" role="tablist" aria-label="Agenda">
      <Link
        to={semana}
        aria-current={atual === 'semana' ? 'page' : undefined}
        className={cx(
          'rounded-full px-3 py-1.5 text-sm font-semibold',
          atual === 'semana' ? 'bg-tide text-white' : 'bg-paper text-ink shadow-[0_4px_14px_rgba(14,60,67,0.05)]',
        )}
      >
        Semana
      </Link>
      <Link
        to={dia}
        aria-current={atual === 'dia' ? 'page' : undefined}
        className={cx(
          'rounded-full px-3 py-1.5 text-sm font-semibold',
          atual === 'dia' ? 'bg-tide text-white' : 'bg-paper text-ink shadow-[0_4px_14px_rgba(14,60,67,0.05)]',
        )}
      >
        Dia
      </Link>
    </div>
  )
}
