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

type GrupoComVaga = {
  inicio: string
  fim: string
  capacidade: number
  responsavel: { id: string }
  aulas: Array<{ status: string; aluno: { id: string } }>
}

function horaDe(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso))
}

function vagasDo(grupo: GrupoComVaga): number {
  const ocupando = grupo.aulas.filter((aula) => aula.status !== 'CANCELADA' && aula.status !== 'FALTA').length
  return grupo.capacidade - ocupando
}

async function garantirGrupoComVaga(page: Page, responsavelId: string, dia: string, alunoId: string): Promise<string> {
  const atuais = await json<GrupoComVaga[]>(await page.request.get(`/api/grupos?de=${dia}&ate=${dia}`))
  const pronto = atuais.find(
    (grupo) =>
      grupo.responsavel.id === responsavelId
      && vagasDo(grupo) >= 1
      && !grupo.aulas.some((aula) => aula.aluno.id === alunoId),
  )
  if (pronto) return horaDe(pronto.inicio)

  const alunos = await json<Aluno[]>(await page.request.get('/api/alunos?busca=Bruno%20Souza'))
  const bruno = alunos.find((aluno) => aluno.nome === 'Bruno Souza')
  expect(bruno).toBeTruthy()
  for (const hora of ['15:00', '16:00', '17:00', '18:00', '20:00', '21:00', '10:00', '11:00']) {
    const criado = await page.request.post('/api/grupos', {
      data: { responsavelId, inicio: `${dia}T${hora}:00-03:00`, alunoIds: [bruno!.id] },
    })
    if (criado.ok()) return hora
  }
  throw new Error('Não foi possível preparar um grupo com vaga.')
}

function cruza(inicio: string, fim: string, outroInicio: string, outroFim: string): boolean {
  return new Date(inicio).getTime() < new Date(outroFim).getTime() && new Date(outroInicio).getTime() < new Date(fim).getTime()
}

function inicioLivre(
  grupos: GrupoComVaga[],
  dia: string,
  alunoId: string,
  responsavelId: string,
): string | null {
  for (let hora = 6; hora <= 21; hora += 1) {
    if (hora === 12 || hora === 13) continue
    const texto = `${String(hora).padStart(2, '0')}:00`
    const inicio = `${dia}T${texto}:00-03:00`
    const fim = new Date(new Date(inicio).getTime() + 60 * 60 * 1000).toISOString()
    const ocupado = grupos.some((grupo) => {
      if (!cruza(inicio, fim, grupo.inicio, grupo.fim)) return false
      if (grupo.aulas.some((aula) => aula.aluno.id === alunoId)) return true
      return grupo.responsavel.id === responsavelId && grupo.aulas.some((aula) => aula.status !== 'CANCELADA' && aula.status !== 'FALTA')
    })
    if (!ocupado) return inicio
  }
  return null
}

async function escolherHorario(page: Page, hora: string) {
  const valor = await page.locator('#hora-aula option').evaluateAll((opcoes, prefixo) => {
    const alvo = (opcoes as HTMLOptionElement[]).find((opcao) => (opcao.textContent ?? '').startsWith(prefixo))
    return alvo?.value ?? ''
  }, hora)
  expect(valor, `horário ${hora}`).toBeTruthy()
  await page.locator('#hora-aula').selectOption(valor)
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
  const gruposDoPeriodo = await json<GrupoComVaga[]>(await page.request.get(`/api/grupos?de=${DIA}&ate=${DIA_REPOSICAO}`))
  const inicioOrigem = inicioLivre(gruposDoPeriodo, DIA, ana!.id, marina!.id)
  const inicioReposicao = inicioLivre(gruposDoPeriodo, DIA_REPOSICAO, ana!.id, marina!.id)
  expect(inicioOrigem && inicioReposicao).toBeTruthy()

  const criada = await page.request.post('/api/aulas', {
    data: {
      alunoId: ana!.id,
      responsavelId: marina!.id,
      inicio: inicioOrigem,
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
    await page.locator('#hora-reposicao').fill(horaDe(inicioReposicao!))
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

test('o novo agendamento usa a reposição disponível do aluno', async ({ page }) => {
  await entrar(page)
  const responsaveis = await json<Responsavel[]>(await page.request.get('/api/integrantes/responsaveis'))
  const marina = responsaveis.find((pessoa) => pessoa.nome === 'Marina Costa')
  expect(marina).toBeTruthy()
  const criado = await page.request.post('/api/alunos', {
    data: {
      nome: 'Verificacao Reposicao',
      telefone: '11900003344',
      genero: 'FEMININO',
      plano: 'PARTICULAR',
      categoria: 'D',
      horarios: [],
    },
  })
  expect(criado.ok(), await criado.text()).toBeTruthy()
  const aluno = (await criado.json()) as Aluno

  try {
    const origemResposta = await page.request.post('/api/aulas', {
      data: {
        alunoId: aluno.id,
        responsavelId: marina!.id,
        inicio: `${DIA}T15:00:00-03:00`,
        experimental: false,
      },
    })
    expect(origemResposta.ok(), await origemResposta.text()).toBeTruthy()
    const origem = (await origemResposta.json()) as Aula
    const concedida = await page.request.patch(`/api/aulas/${origem.id}`, {
      data: { status: 'FALTA', concederReposicao: { justificativa: 'Aluno avisou' } },
    })
    expect(concedida.ok(), await concedida.text()).toBeTruthy()

    await page.goto('/agenda/novo?tipo=aula')
    const campo = page.locator('#aluno-aula')
    await campo.click()
    await campo.fill('Verificacao Reposicao')
    await page.getByRole('option', { name: /^Verificacao Reposicao ·/ }).click()
    await expect(page.getByRole('checkbox', { name: 'Usar reposição' })).toBeVisible()
    await expect(page.getByText('Este aluno tem 1 reposição disponível.')).toBeVisible()
    await page.getByRole('checkbox', { name: 'Usar reposição' }).check()
    await page.locator('#resp-aula').selectOption({ label: 'Marina Costa' })
    await page.locator('#data-aula').fill('2026-12-22')
    const hora = await garantirGrupoComVaga(page, marina!.id, '2026-12-22', aluno.id)
    await escolherHorario(page, hora)
    await page.getByRole('button', { name: 'Agendar aula' }).click()
    await expect(page.getByText('Reposição agendada.')).toBeVisible()

    const saldo = await json<Aluno>(await page.request.get(`/api/alunos/${aluno.id}`))
    expect(saldo.reposicoesDisponiveis).toBe(0)
    const aulas = await json<Aula[]>(await page.request.get(`/api/aulas?de=${DIA}&ate=2026-12-22`))
    const reposicao = aulas.find((aula) => aula.aluno.id === aluno.id && aula.reposicaoDeAulaId === origem.id)
    expect(reposicao?.status).toBe('AGUARDANDO')
  } finally {
    const aulas = await json<Aula[]>(await page.request.get(`/api/aulas?de=${DIA}&ate=2026-12-22`))
    for (const aula of aulas.filter((item) => item.aluno.id === aluno.id && item.status !== 'CANCELADA')) {
      await page.request.post(`/api/aulas/${aula.id}/cancelar`, {
        data: { justificativa: 'Limpeza da verificação de reposição', geraReposicao: false },
      })
    }
    await page.request.post(`/api/alunos/${aluno.id}/inativar`)
  }
})
