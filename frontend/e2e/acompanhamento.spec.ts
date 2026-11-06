import { expect, test, type Page } from '@playwright/test'
import type { Aula } from '../src/api/types'

function mesAtual(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
  }).format(new Date())
}

function fimDoMes(mes: string): string {
  const [ano, mesNumero] = mes.split('-').map(Number)
  const ultimo = new Date(Date.UTC(ano, mesNumero, 0)).getUTCDate()
  return `${mes}-${String(ultimo).padStart(2, '0')}`
}

function tituloDoMes(mes: string): string {
  const texto = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${mes}-01T12:00:00-03:00`))
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

async function entrar(page: Page, email: string, senha: string) {
  await page.goto('/login')
  await page.locator('#email').fill(email)
  await page.locator('#senha').fill(senha)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).not.toHaveURL(/\/login/)
}

test('o acompanhamento abre o mês corrente e os meses anteriores', async ({ page }) => {
  await entrar(page, 'admin@personalytte.local', 'senha-inicial')
  await page.getByRole('link', { name: 'Acompanhamento' }).click()
  const mes = mesAtual()
  await expect(page.getByRole('heading', { name: 'Acompanhamento' })).toBeVisible()
  await expect(page.getByText(tituloDoMes(mes))).toBeVisible()
  await expect(page.getByRole('button', { name: 'Próximo mês' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Este mês' })).toBeDisabled()

  const resposta = await page.request.get(`/api/aulas?de=${mes}-01&ate=${fimDoMes(mes)}`)
  expect(resposta.ok()).toBeTruthy()
  const aulas = (await resposta.json()) as Aula[]
  const faltas = aulas.filter((aula) => aula.status === 'FALTA').length
  const confirmacoes = aulas.filter((aula) => aula.status === 'CONFIRMADA').length
  const cancelamentos = aulas.filter((aula) => aula.status === 'CANCELADA').length
  const reposicoes = aulas.filter((aula) => aula.reposicaoDeAulaId).length
  await expect(page.getByRole('button', { name: `${faltas} Faltas` })).toBeVisible()
  await expect(page.getByRole('button', { name: `${confirmacoes} Confirmações` })).toBeVisible()
  await expect(page.getByRole('button', { name: `${cancelamentos} Cancelamentos` })).toBeVisible()
  await expect(page.getByRole('button', { name: `${reposicoes} Reposições` })).toBeVisible()

  const relevantes = aulas.filter((aula) => aula.status !== 'AGUARDANDO' || aula.reposicaoDeAulaId)
  if (relevantes.length === 0) {
    await expect(page.getByText('Nenhuma falta, confirmação, cancelamento ou reposição neste mês.')).toBeVisible()
  } else {
    await expect(page.getByRole('columnheader', { name: 'Faltas' })).toBeVisible()
    const aula = page.locator('a[href^="/agenda/aulas/"]').first()
    await aula.click()
    await expect(page).toHaveURL(/\/agenda\/aulas\//)
    await page.goBack()
    await expect(page.getByRole('heading', { name: 'Acompanhamento' })).toBeVisible()
  }

  await page.getByRole('button', { name: `${faltas} Faltas` }).click()
  await expect(page.getByRole('button', { name: `${faltas} Faltas` })).toHaveAttribute('aria-pressed', 'true')
  if (faltas === 0) await expect(page.getByText('Nenhuma falta neste mês.')).toBeVisible()

  await page.goto('/acompanhamento?mes=2099-01')
  await expect(page).toHaveURL(new RegExp(`mes=${mes}`))
  await expect(page.getByRole('button', { name: 'Próximo mês' })).toBeDisabled()

  await page.getByRole('button', { name: 'Mês anterior' }).click()
  await expect(page.getByRole('button', { name: 'Próximo mês' })).toBeEnabled()
  await page.getByRole('button', { name: 'Este mês' }).click()
  await expect(page.getByRole('button', { name: 'Próximo mês' })).toBeDisabled()
  await expect(page.getByText(tituloDoMes(mes))).toBeVisible()

  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('heading', { name: 'Acompanhamento' })).toBeVisible()
  await expect(page.getByRole('button', { name: `${faltas} Faltas` })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Acompanhamento' })).toBeVisible()
})

test('professor consulta o acompanhamento', async ({ page }) => {
  await entrar(page, 'marina@personalytte.local', 'professor1')
  await page.goto('/acompanhamento')
  await expect(page.getByRole('heading', { name: 'Acompanhamento' })).toBeVisible()
  await expect(page.getByText(tituloDoMes(mesAtual()))).toBeVisible()
})
