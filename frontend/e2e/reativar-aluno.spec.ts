import { expect, test, type Page } from '@playwright/test'

const NOME = 'Reativacao Verificacao'

type Aluno = { id: string; nome: string; ativo: boolean }
type Aula = { id: string; status: string; inicio: string; aluno: { id: string } }
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

test('reativar o aluno não traz de volta as aulas que saíram', async ({ page }) => {
  await entrar(page)
  const responsaveis = await json<Responsavel[]>(await page.request.get('/api/integrantes/responsaveis'))
  const marina = responsaveis.find((pessoa) => pessoa.nome === 'Marina Costa' && pessoa.funcao === 'PROFESSOR')
  expect(marina).toBeTruthy()
  const criado = await json<Aluno>(await page.request.post('/api/alunos', {
    data: {
      nome: NOME,
      telefone: '11900004455',
      genero: 'FEMININO',
      plano: 'PARTICULAR',
      categoria: 'D',
      horarios: [{ dia: 'qui', horarioInicio: '19:00', responsavelId: marina!.id }],
    },
  }))
  try {
    const antes = await json<Aula[]>(await page.request.get('/api/aulas?de=2026-11-10&ate=2027-01-31'))
    const doAluno = antes.filter((aula) => aula.aluno.id === criado.id)
    expect(doAluno.length).toBeGreaterThan(0)
    const inativado = await page.request.post(`/api/alunos/${criado.id}/inativar`)
    expect(inativado.ok(), await inativado.text()).toBeTruthy()
    const aposInativar = await json<Aula[]>(await page.request.get('/api/aulas?de=2026-11-10&ate=2027-01-31'))
    const restantes = aposInativar.filter((aula) => aula.aluno.id === criado.id).map((aula) => aula.id).sort()

    await page.goto(`/alunos?busca=${encodeURIComponent(NOME)}`)
    await expect(page.getByRole('button', { name: 'Reativar' })).toBeVisible()
    await page.goto(`/alunos/${criado.id}`)
    await page.getByRole('button', { name: 'Reativar' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Reativar' }).click()
    await expect(page.getByText('Aluno reativado.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Salvar alterações' })).toBeVisible()

    const depois = await json<Aula[]>(await page.request.get('/api/aulas?de=2026-11-10&ate=2027-01-31'))
    const voltaram = depois.filter((aula) => aula.aluno.id === criado.id).map((aula) => aula.id).sort()
    expect(voltaram).toEqual(restantes)
    const ficha = await json<Aluno>(await page.request.get(`/api/alunos/${criado.id}`))
    expect(ficha.ativo).toBe(true)
  } finally {
    await page.request.post(`/api/alunos/${criado.id}/inativar`)
  }
})
