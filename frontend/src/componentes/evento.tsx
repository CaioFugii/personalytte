import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api, mensagemDeErro } from '../api/client'
import { useConfirmacao } from './confirmacao'
import type { Evento } from '../api/types'
import { cobreDiaInteiro, formatarIntervalo } from '../lib/calendario'
import { rotuloTipoEvento } from '../lib/rotulos'
import { Botao, classeBotao, cx } from './ui'

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

export function AcoesEvento({
  evento,
  onApagado,
  onErro,
  compacto = false,
}: {
  evento: Evento
  onApagado: () => void
  onErro: (mensagem: string) => void
  compacto?: boolean
}) {
  if (!evento.id) return null
  const classeIcone = 'h-7 w-7 px-0'
  return (
    <div className={cx('flex', compacto ? 'gap-1' : 'flex-wrap gap-2')}>
      <Link
        to={`/agenda/eventos/${evento.id}`}
        aria-label={`Editar ${evento.nome}`}
        title="Editar"
        className={cx(classeBotao('secundario'), compacto && classeIcone)}
      >
        {compacto ? <IconeLapis /> : 'Editar'}
      </Link>
      <BotaoApagarEvento evento={evento} onApagado={onApagado} onErro={onErro} compacto />
    </div>
  )
}

function IconeLapis() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6.5l3 3" />
    </svg>
  )
}

function IconeLixeira() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 7V5h6v2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 7l1 13h8l1-13" />
    </svg>
  )
}

export function BotaoApagarEvento({
  evento,
  onApagado,
  onErro,
  compacto = false,
}: {
  evento: Evento
  onApagado: () => void
  onErro: (mensagem: string) => void
  compacto?: boolean
}) {
  const [apagando, setApagando] = useState(false)
  const { pedir, dialogo } = useConfirmacao()
  if (!evento.id) return null

  async function apagar() {
    if (!evento.id || apagando) return
    const confirma = await pedir({
      titulo: 'Apagar evento',
      mensagem: `Apagar o evento "${evento.nome}"? O horário fica livre para uma aula nova.`,
      confirmar: 'Apagar',
      perigo: true,
    })
    if (!confirma) return
    setApagando(true)
    onErro('')
    try {
      await api(`/api/eventos/${evento.id}`, { method: 'DELETE' })
      onApagado()
    } catch (erro) {
      onErro(mensagemDeErro(erro) || 'Não foi possível apagar o evento.')
      setApagando(false)
    }
  }

  return (
    <>
      {dialogo}
      <Botao
        variante="perigo"
        onClick={() => void apagar()}
        disabled={apagando}
        aria-label={`Apagar ${evento.nome}`}
        title="Apagar"
        className={compacto ? 'h-7 w-7 px-0' : undefined}
      >
        {compacto ? <IconeLixeira /> : apagando ? 'Apagando…' : 'Apagar'}
      </Botao>
    </>
  )
}
