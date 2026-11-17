import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { Aula, Categoria, StatusAula } from '../api/types'
import { rotuloCategoria, rotuloStatus } from '../lib/rotulos'

export function cx(...partes: Array<string | false | null | undefined>): string {
  return partes.filter(Boolean).join(' ')
}

export const classeIconeAcao = '!h-8 !w-8 !px-0'

export function IconeLapis() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6.5l3 3" />
    </svg>
  )
}

export function IconeLixeira() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 7V5h6v2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 7l1 13h8l1-13" />
    </svg>
  )
}

export function useTitulo(titulo: string) {
  useEffect(() => {
    document.title = `${titulo} · Personalytte`
  }, [titulo])
}

export const classeCampo =
  'w-full rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink'

export const classeBusca = 'w-full rounded-md border border-line bg-paper px-4 py-2.5 text-sm text-ink'

export const classeCartao = 'rounded-md border border-line bg-paper'

export const classeTabela = 'overflow-x-auto rounded-md border border-line bg-paper'

export const classeThead = 'border-b border-line bg-paper text-left text-sm font-semibold text-tide-dark'

const CLASSE_BOTAO: Record<string, string> = {
  primario: 'bg-lime text-tide-dark hover:bg-[#c5d33a]',
  secundario: 'border border-line bg-paper text-ink hover:bg-sand',
  suave: 'bg-blush text-clay hover:bg-[#e8c2b8]',
  perigo: 'bg-clay text-white hover:bg-[#732922]',
  fantasma: 'text-tide-dark hover:bg-sand',
}

type Variante = 'primario' | 'secundario' | 'suave' | 'perigo' | 'fantasma'

export function classeBotao(variante: Variante = 'primario'): string {
  return cx(
    'inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50',
    CLASSE_BOTAO[variante],
  )
}

export function Botao({
  variante = 'primario',
  className,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante }) {
  return <button type={type} className={cx(classeBotao(variante), className)} {...props} />
}

export function LinkBotao({
  to,
  children,
  variante = 'primario',
  state,
}: {
  to: string
  children: ReactNode
  variante?: Variante
  state?: unknown
}) {
  return (
    <Link to={to} state={state} className={classeBotao(variante)}>
      {children}
    </Link>
  )
}

export function Campo({
  label,
  htmlFor,
  dica,
  children,
}: {
  label: string
  htmlFor: string
  dica?: string
  children: ReactNode
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-semibold">
        {label}
      </label>
      {children}
      {dica ? <p className="mt-1 text-xs text-muted">{dica}</p> : null}
    </div>
  )
}

export function Cabecalho({
  titulo,
  descricao,
  acoes,
  sobretitulo,
}: {
  titulo: string
  descricao?: string
  acoes?: ReactNode
  sobretitulo?: string
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {sobretitulo ? <p className="mb-1 text-sm font-semibold text-tide">{sobretitulo}</p> : null}
        <h1 className="text-4xl font-bold text-ink">{titulo}</h1>
        {descricao ? <p className="mt-2 max-w-[62ch] leading-relaxed text-muted">{descricao}</p> : null}
      </div>
      {acoes ? <div className="flex flex-wrap gap-2">{acoes}</div> : null}
    </div>
  )
}

export function PainelEstado({
  children,
  status,
}: {
  children: ReactNode
  status?: boolean
}) {
  return (
    <div
      role={status ? 'status' : undefined}
      className="rounded-md border border-line bg-paper px-4 py-10 text-center text-muted"
    >
      {children}
    </div>
  )
}

export function CarregandoTela() {
  return (
    <p role="status" className="grid min-h-screen place-items-center text-muted">
      Carregando…
    </p>
  )
}

const CORES_STATUS: Record<StatusAula, string> = {
  AGUARDANDO: 'bg-[#f8efc4] text-[#7a5610]',
  CONFIRMADA: 'bg-mint text-[#246b32]',
  FALTA: 'bg-blush text-[#8f3228]',
  CANCELADA: 'bg-[#e7e4de] text-[#5c6a72]',
}

export function classeFundoStatus(status: StatusAula): string {
  return {
    AGUARDANDO: 'bg-[#f8efc4]',
    CONFIRMADA: 'bg-mint',
    FALTA: 'bg-blush',
    CANCELADA: 'bg-[#e7e4de] text-muted',
  }[status]
}

export function classeSeloStatus(status: StatusAula): string {
  return CORES_STATUS[status]
}

export function classeFundoAula(aula: { status: StatusAula; experimental: boolean }): string {
  if (aula.experimental && aula.status === 'CONFIRMADA') return 'bg-[#ddd4fb]'
  return classeFundoStatus(aula.status)
}

export function classeSeloAula(aula: { status: StatusAula; experimental: boolean }): string {
  if (aula.experimental && aula.status === 'CONFIRMADA') return 'bg-[#ddd4fb] text-[#3d2d78]'
  return classeSeloStatus(aula.status)
}

export function SeloStatus({ status, experimental = false }: { status: StatusAula; experimental?: boolean }) {
  return (
    <span className={cx('inline-flex rounded-full px-2 py-0.5 text-xs font-semibold', classeSeloAula({ status, experimental }))}>
      {rotuloStatus(status)}
    </span>
  )
}

export function SeloCategoria({ categoria }: { categoria: Categoria | null }) {
  if (!categoria) return null
  return (
    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded bg-tide/10 px-1.5 text-sm font-bold text-tide-dark">
      {rotuloCategoria(categoria)}
    </span>
  )
}

export function Marcadores({
  aula,
}: {
  aula: Pick<Aula, 'experimental' | 'reposicaoDeAulaId'>
}) {
  if (!aula.experimental && !aula.reposicaoDeAulaId) {
    return <span className="text-muted">—</span>
  }
  return (
    <span className="flex flex-wrap gap-1">
      {aula.experimental ? (
        <span className="inline-flex rounded-full bg-tide/10 px-2 py-0.5 text-xs font-semibold text-tide-dark">
          Experimental
        </span>
      ) : null}
      {aula.reposicaoDeAulaId ? (
        <span className="inline-flex rounded-md bg-sand px-2 py-0.5 text-xs font-semibold text-tide-dark">
          Reposição
        </span>
      ) : null}
    </span>
  )
}

export function Marca({ clara = false }: { clara?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg width="36" height="36" viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="16" cy="16" r="11" fill="#d7e34a" />
        <path d="M8.5 15.4c3 1.8 6.4 1.8 12.2 0" stroke="#12383c" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      </svg>
      <span className="leading-none">
        <span className={cx('block font-display text-lg font-bold', clara ? 'text-white' : 'text-tide')}>Personalytte</span>
        <span className={cx('mt-0.5 block text-xs', clara ? 'text-white/70' : 'text-muted')}>Beach tennis</span>
      </span>
    </span>
  )
}
