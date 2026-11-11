import { expect, test, type Page } from '@playwright/test'

const DATA = '2026-11-19'
const INICIO = '2026-11-19T07:00'
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

function cruza(inicio: number, fim: number, outroInicio: number, outroFim: number): boolean {
  return inicio < outroFim && outroInicio < fim
}

function inicioLivre(
  grupos: Array<{ inicio: string; fim: string; aulas: Array<{ status: string; aluno: { nome: string } }> }>,
  nomes: Set<string>,
  duracaoMs: number,
): string | null {
  for (let hora = 6; hora >= 0; hora -= 1) {
    const texto = `${String(hora).padStart(2, '0')}:00:00`
    const inicio = new Date(`${DATA}T${texto}-03:00`).getTime()
    const fim = inicio + duracaoMs
    const ocupado = grupos.some((grupo) => {
      if (!cruza(inicio, fim, new Date(grupo.inicio).getTime(), new Date(grupo.fim).getTime())) return false
      if (grupo.inicio.startsWith(INICIO)) return false
      return grupo.aulas.some((aula) => nomes.has(aula.aluno.nome))
    })
    if (!ocupado) return `${DATA}T${texto}-03:00`
  }
  return null
}
async function limparSeteHoras(page: Page) {
  const resposta = await page.request.get(`/api/grupos?de=${DATA}&ate=${DATA}`)
  expect(resposta.ok(), await resposta.text()).toBeTruthy()
  const grupos = (await resposta.json()) as Array<{
    id: string
    inicio: string
    aulas: Array<{ id: string; status: string; aluno: { nome: string } }>
  }>
  const nomes = new Set([...GRUPO, SETIMO])
  for (const grupo of grupos) {
    if (!grupo.inicio.startsWith(INICIO)) continue
    for (const aula of grupo.aulas) {
      if (aula.status === 'CANCELADA') continue
      if (!nomes.has(aula.aluno.nome)) continue
      const cancelamento = await page.request.post(`/api/aulas/${aula.id}/cancelar`, {
        data: { justificativa: 'Limpeza do teste da aula das 7h', geraReposicao: false },
      })
      expect(cancelamento.ok(), await cancelamento.text()).toBeTruthy()
    }
  }
  const depois = await page.request.get(`/api/grupos?de=${DATA}&ate=${DATA}`)
  expect(depois.ok(), await depois.text()).toBeTruthy()
  const restantes = (await depois.json()) as Array<{
    id: string
    inicio: string
    fim: string
    aulas: Array<{ status: string; aluno: { nome: string } }>
  }>
  for (const grupo of restantes) {
    if (!grupo.inicio.startsWith(INICIO)) continue
    if (!grupo.aulas.some((aula) => nomes.has(aula.aluno.nome))) continue
    const deslocar = inicioLivre(restantes, nomes, new Date(grupo.fim).getTime() - new Date(grupo.inicio).getTime())
    expect(deslocar, 'não há horário livre para afastar o grupo de teste').toBeTruthy()
    const deslocada = await page.request.patch(`/api/grupos/${grupo.id}`, {
      data: { inicio: deslocar },
    })
    expect(deslocada.ok(), await deslocada.text()).toBeTruthy()
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

test('o grupo ampliado aceita 6 alunos', async ({ page }) => {
  await entrar(page)
  await limparSeteHoras(page)

  try {
    await page.goto('/agenda/novo?tipo=aula')
    await expect(page.locator('#aluno-aula')).toBeVisible()
    await preencherQuando(page, '08:00')
    await expect(page.locator('#hora-aula option[value="08:00"]')).toHaveText('08:00 · 4 vagas · nenhum aluno')
    await expect(page.locator('#hora-aula option[value="07:00"]')).toHaveText('07:00 · 4 vagas · nenhum aluno')
    await expect(page.locator('#hora-aula option[value="19:00"]')).toHaveText('19:00 · 3 vagas · D')
    await expect(page.getByText('Alunos (até 4)')).toBeVisible()
    await expect(page.getByText('O grupo nasce com 4 vagas e pode ser ampliado para 6.')).toBeVisible()

    for (const nome of QUATRO) await escolherAluno(page, nome)
    await expect(page.locator('#aluno-aula')).toBeDisabled()
    await expect(page.getByText('O grupo já tem 4 alunos.')).toBeVisible()

    await page.getByRole('checkbox', { name: 'Ampliar para 6 alunos' }).check()
    await page.locator('#hora-aula').selectOption('07:00')
    await expect(page.locator('#hora-aula option[value="07:00"]')).toHaveText('07:00 · 6 vagas · nenhum aluno')
    await expect(page.getByText('Alunos (até 6)')).toBeVisible()
    await expect(page.locator('#aluno-aula')).toBeEnabled()

    for (const nome of MAIS_DOIS) await escolherAluno(page, nome)
    await expect(page.locator('#aluno-aula')).toBeDisabled()
    await expect(page.getByText('O grupo já tem 6 alunos.')).toBeVisible()

    await page.getByRole('button', { name: 'Agendar aula' }).click()
    await expect(page).toHaveURL(/\/agenda\?semana=2026-11-16/)
    await expect(page.getByText('Grupo agendado para 6 alunos.')).toBeVisible()

    const grupo = page
      .locator('section')
      .filter({ has: page.getByRole('heading', { name: /Grupo das 7h/ }) })
      .filter({ hasText: 'Bruno Souza' })
      .filter({ hasText: 'Gabriela Nunes' })
      .filter({ hasNot: page.locator('section') })
    for (const nome of GRUPO) {
      await expect(grupo.getByRole('button', { name: new RegExp(nome) }).first()).toBeVisible()
    }

    await page.goto('/agenda/novo?tipo=aula')
    await expect(page.locator('#aluno-aula')).toBeVisible()
    await page.locator('#resp-aula').selectOption({ label: 'Marina Costa' })
    await page.locator('#data-aula').fill(DATA)
    await page.getByRole('checkbox', { name: 'Ampliar para 6 alunos' }).check()
    await expect(page.locator('#hora-aula option[value="08:00"]')).toBeAttached()
    await expect(page.locator('#hora-aula option[value="07:00"]')).toHaveCount(0)
  } finally {
    await limparSeteHoras(page)
  }
})
