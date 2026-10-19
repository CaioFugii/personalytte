import { Link } from 'react-router-dom'
import type { Evento } from '../api/types'
import { cobreDiaInteiro, formatarIntervalo } from '../lib/calendario'
import { rotuloTipoEvento } from '../lib/rotulos'
import { cx } from './ui'

export function nomeDoResponsavel(evento: Evento, nomes: Map<string, string>): string | null {
  if (evento.responsavel?.nome) return evento.responsavel.nome
  if (evento.responsavelId && nomes.has(evento.responsavelId)) return nomes.get(evento.responsavelId) ?? null
  return null
}

export function ResumoEvento({
  evento,
  nomes,
  dia,
  href,
}: {
  evento: Evento
  nomes: Map<string, string>
  dia?: string
  href?: string
}) {
  const responsavel = nomeDoResponsavel(evento, nomes)
  const quando =
    dia && cobreDiaInteiro(evento.inicio, evento.fim, dia) ? 'Dia inteiro' : formatarIntervalo(evento.inicio, evento.fim)
  const corpo = (
    <>
      <span className="text-xs font-semibold text-tide-dark">{rotuloTipoEvento(evento.tipo)}</span>
      <span className="mt-0.5 block font-semibold">{evento.nome}</span>
      <span className="mt-0.5 block text-sm text-muted">{quando}</span>
      {evento.bloqueiaAulas ? <span className="mt-1 block text-xs font-semibold text-clay">Bloqueia aulas</span> : null}
      {evento.tipo === 'AUSENCIA' && responsavel ? (
        <span className="mt-1 block text-xs text-muted">Responsável: {responsavel}</span>
      ) : null}
      {evento.contato ? <span className="mt-1 block text-xs text-muted">Contato: {evento.contato}</span> : null}
    </>
  )
  const classe = 'block rounded-md border border-line bg-sand/70 px-3 py-2'
  if (href) {
    return (
      <Link to={href} className={cx(classe, 'hover:border-tide')}>
        {corpo}
      </Link>
    )
  }
  return <div className={classe}>{corpo}</div>
}
