import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api, mensagemDeErro } from '../api/client'
import { useConfirmacao } from './confirmacao'
import type { Evento } from '../api/types'
import { cobreDiaInteiro, formatarIntervalo } from '../lib/calendario'
import { rotuloTipoEvento } from '../lib/rotulos'
import { Botao, classeBotao, classeIconeAcao, cx, IconeLapis, IconeLixeira } from './ui'

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
  className,
}: {
  evento: Evento
  nomes: Map<string, string>
  dia?: string
  href?: string
  className?: string
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
  const classe = cx('block rounded-xl border border-line bg-sand/70 px-3 py-2', className)
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
}: {
  evento: Evento
  onApagado: () => void
  onErro: (mensagem: string) => void
}) {
  if (!evento.id) return null
  return (
    <div className="flex gap-1">
      <Link
        to={`/agenda/eventos/${evento.id}`}
        aria-label={`Editar ${evento.nome}`}
        title="Editar"
        className={cx(classeBotao('secundario'), classeIconeAcao)}
      >
        <IconeLapis />
      </Link>
      <BotaoApagarEvento evento={evento} onApagado={onApagado} onErro={onErro} />
    </div>
  )
}

export function BotaoApagarEvento({
  evento,
  onApagado,
  onErro,
}: {
  evento: Evento
  onApagado: () => void
  onErro: (mensagem: string) => void
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
        aria-label={apagando ? `Apagando ${evento.nome}` : `Apagar ${evento.nome}`}
        title={apagando ? 'Apagando…' : 'Apagar'}
        className={classeIconeAcao}
      >
        <IconeLixeira />
      </Botao>
    </>
  )
}
