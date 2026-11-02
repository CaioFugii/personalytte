import type { Aula, Evento, StatusAula } from '../api/types'
import { cobreDiaInteiro, formatarDiaLongo, formatarHora, formatarIntervalo } from './calendario'
import { rotuloCategoria, rotuloTipoEvento } from './rotulos'

const LARGURA = 1080
const MARGEM = 48
const RAIO = 20
const FONTE = '"Source Sans 3", "Segoe UI", sans-serif'
const CABECALHO = 152
const ESPACO = 12
const LINHA_ALUNO = 52
const CHIP_ALUNO = 44
const GRUPO_TITULO = 34
const GRUPO_PROFESSOR = 22
const GRUPO_BASE = 14
const EVENTO_H = 100
const VAZIO_H = 72
const RODAPE = 44

const COR = {
  sand: '#f4f1ea',
  paper: '#fffcf8',
  ink: '#163238',
  muted: '#5c6b72',
  line: '#e6dfd2',
  tide: '#0f4f4c',
  sidebar: '#0e3c43',
  lime: '#d6ef6a',
  clay: '#a33b2c',
}

const COR_STATUS: Record<StatusAula, string> = {
  AGUARDANDO: '#f8efc4',
  CONFIRMADA: '#e5f6d8',
  FALTA: '#f6d4ce',
  CANCELADA: '#e7e4de',
}

const LEGENDA: { status: StatusAula; label: string }[] = [
  { status: 'AGUARDANDO', label: 'Aguardando' },
  { status: 'CONFIRMADA', label: 'Confirmada' },
  { status: 'FALTA', label: 'Falta' },
]

type AlunoLinha = { nome: string; categoria: string; extra: string; status: StatusAula }
type GrupoLinha = { horario: string; professor: string | null; alunos: AlunoLinha[] }
type EventoLinha = { tipo: string; nome: string; quando: string; bloqueia: boolean }

function fonte(peso: number, tamanho: number): string {
  return `${peso} ${tamanho}px ${FONTE}`
}

function alturaGrupo(grupo: GrupoLinha): number {
  return GRUPO_TITULO + (grupo.professor ? GRUPO_PROFESSOR : 0) + grupo.alunos.length * LINHA_ALUNO + GRUPO_BASE
}

function agruparAulas(aulas: Aula[]): GrupoLinha[] {
  const grupos: GrupoLinha[] = []
  for (const aula of aulas) {
    if (aula.status === 'CANCELADA') continue
    const horario = `${formatarHora(aula.inicio)}–${formatarHora(aula.fim)}`
    const extra = [aula.experimental ? 'Experimental' : null, aula.reposicaoDeAulaId ? 'Reposição' : null]
      .filter(Boolean)
      .join(' · ')
    const aluno: AlunoLinha = {
      nome: aula.aluno.nome,
      categoria: rotuloCategoria(aula.aluno.categoria),
      extra,
      status: aula.status,
    }
    const ultimo = grupos.at(-1)
    if (ultimo?.horario === horario) {
      ultimo.alunos.push(aluno)
      if (ultimo.professor && ultimo.professor !== aula.responsavel.nome) ultimo.professor = null
      continue
    }
    grupos.push({ horario, professor: aula.responsavel.nome, alunos: [aluno] })
  }
  return grupos
}

function eventosDoDia(eventos: Evento[], dia: string): EventoLinha[] {
  return eventos.map((evento) => ({
    tipo: rotuloTipoEvento(evento.tipo),
    nome: evento.nome,
    quando: cobreDiaInteiro(evento.inicio, evento.fim, dia) ? 'Dia inteiro' : formatarIntervalo(evento.inicio, evento.fim),
    bloqueia: Boolean(evento.bloqueiaAulas),
  }))
}

function arredondar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const raio = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, raio)
    return
  }
  ctx.moveTo(x + raio, y)
  ctx.arcTo(x + w, y, x + w, y + h, raio)
  ctx.arcTo(x + w, y + h, x, y + h, raio)
  ctx.arcTo(x, y + h, x, y, raio)
  ctx.arcTo(x, y, x + w, y, raio)
  ctx.closePath()
}

function cortar(ctx: CanvasRenderingContext2D, texto: string, maximo: number): string {
  if (ctx.measureText(texto).width <= maximo) return texto
  let atual = texto
  while (atual.length > 1 && ctx.measureText(`${atual}…`).width > maximo) {
    atual = atual.slice(0, -1)
  }
  return `${atual}…`
}

function desenharLogo(ctx: CanvasRenderingContext2D, x: number, y: number, tamanho: number) {
  const cx = x + tamanho / 2
  const cy = y + tamanho / 2
  ctx.fillStyle = COR.lime
  ctx.beginPath()
  ctx.arc(cx, cy, tamanho / 2, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = COR.sidebar
  ctx.beginPath()
  ctx.arc(cx, cy, tamanho * 0.2, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = COR.lime
  ctx.lineWidth = Math.max(2, tamanho * 0.045)
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(cx - tamanho * 0.16, cy - tamanho * 0.02)
  ctx.quadraticCurveTo(cx, cy + tamanho * 0.12, cx + tamanho * 0.16, cy - tamanho * 0.02)
  ctx.stroke()
}

async function carregarFonte(): Promise<void> {
  if (!document.fonts?.load) return
  await Promise.all([
    document.fonts.load(`700 42px ${FONTE}`),
    document.fonts.load(`600 28px ${FONTE}`),
    document.fonts.load(`400 26px ${FONTE}`),
  ]).catch(() => undefined)
  await document.fonts.ready.catch(() => undefined)
}

export async function gerarImagemAgendaDia(params: {
  data: string
  aulas: Aula[]
  eventos: Evento[]
}): Promise<Blob> {
  await carregarFonte()
  const grupos = agruparAulas(params.aulas)
  const eventos = eventosDoDia(params.eventos, params.data)
  const conteudo = LARGURA - MARGEM * 2
  const totalAulas = grupos.reduce((n, grupo) => n + grupo.alunos.length, 0)
  const resumo = [
    grupos.length === 0 ? 'Nenhuma aula' : `${totalAulas} aula${totalAulas === 1 ? '' : 's'}`,
    eventos.length > 0 ? `${eventos.length} evento${eventos.length === 1 ? '' : 's'}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  let y = CABECALHO + ESPACO
  y += eventos.length * (EVENTO_H + ESPACO)
  y += grupos.length === 0 ? VAZIO_H + ESPACO : grupos.reduce((total, grupo) => total + alturaGrupo(grupo) + ESPACO, 0)
  const altura = y + RODAPE

  const canvas = document.createElement('canvas')
  canvas.width = LARGURA
  canvas.height = Math.ceil(altura)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Não foi possível criar a imagem.')

  ctx.fillStyle = COR.sand
  ctx.fillRect(0, 0, LARGURA, canvas.height)

  ctx.fillStyle = COR.sidebar
  ctx.fillRect(0, 0, LARGURA, CABECALHO)
  ctx.fillStyle = COR.lime
  ctx.fillRect(0, CABECALHO - 6, LARGURA, 6)

  desenharLogo(ctx, MARGEM, 22, 48)
  ctx.fillStyle = '#ffffff'
  ctx.font = fonte(700, 22)
  ctx.fillText('PERSONALYTTE', MARGEM + 60, 42)
  ctx.fillStyle = 'rgba(255,255,255,0.72)'
  ctx.font = fonte(600, 12)
  ctx.fillText('BEACH TENNIS', MARGEM + 60, 60)

  let legendaX = LARGURA - MARGEM
  ctx.font = fonte(600, 16)
  for (const item of [...LEGENDA].reverse()) {
    const textoW = ctx.measureText(item.label).width
    legendaX -= textoW
    ctx.fillStyle = 'rgba(255,255,255,0.92)'
    ctx.fillText(item.label, legendaX, 50)
    legendaX -= 28
    ctx.fillStyle = COR_STATUS[item.status]
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'
    ctx.lineWidth = 1
    arredondar(ctx, legendaX, 32, 18, 18, 5)
    ctx.fill()
    ctx.stroke()
    legendaX -= 22
  }

  ctx.fillStyle = '#ffffff'
  ctx.font = fonte(700, 26)
  ctx.fillText(cortar(ctx, formatarDiaLongo(params.data), conteudo - 220), MARGEM, 112)
  ctx.fillStyle = 'rgba(255,255,255,0.78)'
  ctx.font = fonte(600, 16)
  const resumoW = ctx.measureText(resumo).width
  ctx.fillText(resumo, LARGURA - MARGEM - resumoW, 112)
  ctx.fillStyle = COR.lime
  ctx.font = fonte(700, 12)
  ctx.fillText('AGENDA DO DIA', MARGEM, 136)

  y = CABECALHO + ESPACO
  const cartaoX = MARGEM

  for (const evento of eventos) {
    ctx.fillStyle = COR.paper
    arredondar(ctx, cartaoX, y, conteudo, EVENTO_H, RAIO)
    ctx.fill()
    ctx.fillStyle = '#f6edd8'
    arredondar(ctx, cartaoX, y, 10, EVENTO_H, 6)
    ctx.fill()
    ctx.fillStyle = COR.tide
    ctx.font = fonte(700, 16)
    ctx.fillText(evento.tipo.toUpperCase(), cartaoX + 28, y + 32)
    ctx.fillStyle = COR.ink
    ctx.font = fonte(700, 24)
    ctx.fillText(cortar(ctx, evento.nome, conteudo - 56), cartaoX + 28, y + 62)
    ctx.fillStyle = COR.muted
    ctx.font = fonte(600, 18)
    ctx.fillText(cortar(ctx, evento.quando, conteudo - 56), cartaoX + 28, y + 86)
    if (evento.bloqueia) {
      ctx.fillStyle = COR.clay
      ctx.font = fonte(700, 16)
      ctx.fillText('Bloqueia aulas', cartaoX + conteudo - 168, y + 32)
    }
    y += EVENTO_H + ESPACO
  }

  if (grupos.length === 0) {
    ctx.fillStyle = COR.paper
    arredondar(ctx, cartaoX, y, conteudo, VAZIO_H, RAIO)
    ctx.fill()
    ctx.fillStyle = COR.muted
    ctx.font = fonte(600, 22)
    ctx.fillText('Nenhuma aula neste dia.', cartaoX + 28, y + 44)
    y += VAZIO_H + ESPACO
  }

  for (const grupo of grupos) {
    const h = alturaGrupo(grupo)
    ctx.fillStyle = COR.paper
    arredondar(ctx, cartaoX, y, conteudo, h, RAIO)
    ctx.fill()

    ctx.fillStyle = COR.tide
    ctx.font = fonte(700, 24)
    ctx.fillText(grupo.horario, cartaoX + 24, y + 26)
    ctx.fillStyle = COR.muted
    ctx.font = fonte(600, 16)
    const ocupacao = `${grupo.alunos.length} aluno${grupo.alunos.length === 1 ? '' : 's'}`
    const ocupacaoW = ctx.measureText(ocupacao).width
    ctx.fillText(ocupacao, cartaoX + conteudo - 24 - ocupacaoW, y + 26)
    let linha = y + GRUPO_TITULO
    if (grupo.professor) {
      ctx.fillStyle = COR.muted
      ctx.font = fonte(600, 16)
      ctx.fillText(cortar(ctx, grupo.professor, conteudo - 48), cartaoX + 24, linha + 16)
      linha += GRUPO_PROFESSOR
    }
    for (const aluno of grupo.alunos) {
      ctx.fillStyle = COR_STATUS[aluno.status]
      arredondar(ctx, cartaoX + 16, linha, conteudo - 32, CHIP_ALUNO, 12)
      ctx.fill()
      ctx.font = fonte(700, 14)
      const cat = aluno.categoria
      const catW = cat ? Math.max(36, ctx.measureText(cat).width + 16) : 0
      const catX = cartaoX + conteudo - 28 - catW
      ctx.fillStyle = COR.ink
      ctx.font = fonte(700, 22)
      const nome = aluno.extra ? `${aluno.nome} · ${aluno.extra}` : aluno.nome
      ctx.fillText(cortar(ctx, nome, catX - cartaoX - 44), cartaoX + 32, linha + 30)
      if (cat) {
        ctx.fillStyle = 'rgba(15,79,76,0.1)'
        arredondar(ctx, catX, linha + 8, catW, 26, 8)
        ctx.fill()
        ctx.fillStyle = COR.tide
        ctx.font = fonte(700, 14)
        const textoW = ctx.measureText(cat).width
        ctx.fillText(cat, catX + (catW - textoW) / 2, linha + 26)
      }
      linha += LINHA_ALUNO
    }
    y += h + ESPACO
  }

  ctx.fillStyle = COR.muted
  ctx.font = fonte(600, 14)
  ctx.fillText('Personalytte · Beach tennis', MARGEM, y + 22)

  return await new Promise((resolver, rejeitar) => {
    canvas.toBlob((blob) => {
      if (blob) resolver(blob)
      else rejeitar(new Error('Não foi possível gerar a imagem.'))
    }, 'image/png')
  })
}

export function nomeArquivoAgendaDia(data: string): string {
  return `agenda-personalytte-${data}.png`
}

export function podeCompartilharArquivo(arquivo: File): boolean {
  return typeof navigator.canShare === 'function' && navigator.canShare({ files: [arquivo] })
}
