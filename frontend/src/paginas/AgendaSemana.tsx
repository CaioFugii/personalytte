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
import { rotuloStatus, rotuloTipoEvento } from '../lib/rotulos'
import type { Aula, Evento, StatusAula } from '../api/types'

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
          <LegendaStatus />
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

type GrupoHorario = {
  horario: string
  rotulo: string
  aulas: Aula[]
}

/** Aulas já vêm em ordem de início. O mesmo horário vira um grupo só. */
function agruparPorHorario(aulas: Aula[]): GrupoHorario[] {
  const grupos: GrupoHorario[] = []
  for (const aula of aulas) {
    const horario = formatarHora(aula.inicio)
    const ultimo = grupos.at(-1)
    if (ultimo?.horario === horario) {
      ultimo.aulas.push(aula)
      continue
    }
    grupos.push({ horario, rotulo: rotuloGrupo(horario), aulas: [aula] })
  }
  return grupos
}

function rotuloGrupo(horario: string): string {
  const [hora, minuto] = horario.split(':')
  const numero = Number(hora)
  if (!Number.isFinite(numero)) return horario
  if (minuto === '00') return `${numero}h`
  return `${numero}h${minuto}`
}

function statusDoGrupo(aulas: Aula[]): StatusAula | null {
  const primeiro = aulas[0]?.status
  if (!primeiro || aulas.some((aula) => aula.status !== primeiro)) return null
  return primeiro
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
  const grupos = agruparPorHorario(aulas)
  return (
    <section className={cx('flex min-h-52 flex-col rounded-2xl bg-paper shadow-[0_8px_24px_rgba(14,60,67,0.05)]', hoje && 'ring-2 ring-tide')}>
      <Link to={`/agenda/dia?date=${dia}`} className="border-b border-line px-2 py-2 hover:bg-sand">
        <span className="block text-xs font-semibold tracking-wide text-muted uppercase">{formatarDiaCurto(dia)}</span>
        <span className="text-2xl leading-none font-bold">{Number(dia.slice(8))}</span>
        {hoje ? <span className="ml-2 text-xs font-semibold text-tide">Hoje</span> : null}
      </Link>
      <ul className="flex flex-1 flex-col gap-1.5 p-1.5">
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
        {grupos.map((grupo) => (
          <GrupoAulas key={grupo.horario} grupo={grupo} />
        ))}
        {eventos.length === 0 && aulas.length === 0 ? <li className="px-1 py-2 text-xs text-muted">Nada neste dia.</li> : null}
      </ul>
    </section>
  )
}

function GrupoAulas({ grupo }: { grupo: GrupoHorario }) {
  const status = statusDoGrupo(grupo.aulas)
  return (
    <li>
      <section
        className={cx(
          'rounded-xl px-1 py-1',
          status ? classeFundoStatus(status) : 'border border-line bg-sand/70',
          status === 'CANCELADA' && 'opacity-70',
        )}
      >
        <header className="flex flex-wrap items-center justify-between gap-x-1 gap-y-0.5 px-0.5">
          <h3 className="text-sm leading-none font-bold text-tide-dark">
            <span className="sr-only">Grupo das </span>
            <span className="tabular-nums">{grupo.rotulo}</span>
            {grupo.aulas.length > 1 ? (
              <span className="ml-1 text-[10px] font-semibold text-muted">
                <span className="sr-only">, </span>
                {grupo.aulas.length}
                <span className="sr-only"> aulas</span>
              </span>
            ) : null}
          </h3>
          {status === 'CANCELADA' ? <SeloStatus status={status} /> : null}
        </header>
        <ul className="mt-0.5 flex flex-col">
          {grupo.aulas.map((aula) => (
            <li key={aula.id}>
              <Link
                to={`/agenda/aulas/${aula.id}`}
                className={cx(
                  'block text-xs leading-snug hover:underline',
                  status
                    ? 'rounded-md px-0.5 py-0.5'
                    : cx(
                        'mt-0.5 rounded-lg px-1.5 py-1',
                        classeFundoStatus(aula.status),
                        aula.status === 'CANCELADA' && 'opacity-70',
                      ),
                )}
              >
                <span className={cx('block', aula.status === 'CANCELADA' && 'line-through')}>{aula.aluno.nome}</span>
                {!status && aula.status === 'CANCELADA' ? (
                  <SeloStatus status={aula.status} />
                ) : (
                  <span className="sr-only">{rotuloStatus(aula.status)}</span>
                )}
                {aula.experimental || aula.reposicaoDeAulaId ? (
                  <span className="mt-0.5 block text-tide-dark">
                    {[aula.experimental ? 'Experimental' : null, aula.reposicaoDeAulaId ? 'Reposição' : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </li>
  )
}

const LEGENDA: { status: StatusAula; label: string }[] = [
  { status: 'AGUARDANDO', label: 'Aguardando' },
  { status: 'CONFIRMADA', label: 'Confirmada' },
  { status: 'FALTA', label: 'Falta' },
]

function LegendaStatus() {
  return (
    <ul className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm" aria-label="Legenda">
      {LEGENDA.map((item) => (
        <li key={item.status} className="flex items-center gap-2">
          <span
            className={cx('inline-block h-4 w-4 rounded-md border border-black/10', classeFundoStatus(item.status))}
            aria-hidden
          />
          {item.label}
        </li>
      ))}
    </ul>
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
