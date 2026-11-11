import { expect, test, type Page } from '@playwright/test'

type Aluno = {
  id: string
  nome: string
  horarios: { dia: string; horarioInicio: string; responsavelId: string }[]
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

test('a ficha do aluno não altera o plano semanal', async ({ page }) => {
  await entrar(page)
  const alunos = await json<Aluno[]>(await page.request.get('/api/alunos?busca=Ana%20Lima'))
  const ana = alunos.find((aluno) => aluno.nome === 'Ana Lima')
  expect(ana).toBeTruthy()
  const planoOriginal = ana!.horarios

  await page.goto('/alunos/novo')
  await expect(page.getByRole('heading', { name: 'Novo aluno' })).toBeVisible()
  await expect(page.getByText('Plano semanal')).toHaveCount(0)

  await page.goto(`/alunos/${ana!.id}`)
  await expect(page.getByRole('heading', { name: 'Ana Lima' })).toBeVisible()
  await expect(page.getByText('Plano semanal')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Adicionar horário' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Salvar alterações' }).click()
  await expect(page.getByText('Alterações salvas.')).toBeVisible()

  const depois = await json<Aluno>(await page.request.get(`/api/alunos/${ana!.id}`))
  expect(depois.horarios).toEqual(planoOriginal)
})
