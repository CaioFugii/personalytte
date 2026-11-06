import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import type { Aluno, Aula, Responsavel } from '../src/api/types'

const DIA = '2026-12-20'
const DIA_REPOSICAO = '2026-12-21'

async function entrar(page: Page) {
  await page.goto('/login')
  await page.locator('#email').fill('admin@personalytte.local')
  await page.locator('#senha').fill('senha-inicial')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).not.toHaveURL(/\/login/)
}

async function json<T>(resposta: Awaited<ReturnType<APIRequestContext['get']>>): Promise<T> {
  expect(resposta.ok(), await resposta.text()).toBeTruthy()
  return resposta.json() as Promise<T>
}

test('a reposição só entra se o aluno ainda tem vaga', async ({ page }) => {
  await entrar(page)
  const alunos = await json<Aluno[]>(await page.request.get('/api/alunos?busca=Ana%20Lima'))
  const ana = alunos.find((aluno) => aluno.nome === 'Ana Lima')
  expect(ana).toBeTruthy()
  const responsaveis = await json<Responsavel[]>(await page.request.get('/api/integrantes/responsaveis'))
  const marina = responsaveis.find((pessoa) => pessoa.nome === 'Marina Costa')
  expect(marina).toBeTruthy()
  const antes = ana!.reposicoesDisponiveis

  const criada = await page.request.post('/api/aulas', {
    data: {
      alunoId: ana!.id,
      responsavelId: marina!.id,
      inicio: `${DIA}T16:00:00-03:00`,
      experimental: false,
    },
  })
  expect(criada.ok(), await criada.text()).toBeTruthy()
  const origem = (await criada.json()) as Aula
  const falta = await page.request.patch(`/api/aulas/${origem.id}`, { data: { status: 'FALTA' } })
  expect(falta.ok(), await falta.text()).toBeTruthy()
  const depoisDaFalta = await json<Aluno>(await page.request.get(`/api/alunos/${ana!.id}`))
  expect(depoisDaFalta.reposicoesDisponiveis).toBe(antes)

  try {
    await page.goto(`/agenda/aulas/${origem.id}`)
    await expect(page.getByText(`Reposições disponíveis deste aluno: ${antes}`)).toBeVisible()
    await page.getByRole('checkbox', { name: 'Criar reposição' }).check()
    await page.locator('#justificativa-reposicao').fill('Aluno avisou com antecedência')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Vaga de reposição registrada.')).toBeVisible()

    await page.goto('/acompanhamento')
    const saldo = page.getByRole('region', { name: 'Reposições disponíveis' })
    await expect(saldo.getByRole('row', { name: /Ana Lima/ })).toContainText(String(antes + 1))

    await page.goto(`/agenda/aulas/${origem.id}`)
    await expect(page.getByText(`Reposições disponíveis deste aluno: ${antes + 1}`)).toBeVisible()
    await expect(page.locator('#justificativa-reposicao')).toHaveValue('Aluno avisou com antecedência')
    await page.locator('#resp-reposicao').selectOption({ label: 'Marina Costa' })
    await page.locator('#data-reposicao').fill(DIA_REPOSICAO)
    await page.locator('#hora-reposicao').fill('16:00')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Falta registrada e reposição criada.')).toBeVisible()

    await page.goto(`/agenda/aulas/${origem.id}`)
    await expect(page.getByText('A reposição desta aula já está agendada.')).toBeVisible()
    await expect(page.getByRole('checkbox', { name: 'Criar reposição' })).toHaveCount(0)
    await page.getByRole('link', { name: 'Abrir reposição' }).click()
    await expect(page).toHaveURL(/\/agenda\/aulas\//)

    await page.goto('/acompanhamento')
    const saldoFinal = page.getByRole('region', { name: 'Reposições disponíveis' })
    if (antes === 0) {
      await expect(saldoFinal.getByRole('row', { name: /Ana Lima/ })).toHaveCount(0)
    } else {
      await expect(saldoFinal.getByRole('row', { name: /Ana Lima/ })).toContainText(String(antes))
    }
  } finally {
    const aulas = await json<Aula[]>(await page.request.get(`/api/aulas?de=${DIA}&ate=${DIA_REPOSICAO}`))
    const aberta = aulas.find((aula) => aula.reposicaoDeAulaId === origem.id && aula.status !== 'CANCELADA')
    if (aberta) {
      await page.request.post(`/api/aulas/${aberta.id}/cancelar`, {
        data: { justificativa: 'Limpeza da verificação de reposição', geraReposicao: false },
      })
    }
    await page.request.post(`/api/aulas/${origem.id}/cancelar`, {
      data: { justificativa: 'Limpeza da verificação de reposição', geraReposicao: false },
    })
  }
})
