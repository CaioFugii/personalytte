import { useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAgenda } from '../api/useAgenda'
import { nomeDoResponsavel } from '../componentes/evento'
import { LinkNovoAgendamento } from './NovoAgendamento'
import {
  Botao,
  Cabecalho,
  classeFundoAula,
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
import { HORARIOS_OFERTA } from '../lib/ofertaHorarios'
import { resumoCategorias, rotuloStatus, rotuloTipoEvento } from '../lib/rotulos'
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
      <Abas
        semana={`/agenda?semana=${segunda}`}
        dia="/agenda/dia"
        vagas={`/agenda/vagas?semana=${segunda}`}
        atual="semana"
      />

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

function minutosDoHorario(hora: string): number {
  const [horas, mins] = hora.slice(0, 5).split(':').map(Number)
  return horas * 60 + mins
}

function naJanelaAlmoco(hora: string): boolean {
  const minutos = minutosDoHorario(hora)
  return minutos >= 12 * 60 && minutos < 14 * 60
}

/** Das 7h às 21h, sem 12h e 13h. Horário fora dessa grade entra se já tiver aula. */
function gradeDoDia(aulas: Aula[]): GrupoHorario[] {
  const porHorario = new Map<string, Aula[]>()
  for (const aula of aulas) {
    const horario = formatarHora(aula.inicio).slice(0, 5)
    if (naJanelaAlmoco(horario) || minutosDoHorario(horario) >= 22 * 60) continue
    const lista = porHorario.get(horario) ?? []
    lista.push(aula)
    porHorario.set(horario, lista)
  }
  const horas = new Set<string>(HORARIOS_OFERTA)
  for (const hora of porHorario.keys()) horas.add(hora)
  return [...horas]
    .sort((a, b) => minutosDoHorario(a) - minutosDoHorario(b))
    .map((horario) => ({ horario, rotulo: rotuloGrupo(horario), aulas: porHorario.get(horario) ?? [] }))
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

function fundoDoGrupo(aulas: Aula[]): string | null {
  const primeiro = aulas[0] ? classeFundoAula(aulas[0]) : null
  if (!primeiro || aulas.some((aula) => classeFundoAula(aula) !== primeiro)) return null
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
  const grupos = gradeDoDia(aulas)
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
        {grupos.map((grupo) =>
          grupo.aulas.length > 0 ? (
            <GrupoAulas key={grupo.horario} grupo={grupo} />
          ) : (
            <li key={grupo.horario} className="rounded-xl bg-sand px-1.5 py-1 text-xs text-muted">
              <span className="font-bold text-tide-dark tabular-nums">{grupo.rotulo}</span>
              <span className="mt-0.5 block">Horário vago</span>
            </li>
          ),
        )}
      </ul>
    </section>
  )
}

function GrupoAulas({ grupo }: { grupo: GrupoHorario }) {
  const status = statusDoGrupo(grupo.aulas)
  const fundo = fundoDoGrupo(grupo.aulas)
  const categorias = resumoCategorias(grupo.aulas.map((aula) => aula.aluno.categoria))
  return (
    <li>
      <section
        className={cx(
          'rounded-xl px-1 py-1',
          fundo ?? 'border border-line bg-sand/70',
          status === 'CANCELADA' && 'opacity-70',
        )}
      >
        <header className="px-0.5">
          <div className="flex flex-wrap items-center justify-between gap-x-1 gap-y-0.5">
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
          </div>
          {categorias ? (
            <p className="mt-0.5 text-[10px] leading-tight font-semibold text-muted">{categorias}</p>
          ) : null}
        </header>
        <ul className="mt-0.5 flex flex-col">
          {grupo.aulas.map((aula) => (
            <li key={aula.id}>
              <Link
                to={`/agenda/aulas/${aula.id}`}
                className={cx(
                  'block text-xs leading-snug hover:underline',
                  fundo
                    ? 'rounded-md px-0.5 py-0.5'
                    : cx(
                        'mt-0.5 rounded-lg px-1.5 py-1',
                        classeFundoAula(aula),
                        aula.status === 'CANCELADA' && 'opacity-70',
                      ),
                )}
              >
                <span className={cx('block', aula.status === 'CANCELADA' && 'line-through')}>{aula.aluno.nome}</span>
                {!fundo && aula.status === 'CANCELADA' ? (
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

const LEGENDA: { chave: string; label: string; classe: string }[] = [
  { chave: 'AGUARDANDO', label: 'Aguardando', classe: classeFundoStatus('AGUARDANDO') },
  { chave: 'CONFIRMADA', label: 'Confirmada', classe: classeFundoStatus('CONFIRMADA') },
  { chave: 'EXPERIMENTAL_CONFIRMADA', label: 'Experimental confirmada', classe: classeFundoAula({ status: 'CONFIRMADA', experimental: true }) },
  { chave: 'FALTA', label: 'Falta', classe: classeFundoStatus('FALTA') },
]

function LegendaStatus() {
  return (
    <ul className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm" aria-label="Legenda">
      {LEGENDA.map((item) => (
        <li key={item.chave} className="flex items-center gap-2">
          <span className={cx('inline-block h-4 w-4 rounded-md border border-black/10', item.classe)} aria-hidden />
          {item.label}
        </li>
      ))}
    </ul>
  )
}

export function Abas({
  semana,
  dia,
  vagas,
  atual,
}: {
  semana: string
  dia: string
  vagas: string
  atual: 'semana' | 'dia' | 'vagas'
}) {
  const abas = [
    { id: 'semana' as const, to: semana, label: 'Semana' },
    { id: 'dia' as const, to: dia, label: 'Dia' },
    { id: 'vagas' as const, to: vagas, label: 'Vagas' },
  ]
  return (
    <div className="mb-4 flex gap-2" role="tablist" aria-label="Agenda">
      {abas.map((aba) => (
        <Link
          key={aba.id}
          to={aba.to}
          aria-current={atual === aba.id ? 'page' : undefined}
          className={cx(
            'rounded-full px-3 py-1.5 text-sm font-semibold',
            atual === aba.id ? 'bg-tide text-white' : 'bg-paper text-ink shadow-[0_4px_14px_rgba(14,60,67,0.05)]',
          )}
        >
          {aba.label}
        </Link>
      ))}
    </div>
  )
}
