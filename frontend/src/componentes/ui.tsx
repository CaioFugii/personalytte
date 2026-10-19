import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { Aula, Categoria, StatusAula } from '../api/types'
import { rotuloStatus } from '../lib/rotulos'

export function cx(...partes: Array<string | false | null | undefined>): string {
  return partes.filter(Boolean).join(' ')
}

export function useTitulo(titulo: string) {
  useEffect(() => {
    document.title = `${titulo} · Personalytte`
  }, [titulo])
}

export const classeCampo =
  'w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink shadow-[0_1px_0_rgba(30,44,51,0.03)]'

const CLASSE_BOTAO: Record<string, string> = {
  primario: 'bg-tide text-white hover:bg-tide-dark',
  secundario: 'border border-line bg-paper text-ink hover:bg-sand',
  perigo: 'border border-[#efc7c0] bg-paper text-clay hover:bg-[#fdf3f1]',
  fantasma: 'text-tide-dark hover:bg-sand',
}

type Variante = 'primario' | 'secundario' | 'perigo' | 'fantasma'

export function classeBotao(variante: Variante = 'primario'): string {
  return cx(
    'inline-flex h-10 items-center justify-center rounded-md px-3.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50',
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
}: {
  to: string
  children: ReactNode
  variante?: Variante
}) {
  return (
    <Link to={to} className={classeBotao(variante)}>
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

export function Banner({
  tom,
  children,
  onFechar,
}: {
  tom: 'erro' | 'ok' | 'aviso'
  children: ReactNode
  onFechar?: () => void
}) {
  const classe = {
    erro: 'border-[#efc7c0] bg-[#fdf3f1] text-[#7d2c24]',
    ok: 'border-[#b7dfc6] bg-[#f1faf4] text-[#1c6b3c]',
    aviso: 'border-[#e3d3a4] bg-[#fbf6e8] text-[#6d5310]',
  }[tom]
  return (
    <div
      role={tom === 'erro' ? 'alert' : 'status'}
      className={cx('mb-4 flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm', classe)}
    >
      <div>{children}</div>
      {onFechar ? (
        <button type="button" onClick={onFechar} className="shrink-0 font-semibold">
          Fechar
        </button>
      ) : null}
    </div>
  )
}

export function Cabecalho({
  titulo,
  descricao,
  acoes,
}: {
  titulo: string
  descricao?: string
  acoes?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">{titulo}</h1>
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
      className="rounded-lg border border-line bg-paper px-4 py-10 text-center text-muted"
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
  AGUARDANDO: 'bg-[#f8efd8] text-[#7a4e0d]',
  CONFIRMADA: 'bg-[#e4f3ea] text-[#1c6b3c]',
  FALTA: 'bg-[#f8e7e3] text-[#8f3228]',
  CANCELADA: 'bg-[#eeeae3] text-[#5c6a72]',
}

export function SeloStatus({ status }: { status: StatusAula }) {
  return (
    <span className={cx('inline-flex rounded-full px-2 py-0.5 text-xs font-semibold', CORES_STATUS[status])}>
      {rotuloStatus(status)}
    </span>
  )
}

export function SeloCategoria({ categoria }: { categoria: Categoria }) {
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

export function Marca() {
  return (
    <span className="inline-flex items-center gap-2">
      <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="16" cy="16" r="14" fill="#0f6b66" />
        <circle cx="16" cy="16" r="6.5" fill="#f4f0e6" />
        <path d="M11 15.5c2.2 1.2 4.6 1.2 8 0" stroke="#0f6b66" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      </svg>
      <span className="font-display text-2xl font-semibold tracking-tight text-tide-dark">Personalytte</span>
    </span>
  )
}
