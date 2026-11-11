import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

const DATA = '2026-11-19'

type GrupoDoDia = {
  id: string
  inicio: string
  fim: string
  capacidade: number
  responsavel: { id: string; nome: string }
  aulas: Array<{ id: string; status: string; experimental: boolean; aluno: { id: string; nome: string; categoria: string | null } }>
}

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

function horaDe(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso))
}

function ocupa(status: string): boolean {
  return status !== 'CANCELADA' && status !== 'FALTA'
}

function vagasDo(grupo: GrupoDoDia): number {
  return grupo.capacidade - grupo.aulas.filter((aula) => ocupa(aula.status)).length
}

function cruza(grupo: GrupoDoDia, outro: GrupoDoDia): boolean {
  return new Date(grupo.inicio).getTime() < new Date(outro.fim).getTime()
    && new Date(outro.inicio).getTime() < new Date(grupo.fim).getTime()
}

test('a aula avulsa e a experimental entram num grupo com vaga', async ({ page }) => {
  await entrar(page)
  const responsaveis = await json<Array<{ id: string; nome: string }>>(await page.request.get('/api/integrantes/responsaveis'))
  const marina = responsaveis.find((pessoa) => pessoa.nome === 'Marina Costa')
  expect(marina).toBeTruthy()
  const alunos = await json<Array<{ id: string; nome: string }>>(await page.request.get('/api/alunos'))
  const bruno = alunos.find((aluno) => aluno.nome === 'Bruno Souza')
  const ana = alunos.find((aluno) => aluno.nome === 'Ana Lima')
  expect(bruno && ana).toBeTruthy()

  const antes = await json<GrupoDoDia[]>(await page.request.get(`/api/grupos?de=${DATA}&ate=${DATA}`))
  const daAna = antes.filter((grupo) => grupo.aulas.some((aula) => aula.aluno.id === ana!.id))
  const doBruno = antes.filter((grupo) => grupo.aulas.some((aula) => aula.aluno.id === bruno!.id))
  const existente = antes.find(
    (grupo) =>
      grupo.responsavel.id === marina!.id
      && vagasDo(grupo) >= 2
      && !grupo.aulas.some((aula) => aula.aluno.id === ana!.id || aula.aluno.id === bruno!.id)
      && !daAna.some((outro) => cruza(grupo, outro))
      && !doBruno.some((outro) => cruza(grupo, outro)),
  )
  let criado: GrupoDoDia | null = null
  if (!existente) {
    for (const hora of ['15:00', '16:00', '17:00', '18:00', '20:00', '21:00', '10:00', '11:00']) {
      const inicio = `${DATA}T${hora}:00-03:00`
      const fim = new Date(new Date(inicio).getTime() + 60 * 60 * 1000).toISOString()
      const candidato = { inicio, fim } as GrupoDoDia
      if (daAna.some((outro) => cruza(candidato, outro)) || doBruno.some((outro) => cruza(candidato, outro))) continue
      const resposta = await page.request.post('/api/grupos', {
        data: { responsavelId: marina!.id, inicio, alunoIds: [bruno!.id] },
      })
      if (!resposta.ok()) continue
      criado = (await resposta.json()) as GrupoDoDia
      break
    }
  }
  const grupo = existente ?? criado
  expect(grupo, 'grupo com vaga para a verificação').toBeTruthy()
  const hora = horaDe(grupo!.inicio)
  const vagas = existente ? vagasDo(existente) : grupo!.capacidade - 1

  try {
    await page.goto('/agenda/novo?tipo=aula')
    await expect(page.getByRole('checkbox', { name: 'Ampliar para 6 alunos' })).toHaveCount(0)
    await expect(page.getByLabel('Término')).toHaveCount(0)
    await expect(page.getByText('A aula entra num grupo que já tem vaga.')).toBeVisible()

    await page.locator('#resp-aula').selectOption({ label: 'Marina Costa' })
    await page.locator('#data-aula').fill(DATA)
    const opcao = page.locator('#hora-aula option', { hasText: new RegExp(`^${hora} ·`) })
    await expect(opcao).toHaveText(new RegExp(`${hora} · ${vagas} vagas`))
    const horasDoDia = await page.locator('#hora-aula option').evaluateAll((opcoes) =>
      opcoes.map((opcao) => (opcao.textContent ?? '').slice(0, 5)).filter((texto) => /^\d{2}:\d{2}$/.test(texto)),
    )
    const semGrupo = ['06:00', '08:00', '09:00', '10:00', '22:00', '23:00'].find((item) => item !== hora && !horasDoDia.includes(item))
    expect(semGrupo, 'hora sem grupo para conferir a lista').toBeTruthy()
    await expect(page.locator('#hora-aula option', { hasText: new RegExp(`^${semGrupo}`) })).toHaveCount(0)

    const valor = await opcao.getAttribute('value')
    await page.locator('#hora-aula').selectOption(valor!)
    const campo = page.locator('#aluno-aula')
    await campo.click()
    await campo.fill('Ana Lima')
    await page.getByRole('option', { name: /^Ana Lima ·/ }).click()
    await page.getByRole('button', { name: 'Agendar aula' }).click()
    await expect(page.getByText('Aula agendada.')).toBeVisible()

    await page.goto('/agenda/novo?tipo=aula')
    await page.getByRole('checkbox', { name: 'Aula experimental' }).check()
    await page.locator('#aluno-aula').fill('Visita Avulsa')
    await page.locator('#resp-aula').selectOption({ label: 'Marina Costa' })
    await page.locator('#data-aula').fill(DATA)
    const valorExperimental = await page.locator('#hora-aula option', { hasText: new RegExp(`^${hora} ·`) }).getAttribute('value')
    await page.locator('#hora-aula').selectOption(valorExperimental!)
    await page.getByRole('button', { name: 'Agendar aula' }).click()
    await expect(page.getByText('Aula agendada.')).toBeVisible()

    const depois = await json<GrupoDoDia[]>(await page.request.get(`/api/grupos?de=${DATA}&ate=${DATA}`))
    const sessao = depois.find((item) => item.id === grupo!.id)
    const daAna = sessao?.aulas.find((aula) => aula.aluno.id === ana!.id && aula.status === 'AGUARDANDO')
    const visita = sessao?.aulas.find((aula) => aula.aluno.nome === 'Visita Avulsa' && aula.status === 'AGUARDANDO')
    expect(daAna?.experimental).toBe(false)
    expect(visita?.experimental).toBe(true)
    expect(sessao?.capacidade).toBe(grupo!.capacidade)
    expect(new Date(sessao!.fim).getTime()).toBe(new Date(grupo!.fim).getTime())
  } finally {
    const grupos = await json<GrupoDoDia[]>(await page.request.get(`/api/grupos?de=${DATA}&ate=${DATA}`))
    const sessao = grupos.find((item) => item.id === grupo!.id)
    for (const aula of sessao?.aulas ?? []) {
      const limpar = aula.aluno.nome === 'Visita Avulsa' || (!existente && aula.aluno.id === bruno!.id) || aula.aluno.id === ana!.id
      if (!limpar || aula.status === 'CANCELADA') continue
      await page.request.post(`/api/aulas/${aula.id}/cancelar`, {
        data: { justificativa: 'Limpeza da verificação de aula avulsa', geraReposicao: false },
      })
    }
  }
})
