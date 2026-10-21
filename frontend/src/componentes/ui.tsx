import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { Aula, Categoria, StatusAula } from '../api/types'
import { rotuloStatus } from '../lib/rotulos'

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
  'w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink shadow-[0_1px_0_rgba(22,50,56,0.03)]'

export const classeBusca = 'w-full rounded-full border border-line bg-white px-4 py-2.5 text-sm text-ink'

export const classeCartao = 'rounded-2xl bg-paper shadow-[0_10px_28px_rgba(14,60,67,0.06)]'

export const classeTabela = 'overflow-x-auto rounded-2xl border border-line/80 bg-paper shadow-[0_8px_24px_rgba(14,60,67,0.04)]'

export const classeThead = 'bg-mint text-left text-xs font-bold tracking-wide text-tide-dark uppercase'

const CLASSE_BOTAO: Record<string, string> = {
  primario: 'bg-tide text-white hover:bg-tide-dark',
  secundario: 'border border-line bg-paper text-ink hover:bg-sand',
  suave: 'bg-blush text-clay hover:bg-[#f3c4bc]',
  perigo: 'bg-clay text-white hover:bg-[#8c3126]',
  fantasma: 'text-tide-dark hover:bg-sand',
}

type Variante = 'primario' | 'secundario' | 'suave' | 'perigo' | 'fantasma'

export function classeBotao(variante: Variante = 'primario'): string {
  return cx(
    'inline-flex h-10 items-center justify-center rounded-full px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50',
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
        {sobretitulo ? (
          <p className="mb-1 text-xs font-bold tracking-[0.16em] text-tide uppercase">{sobretitulo}</p>
        ) : null}
        <h1 className="text-3xl font-bold tracking-tight text-ink">{titulo}</h1>
        {descricao ? <p className="mt-1 text-muted">{descricao}</p> : null}
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
      className="rounded-2xl bg-paper px-4 py-10 text-center text-muted shadow-[0_10px_28px_rgba(14,60,67,0.06)]"
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

export function SeloStatus({ status }: { status: StatusAula }) {
  return (
    <span className={cx('inline-flex rounded-full px-2 py-0.5 text-xs font-semibold', CORES_STATUS[status])}>
      {rotuloStatus(status)}
    </span>
  )
}

export function SeloCategoria({ categoria }: { categoria: Categoria | null }) {
  if (!categoria) return null
  return (
    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded bg-tide/10 px-1.5 text-sm font-bold text-tide-dark">
      {categoria}
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
        <span className="inline-flex rounded-full bg-[#f8efd8] px-2 py-0.5 text-xs font-semibold text-[#7a4e0d]">
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
        <circle cx="16" cy="16" r="15" fill="#d6ef6a" />
        <circle cx="16" cy="16" r="6.2" fill="#0e3c43" />
        <path d="M11.2 15.6c2 1.1 4.4 1.1 7.6 0" stroke="#d6ef6a" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      </svg>
      <span className="leading-none">
        <span className={cx('block text-[13px] font-bold tracking-[0.14em]', clara ? 'text-white' : 'text-tide-dark')}>
          PERSONALYTTE
        </span>
        <span className={cx('mt-1 block text-[10px] font-semibold tracking-[0.16em]', clara ? 'text-white/70' : 'text-muted')}>
          BEACH TENNIS
        </span>
      </span>
    </span>
  )
}
