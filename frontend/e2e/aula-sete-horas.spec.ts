import { expect, test, type Page } from '@playwright/test'

const DATA = '2026-11-12'
const INICIO = '2026-11-12T07:00'
const QUATRO = ['Ana Lima', 'Bruno Souza', 'Diego Alves', 'Elena Prado']
const MAIS_DOIS = ['Fábio Iniciante', 'Gabriela Nunes']
const SETIMO = 'Kaio Ferreira'
const GRUPO = [...QUATRO, ...MAIS_DOIS]

async function entrar(page: Page) {
  await page.goto('/login')
  await page.locator('#email').fill('admin@personalytte.local')
  await page.locator('#senha').fill('senha-inicial')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).not.toHaveURL(/\/login/)
}

async function limparSeteHoras(page: Page) {
  const resposta = await page.request.get(`/api/aulas?de=${DATA}&ate=${DATA}`)
  expect(resposta.ok()).toBeTruthy()
  const aulas = (await resposta.json()) as Array<{
    id: string
    status: string
    inicio: string
    aluno: { nome: string }
  }>
  const nomes = new Set([...GRUPO, SETIMO])
  for (const aula of aulas) {
    if (aula.status === 'CANCELADA') continue
    if (!aula.inicio.startsWith(INICIO)) continue
    if (!nomes.has(aula.aluno.nome)) continue
    const cancelamento = await page.request.post(`/api/aulas/${aula.id}/cancelar`, {
      data: { justificativa: 'Limpeza do teste da aula das 7h', geraReposicao: false },
    })
    expect(cancelamento.ok(), await cancelamento.text()).toBeTruthy()
  }
}

async function escolherAluno(page: Page, nome: string) {
  const campo = page.locator('#aluno-aula')
  await campo.click()
  await campo.fill(nome)
  const opcao = nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  await page.getByRole('option', { name: new RegExp(`^${opcao} ·`) }).click()
  await expect(page.getByRole('button', { name: `Remover ${nome}` })).toBeVisible()
}

async function preencherQuando(page: Page, hora: string) {
  await page.locator('#resp-aula').selectOption({ label: 'Marina Costa' })
  await page.locator('#data-aula').fill(DATA)
  const opcao = page.locator(`#hora-aula option[value="${hora}"]`)
  await expect(opcao).toBeAttached()
  await page.locator('#hora-aula').selectOption(hora)
}

test('a aula das 7h aceita 6 alunos e recusa o sétimo', async ({ page }) => {
  await entrar(page)
  await limparSeteHoras(page)

  try {
    await page.goto('/agenda/novo?tipo=aula')
    await expect(page.locator('#aluno-aula')).toBeVisible()
    await preencherQuando(page, '08:00')
    await expect(page.locator('#hora-aula option[value="08:00"]')).toHaveText('08:00 · 4 vagas · nenhum aluno')
    await expect(page.locator('#hora-aula option[value="07:00"]')).toHaveText('07:00 · 6 vagas · nenhum aluno')
    await expect(page.locator('#hora-aula option[value="19:00"]')).toHaveText('19:00 · 3 vagas · D')
    await expect(page.getByText('Alunos (até 4)')).toBeVisible()
    await expect(page.getByText('A aula em grupo junta até 4 alunos no mesmo horário.')).toBeVisible()

    for (const nome of QUATRO) await escolherAluno(page, nome)
    await expect(page.locator('#aluno-aula')).toBeDisabled()
    await expect(page.getByText('O grupo já tem 4 alunos.')).toBeVisible()

    await page.locator('#hora-aula').selectOption('07:00')
    await expect(page.getByText('Alunos (até 6)')).toBeVisible()
    await expect(page.getByText('A aula das 7h junta até 6 alunos.')).toBeVisible()
    await expect(page.locator('#aluno-aula')).toBeEnabled()

    for (const nome of MAIS_DOIS) await escolherAluno(page, nome)
    await expect(page.locator('#aluno-aula')).toBeDisabled()
    await expect(page.getByText('O grupo já tem 6 alunos.')).toBeVisible()

    await page.getByRole('button', { name: 'Agendar aula' }).click()
    await expect(page).toHaveURL(/\/agenda\?semana=2026-11-09/)
    await expect(page.getByText('Aula em grupo agendada para 6 alunos.')).toBeVisible()

    const grupo = page
      .locator('section')
      .filter({ has: page.getByRole('heading', { name: /Grupo das 7h/ }) })
      .filter({ hasText: 'Bruno Souza' })
      .filter({ hasText: 'Gabriela Nunes' })
      .filter({ hasNot: page.locator('section') })
    for (const nome of GRUPO) {
      await expect(grupo.getByRole('link', { name: new RegExp(nome) }).first()).toBeVisible()
    }

    await page.goto('/agenda/novo?tipo=aula')
    await expect(page.locator('#aluno-aula')).toBeVisible()
    await page.locator('#resp-aula').selectOption({ label: 'Marina Costa' })
    await page.locator('#data-aula').fill(DATA)
    await expect(page.locator('#hora-aula option[value="08:00"]')).toBeAttached()
    await expect(page.locator('#hora-aula option[value="07:00"]')).toHaveCount(0)
  } finally {
    await limparSeteHoras(page)
  }
})
