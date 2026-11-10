import { expect, test, type Page } from '@playwright/test'

type Aluno = {
  id: string
  nome: string
  horarios: { dia: string; horarioInicio: string; responsavelId: string }[]
}
type Responsavel = { id: string; nome: string; funcao: string }

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

test('cada horário do plano escolhe o próprio professor', async ({ page }) => {
  await entrar(page)
  const alunos = await json<Aluno[]>(await page.request.get('/api/alunos?busca=Ana%20Lima'))
  const ana = alunos.find((aluno) => aluno.nome === 'Ana Lima')
  expect(ana).toBeTruthy()
  const planoOriginal = ana!.horarios
  const nome = `Professor Plano ${Date.now()}`
  const professor = await json<Responsavel>(await page.request.post('/api/integrantes', {
    data: {
      nome,
      email: `plano.${Date.now()}@personalytte.local`,
      senha: 'professor1',
      funcao: 'PROFESSOR',
      telefone: '11977776666',
    },
  }))

  try {
    await page.goto(`/alunos/${ana!.id}`)
    await expect(page.locator('#professor-0')).toBeVisible()
    await expect(page.locator('#professor-1')).toBeVisible()
    await page.locator('#genero').selectOption('FEMININO')
    await page.locator('#professor-1').selectOption({ label: nome })
    await page.getByRole('button', { name: 'Salvar alterações' }).click()
    await expect(page.getByText('Alterações salvas.')).toBeVisible()

    const depois = await json<Aluno>(await page.request.get(`/api/alunos/${ana!.id}`))
    const professores = new Set(depois.horarios.map((horario) => horario.responsavelId))
    expect(professores.size).toBe(2)
    expect(depois.horarios.find((horario) => horario.dia === 'qui')?.responsavelId).toBe(professor!.id)
  } finally {
    await page.request.patch(`/api/alunos/${ana!.id}`, { data: { horarios: planoOriginal } })
    await page.request.post(`/api/integrantes/${professor!.id}/inativar`)
  }
})
