import { expect, test, type Page } from '@playwright/test'

type Aluno = { id: string }
type Responsavel = { id: string; nome: string; funcao: string }
type Aula = { inicio: string; status: string }
type Evento = { inicio: string; fim: string }

const HORAS = [
  '07:00',
  '08:00',
  '09:00',
  '10:00',
  '11:00',
  '14:00',
  '15:00',
  '16:00',
  '17:00',
  '18:00',
  '19:00',
  '20:00',
  '21:00',
]

function hojeSP(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function addDias(iso: string, dias: number): string {
  const [ano, mes, dia] = iso.split('-').map(Number)
  const data = new Date(Date.UTC(ano, mes - 1, dia))
  data.setUTCDate(data.getUTCDate() + dias)
  const y = data.getUTCFullYear()
  const m = String(data.getUTCMonth() + 1).padStart(2, '0')
  const d = String(data.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function inicioDaSemana(iso: string): string {
  const [ano, mes, dia] = iso.split('-').map(Number)
  const dow = new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay()
  return addDias(iso, dow === 0 ? -6 : 1 - dow)
}

function horaDe(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso))
  const pegar = (tipo: Intl.DateTimeFormatPartTypes) => parts.find((parte) => parte.type === tipo)?.value ?? ''
  let hora = pegar('hour')
  if (hora === '24') hora = '00'
  return `${hora.padStart(2, '0')}:${pegar('minute').padStart(2, '0')}`
}

function dataDe(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(iso))
  const pegar = (tipo: Intl.DateTimeFormatPartTypes) => parts.find((parte) => parte.type === tipo)?.value ?? ''
  return `${pegar('year')}-${pegar('month')}-${pegar('day')}`
}

function minutos(hora: string): number {
  const [horas, mins] = hora.slice(0, 5).split(':').map(Number)
  return horas * 60 + mins
}

async function json<T>(resposta: { ok: () => boolean; json: () => Promise<unknown>; text: () => Promise<string> }): Promise<T> {
  expect(resposta.ok(), await resposta.text()).toBeTruthy()
  return resposta.json() as Promise<T>
}

async function entrar(page: Page) {
  await page.goto('/login')
  await page.locator('#email').fill('admin@personalytte.local')
  await page.locator('#senha').fill('senha-inicial')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).not.toHaveURL(/\/login/)
}

test('a agenda da semana mostra horário vago, sem 12h e 13h, com domingo', async ({ page }) => {
  await entrar(page)
  const segunda = inicioDaSemana(hojeSP())
  await page.goto(`/agenda?semana=${segunda}`)
  await expect(page.getByRole('heading', { name: 'Agenda da semana' })).toBeVisible()
  await expect(page.getByText('Horário vago').first()).toBeVisible()
  await expect(page.getByText('7h', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('14h', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('21h', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('12h', { exact: true })).toHaveCount(0)
  await expect(page.getByText('13h', { exact: true })).toHaveCount(0)
  await expect(page.getByText('22h', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('link', { name: /^Dom/ })).toBeVisible()
})

test('a semana de vagas oferece horário vago e categoria com vagas', async ({ page }) => {
  await entrar(page)
  const segunda = addDias(inicioDaSemana(hojeSP()), 7)
  const quinta = addDias(segunda, 3)
  const domingo = addDias(segunda, 6)
  const aulas = await json<Aula[]>(await page.request.get(`/api/aulas?de=${segunda}&ate=${domingo}`))
  const eventos = await json<Evento[]>(await page.request.get(`/api/eventos?de=${segunda}&ate=${domingo}`))
  const livres = HORAS.filter((hora) => {
    const ocupado = aulas.some((aula) => {
      if (aula.status === 'CANCELADA' || aula.status === 'FALTA') return false
      if (dataDe(aula.inicio) !== quinta) return false
      return Math.abs(minutos(horaDe(aula.inicio)) - minutos(hora)) < 60
    })
    const fechado = eventos.some((evento) => {
      const inicio = new Date(`${quinta}T${hora}:00-03:00`).getTime()
      return new Date(evento.inicio).getTime() < inicio + 60 * 60 * 1000 && new Date(evento.fim).getTime() > inicio
    })
    return !ocupado && !fechado
  })
  expect(livres.length).toBeGreaterThanOrEqual(3)
  const horaGrupo = livres[0]
  const horaVaga = livres[1]
  const horaLotada = livres.slice(2).find((hora) => hora !== '07:00') ?? livres[2]
  const vagas = horaGrupo === '07:00' ? 4 : 2
  const cheios = horaLotada === '07:00' ? 6 : 4
  const responsaveis = await json<Responsavel[]>(await page.request.get('/api/integrantes/responsaveis'))
  const marina = responsaveis.find((pessoa) => pessoa.nome === 'Marina Costa' && pessoa.funcao === 'PROFESSOR')
  expect(marina).toBeTruthy()

  const marca = Date.now()
  const ids: string[] = []
  try {
    for (const sufixo of ['a', 'b']) {
      const aluno = await json<Aluno>(await page.request.post('/api/alunos', {
        data: {
          nome: `Oferta Vaga ${marca} ${sufixo}`,
          telefone: sufixo === 'a' ? '11940000001' : '11940000002',
          genero: 'FEMININO',
          plano: 'PARTICULAR',
          categoria: 'D',
          horarios: [{ dia: 'qui', horarioInicio: horaGrupo, responsavelId: marina!.id }],
        },
      }))
      ids.push(aluno.id)
    }
    for (let indice = 1; indice <= cheios; indice += 1) {
      const aluno = await json<Aluno>(await page.request.post('/api/alunos', {
        data: {
          nome: `Oferta Lotada ${marca} ${indice}`,
          telefone: `1195${String(indice).padStart(7, '0')}`,
          genero: 'FEMININO',
          plano: 'PARTICULAR',
          categoria: 'D',
          horarios: [{ dia: 'qui', horarioInicio: horaLotada, responsavelId: marina!.id }],
        },
      }))
      ids.push(aluno.id)
    }

    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.goto(`/agenda/vagas?semana=${segunda}`)
    await expect(page.getByRole('heading', { name: 'Horários com vaga' }).first()).toBeVisible()
    await expect(page.getByRole('rowheader', { name: '12:00' })).toHaveCount(0)
    await expect(page.getByRole('rowheader', { name: '13:00' })).toHaveCount(0)
    await expect(page.getByRole('rowheader', { name: '07:00' })).toBeVisible()
    await expect(page.getByRole('rowheader', { name: '21:00' })).toBeVisible()
    await expect(page.getByRole('rowheader', { name: '22:00' })).toHaveCount(0)
    await expect(page.getByRole('columnheader', { name: /^Sáb/ })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: /^Dom/ })).toHaveCount(0)

    const grupo = page.locator(`[data-dia="${quinta}"][data-hora="${horaGrupo}"]`)
    await expect(grupo).toContainText(`D · ${vagas} vagas`)
    await expect(grupo).toContainText('Marina Costa')
    await expect(grupo).not.toContainText(`Oferta Vaga ${marca}`)
    await expect(page.locator(`[data-dia="${quinta}"][data-hora="${horaVaga}"]`)).toContainText('Horário vago')
    const lotado = page.locator(`[data-dia="${quinta}"][data-hora="${horaLotada}"]`)
    await expect(lotado).toContainText('D · Lotado')
    await expect(lotado).toContainText('Marina Costa')
    await expect(lotado).toHaveClass(/bg-blush/)

    await page.getByRole('button', { name: 'Copiar texto' }).click()
    const dialogo = page.getByRole('dialog')
    await expect(dialogo).toContainText(`${horaGrupo} — D · ${vagas} vagas · Marina Costa`)
    await expect(dialogo).toContainText(`${horaVaga} — Horário vago`)
    await expect(dialogo).toContainText(`${horaLotada} — D · Lotado · Marina Costa`)
    await expect(dialogo).not.toContainText(`Oferta Vaga ${marca}`)
    await expect(dialogo).not.toContainText('Domingo')
    await dialogo.getByRole('button', { name: 'Copiar' }).click()
    await expect(page.getByText('Texto copiado. Cole no WhatsApp.')).toBeVisible()
    const copiado = await page.evaluate(() => navigator.clipboard.readText())
    expect(copiado).toContain(`${horaGrupo} — D · ${vagas} vagas · Marina Costa`)
    expect(copiado).not.toContain(`Oferta Vaga ${marca}`)
  } finally {
    for (const id of ids) await page.request.post(`/api/alunos/${id}/inativar`)
  }
})
