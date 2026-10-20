import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api, mensagemDeErro } from '../api/client'
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
  return (
    <div className="flex flex-wrap gap-2">
      <Link to={`/agenda/eventos/${evento.id}`} className={cx(classeBotao('secundario'), compacto && 'h-7 px-2 text-xs')}>
        Editar
      </Link>
      <BotaoApagarEvento evento={evento} onApagado={onApagado} onErro={onErro} compacto />
    </div>
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
  if (!evento.id) return null

  async function apagar() {
    if (!evento.id || apagando) return
    const confirma = window.confirm(`Apagar o evento "${evento.nome}"? O horário fica livre para uma aula nova.`)
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
    <Botao
      variante="perigo"
      onClick={() => void apagar()}
      disabled={apagando}
      className={compacto ? 'h-7 px-2 text-xs' : undefined}
    >
      {apagando ? 'Apagando…' : 'Apagar'}
    </Botao>
  )
}
