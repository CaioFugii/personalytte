import { MikroORM, type EntityManager } from '@mikro-orm/postgresql';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { definirSessao } from '../src/comum/cookie';
import { MENSAGEM_GRUPO_CHEIO, MENSAGEM_OCUPADO } from '../src/comum/erros';
import { formatarInstante } from '../src/comum/tempo';
import { AgendaService } from '../src/dominio/agenda.service';
import { Aluno } from '../src/entidades/aluno.entity';
import { Aula } from '../src/entidades/aula.entity';
import { Integrante } from '../src/entidades/integrante.entity';
import { AlunosService } from '../src/modulos/alunos/alunos.service';
import { AulasService } from '../src/modulos/aulas/aulas.service';
import { EventosService } from '../src/modulos/eventos/eventos.service';
import { IntegrantesService } from '../src/modulos/integrantes/integrantes.service';
import { SessaoService } from '../src/modulos/sessao/sessao.service';
import { criarOrmConfig } from '../src/orm.config';
import { TRUNCAR, garantirBancoTeste } from './banco';

const AGORA = new Date('2026-10-21T15:00:00-03:00');

function iso(data: Date): string {
  return formatarInstante(data);
}

function em(data: string): Date {
  return new Date(data);
}

type Servicos = {
  em: EntityManager;
  agenda: AgendaService;
  integrantes: IntegrantesService;
  alunos: AlunosService;
  aulas: AulasService;
  eventos: EventosService;
  sessao: SessaoService;
};

function servicos(orm: MikroORM): Servicos {
  const contexto = orm.em.fork();
  const agenda = new AgendaService();
  return {
    em: contexto,
    agenda,
    integrantes: new IntegrantesService(contexto),
    alunos: new AlunosService(contexto, agenda),
    aulas: new AulasService(contexto, agenda),
    eventos: new EventosService(contexto, agenda),
    sessao: new SessaoService(contexto),
  };
}

async function professor(s: Servicos, email = 'marina@personalytte.local') {
  return s.integrantes.criar({
    nome: 'Marina Costa',
    email,
    senha: 'professor1',
    funcao: 'PROFESSOR',
    telefone: '11988887777',
  });
}

async function socio(s: Servicos, email = 'socio@personalytte.local') {
  return s.integrantes.criar({
    nome: 'Sócio',
    email,
    senha: 'senha-inicial',
    funcao: 'SOCIO',
  });
}

async function aulasDe(orm: MikroORM, alunoId?: string): Promise<Aula[]> {
  return orm.em.fork().find(Aula, alunoId ? { aluno: alunoId } : {}, {
    populate: ['aluno', 'responsavel', 'reposicaoDe'],
    orderBy: { inicio: 'asc' },
  });
}

describe('regras de domínio', () => {
  let orm: MikroORM;

  beforeAll(async () => {
    await garantirBancoTeste();
    orm = await MikroORM.init(criarOrmConfig());
    await orm.migrator.up();
  });

  afterAll(async () => {
    await orm?.close(true);
  });

  beforeEach(async () => {
    await orm.em.fork().getConnection().execute(TRUNCAR);
  });

  it('cadastra aluno sem plano e gera ocorrências futuras de 60 minutos no mesmo dia', async () => {
    const s = servicos(orm);
    const responsavel = await professor(s);
    const semPlano = await s.alunos.criar({
      nome: 'Bruno Souza',
      telefone: '(11) 91111-0002',
      email: null,
      instagram: '@Bruno.Souza',
      plano: 'GYMPASS',
      categoria: 'C',
    }, AGORA);
    expect(semPlano.telefone).toBe('11911110002');
    expect(semPlano.instagram).toBe('Bruno.Souza');
    expect(semPlano.horarios).toEqual([]);
    expect(await aulasDe(orm, semPlano.id)).toHaveLength(0);
    await expect(s.alunos.criar({
      nome: 'Incompleto',
      telefone: '11911110009',
      plano: 'MENSAL',
      categoria: 'B',
      horarios: [{ dia: 'seg', horarioInicio: '19:00' }],
    }, AGORA)).rejects.toMatchObject({ codigo: 'PLANO_INCOMPLETO' });
    await expect(s.alunos.criar({
      nome: 'Madrugada',
      telefone: '11911110008',
      plano: 'PARTICULAR',
      categoria: 'A',
      horarios: [{ dia: 'seg', horarioInicio: '23:30' }],
      responsavelId: responsavel.id,
    }, AGORA)).rejects.toMatchObject({ codigo: 'DADOS_INVALIDOS' });
    const caio = await s.alunos.criar({
      nome: 'Caio',
      telefone: '11911110007',
      plano: 'PARTICULAR',
      categoria: 'C',
      horarios: [
        { dia: 'seg', horarioInicio: '19:00' },
        { dia: 'qui', horarioInicio: '09:00' },
      ],
      responsavelId: responsavel.id,
    }, AGORA);
    const horasCaio = (await aulasDe(orm, caio.id)).map((aula) => iso(aula.inicio));
    expect(horasCaio).toContain('2026-10-22T09:00:00-03:00');
    expect(horasCaio).toContain('2026-10-26T19:00:00-03:00');
    await expect(s.alunos.criar({
      nome: 'Repetido',
      telefone: '11911110006',
      plano: 'PARTICULAR',
      categoria: 'D',
      horarios: [
        { dia: 'ter', horarioInicio: '19:00' },
        { dia: 'ter', horarioInicio: '19:30' },
      ],
      responsavelId: responsavel.id,
    }, AGORA)).rejects.toMatchObject({ codigo: 'DADOS_INVALIDOS' });

    const ana = await s.alunos.criar({
      nome: 'Ana Lima',
      telefone: '11911110001',
      email: 'ana@email.com',
      plano: 'PARTICULAR',
      categoria: 'D',
      horarios: [{ dia: 'qui', horarioInicio: '19:00' }],
      responsavelId: responsavel.id,
    }, AGORA);
    const aulas = await aulasDe(orm, ana.id);
    const inicios = aulas.map((aula) => iso(aula.inicio));
    expect(inicios).toContain('2026-10-22T19:00:00-03:00');
    expect(inicios).toContain('2026-12-10T19:00:00-03:00');
    expect(inicios).not.toContain('2026-12-17T19:00:00-03:00');
    expect(aulas.length).toBeGreaterThan(0);
    for (const aula of aulas) {
      expect(aula.status).toBe('AGUARDANDO');
      expect(aula.ligadaAoPlano).toBe(true);
      expect(aula.inicio.getTime()).toBeGreaterThan(AGORA.getTime());
      expect(aula.inicio.getTime()).toBeLessThan(em('2026-12-16T00:00:00-03:00').getTime());
      expect(iso(new Date(aula.inicio.getTime() + 60 * 60 * 1000))).toMatch(/T20:00:00-03:00$/);
      expect(iso(aula.inicio).slice(0, 10)).toBe(iso(new Date(aula.inicio.getTime() + 60 * 60 * 1000)).slice(0, 10));
    }
    const repetido = await new AgendaService().estenderHorizonte(orm.em.fork(), AGORA);
    expect(repetido).toBe(0);
  });

  it('recusa cruzamento do mesmo responsável ou aluno e ignora aula cancelada', async () => {
    const s = servicos(orm);
    const marina = await professor(s);
    const outro = await professor(s, 'outro@personalytte.local');
    const ana = await s.alunos.criar({ nome: 'Ana', telefone: '11911110001', plano: 'PARTICULAR', categoria: 'D' }, AGORA);
    const bruno = await s.alunos.criar({ nome: 'Bruno', telefone: '11911110002', plano: 'GYMPASS', categoria: 'C' }, AGORA);
    await s.aulas.criar({ alunoId: ana.id, responsavelId: marina.id, inicio: '2026-10-22T19:00:00-03:00', experimental: false }, AGORA);
    await expect(s.aulas.criar({
      alunoId: bruno.id, responsavelId: marina.id, inicio: '2026-10-22T19:30:00-03:00', experimental: false,
    }, AGORA)).rejects.toMatchObject({ codigo: 'HORARIO_OCUPADO', status: 409 });
    await expect(s.aulas.criar({
      alunoId: ana.id, responsavelId: outro.id, inicio: '2026-10-22T19:15:00-03:00', experimental: false,
    }, AGORA)).rejects.toMatchObject({ codigo: 'HORARIO_OCUPADO' });
    const seguinte = await s.aulas.criar({
      alunoId: bruno.id, responsavelId: marina.id, inicio: '2026-10-22T20:00:00-03:00', experimental: false,
    }, AGORA);
    expect(seguinte.inicio).toBe('2026-10-22T20:00:00-03:00');
    const ocupada = (await aulasDe(orm, ana.id))[0];
    await s.aulas.atualizar(ocupada.id, { status: 'FALTA' }, AGORA);
    await expect(s.aulas.criar({
      alunoId: ana.id, responsavelId: outro.id, inicio: '2026-10-22T19:00:00-03:00', experimental: false,
    }, AGORA)).rejects.toMatchObject({ codigo: 'HORARIO_OCUPADO' });
    await s.aulas.cancelar(ocupada.id, { justificativa: 'Aluno viajou', geraReposicao: false }, AGORA);
    const liberada = await s.aulas.criar({
      alunoId: bruno.id, responsavelId: outro.id, inicio: '2026-10-22T19:00:00-03:00', experimental: true,
    }, AGORA);
    expect(liberada.status).toBe('AGUARDANDO');
    expect(liberada.experimental).toBe(true);
    expect(liberada.ligadaAoPlano).toBe(false);
    await expect(s.aulas.criar({
      alunoId: ana.id, responsavelId: marina.id, inicio: '2026-10-22T23:30:00-03:00', experimental: false,
    }, AGORA)).rejects.toMatchObject({ codigo: 'DADOS_INVALIDOS' });
  });

  it('agrupa até 4 alunos no mesmo início com o mesmo professor', async () => {
    const s = servicos(orm);
    const marina = await professor(s);
    const alunos = [];
    for (let i = 1; i <= 6; i += 1) {
      alunos.push(await s.alunos.criar({ nome: `Aluno ${i}`, telefone: `1191111000${i}`, plano: 'PARTICULAR', categoria: 'D' }, AGORA));
    }
    const inicio = '2026-10-22T19:00:00-03:00';
    const grupo = await s.aulas.criarGrupo({
      alunoIds: alunos.slice(0, 3).map((aluno) => aluno.id), responsavelId: marina.id, inicio, experimental: false,
    }, AGORA);
    expect(grupo).toHaveLength(3);
    await s.aulas.criar({ alunoId: alunos[3].id, responsavelId: marina.id, inicio, experimental: false }, AGORA);
    await expect(s.aulas.criar({ alunoId: alunos[4].id, responsavelId: marina.id, inicio, experimental: false }, AGORA))
      .rejects.toMatchObject({ codigo: 'HORARIO_OCUPADO', mensagem: MENSAGEM_GRUPO_CHEIO });
    await expect(s.aulas.criar({
      alunoId: alunos[4].id, responsavelId: marina.id, inicio: '2026-10-22T19:30:00-03:00', experimental: false,
    }, AGORA)).rejects.toMatchObject({ codigo: 'HORARIO_OCUPADO', mensagem: MENSAGEM_OCUPADO });
    await expect(s.aulas.criarGrupo({
      alunoIds: [alunos[4].id, alunos[4].id], responsavelId: marina.id, inicio: '2026-10-23T19:00:00-03:00', experimental: false,
    }, AGORA)).rejects.toMatchObject({ codigo: 'DADOS_INVALIDOS' });
    await expect(s.aulas.criarGrupo({
      alunoIds: alunos.slice(0, 5).map((aluno) => aluno.id), responsavelId: marina.id, inicio: '2026-10-23T19:00:00-03:00', experimental: false,
    }, AGORA)).rejects.toMatchObject({ codigo: 'DADOS_INVALIDOS' });
    await expect(s.aulas.criarGrupo({
      alunoIds: [alunos[4].id, alunos[0].id], responsavelId: marina.id, inicio: '2026-10-22T19:00:00-03:00', experimental: false,
    }, AGORA)).rejects.toMatchObject({ codigo: 'HORARIO_OCUPADO' });
    expect(await aulasDe(orm, alunos[4].id)).toHaveLength(0);

    await s.aulas.cancelar(grupo[0].id, { justificativa: 'Aluno doente', geraReposicao: false }, AGORA);
    await s.aulas.criar({ alunoId: alunos[4].id, responsavelId: marina.id, inicio, experimental: false }, AGORA);
    const banco = orm.em.fork().getConnection();
    await expect(banco.execute(
      `insert into aulas (id, aluno_id, responsavel_id, inicio, fim, status, experimental, ligada_ao_plano)
       values (gen_random_uuid(), '${alunos[5].id}', '${marina.id}', '2026-10-22T19:30:00-03:00', '2026-10-22T20:30:00-03:00', 'AGUARDANDO', false, false)`,
    )).rejects.toBeDefined();
  });

  it('cancela com justificativa e diz se gera reposição', async () => {
    const s = servicos(orm);
    const marina = await professor(s);
    const ana = await s.alunos.criar({ nome: 'Ana', telefone: '11911110001', plano: 'PARTICULAR', categoria: 'D' }, AGORA);
    const aula = await s.aulas.criar({
      alunoId: ana.id, responsavelId: marina.id, inicio: '2026-10-22T19:00:00-03:00', experimental: false,
    }, AGORA);
    await expect(s.aulas.cancelar(aula.id, { geraReposicao: true }, AGORA)).rejects.toMatchObject({ codigo: 'DADOS_INVALIDOS' });
    await expect(s.aulas.cancelar(aula.id, { justificativa: 'Chuva' }, AGORA)).rejects.toMatchObject({ codigo: 'DADOS_INVALIDOS' });
    await expect(s.aulas.cancelar(aula.id, {
      justificativa: 'Chuva', geraReposicao: false,
      reposicao: { responsavelId: marina.id, inicio: '2026-10-24T09:00:00-03:00' },
    }, AGORA)).rejects.toMatchObject({ codigo: 'DADOS_INVALIDOS' });
    const cancelada = await s.aulas.cancelar(aula.id, {
      justificativa: '  Chuva forte  ', geraReposicao: true,
      reposicao: { responsavelId: marina.id, inicio: '2026-10-22T19:00:00-03:00' },
    }, AGORA);
    expect(cancelada.status).toBe('CANCELADA');
    expect(cancelada.cancelamento).toEqual({ justificativa: 'Chuva forte', geraReposicao: true });
    const reposicoes = (await aulasDe(orm, ana.id)).filter((item) => item.reposicaoDe?.id === aula.id);
    expect(reposicoes.map((item) => iso(item.inicio))).toEqual(['2026-10-22T19:00:00-03:00']);
    await expect(s.aulas.cancelar(aula.id, { justificativa: 'De novo', geraReposicao: false }, AGORA))
      .rejects.toMatchObject({ codigo: 'DADOS_INVALIDOS' });
    await s.aulas.atualizar(aula.id, { reposicao: { responsavelId: marina.id, inicio: '2026-10-24T09:00:00-03:00' } }, AGORA);
    expect((await aulasDe(orm, ana.id)).filter((item) => item.reposicaoDe?.id === aula.id)).toHaveLength(2);

    const outra = await s.aulas.criar({
      alunoId: ana.id, responsavelId: marina.id, inicio: '2026-10-25T09:00:00-03:00', experimental: false,
    }, AGORA);
    await s.aulas.cancelar(outra.id, { justificativa: 'Professor ausente', geraReposicao: false }, AGORA);
    await expect(s.aulas.atualizar(outra.id, {
      reposicao: { responsavelId: marina.id, inicio: '2026-10-26T09:00:00-03:00' },
    }, AGORA)).rejects.toMatchObject({ codigo: 'DADOS_INVALIDOS' });
    const reativada = await s.aulas.atualizar(outra.id, { status: 'AGUARDANDO' }, AGORA);
    expect(reativada.cancelamento).toBeNull();
    expect(await orm.em.fork().findOneOrFail(Aula, outra.id)).toMatchObject({
      justificativaCancelamento: null,
      cancelamentoGeraReposicao: null,
    });
  });

  it('recria só as futuras aguardando ligadas ao plano e solta a ocorrência editada', async () => {
    const s = servicos(orm);
    const marina = await professor(s);
    const socioAtual = await socio(s);
    const ana = await s.alunos.criar({
      nome: 'Ana Lima',
      telefone: '11911110001',
      plano: 'PARTICULAR',
      categoria: 'D',
      horarios: [
        { dia: 'ter', horarioInicio: '19:00' },
        { dia: 'qui', horarioInicio: '19:00' },
      ],
      responsavelId: marina.id,
    }, AGORA);
    const antes = await aulasDe(orm, ana.id);
    const quinta = antes.find((aula) => iso(aula.inicio) === '2026-10-22T19:00:00-03:00');
    const terca = antes.find((aula) => iso(aula.inicio) === '2026-10-27T19:00:00-03:00');
    const outraQuinta = antes.find((aula) => iso(aula.inicio) === '2026-10-29T19:00:00-03:00');
    expect(quinta && terca && outraQuinta).toBeTruthy();
    const confirmada = await s.aulas.atualizar(quinta!.id, { status: 'CONFIRMADA' }, AGORA);
    expect(confirmada.ligadaAoPlano).toBe(true);
    const falta = await s.aulas.atualizar(terca!.id, { status: 'FALTA' }, AGORA);
    expect(falta.ligadaAoPlano).toBe(true);
    const solta = await s.aulas.atualizar(outraQuinta!.id, { inicio: '2026-10-29T20:00:00-03:00' }, AGORA);
    expect(solta.ligadaAoPlano).toBe(false);
    await s.alunos.atualizar(ana.id, { categoria: 'A' }, AGORA);
    expect((await aulasDe(orm, ana.id)).filter((aula) => aula.ligadaAoPlano && aula.status === 'AGUARDANDO').length).toBe(antes.length - 3);

    await s.alunos.atualizar(ana.id, {
      horarios: [
        { dia: 'qua', horarioInicio: '18:00' },
        { dia: 'sex', horarioInicio: '18:00' },
      ],
      responsavelId: marina.id,
    }, AGORA);
    const depois = await aulasDe(orm, ana.id);
    const mantida = depois.find((aula) => aula.id === quinta!.id);
    const faltaMantida = depois.find((aula) => aula.id === terca!.id);
    const deslocada = depois.find((aula) => aula.id === outraQuinta!.id);
    expect(mantida?.status).toBe('CONFIRMADA');
    expect(mantida?.ligadaAoPlano).toBe(true);
    expect(iso(mantida!.inicio)).toBe('2026-10-22T19:00:00-03:00');
    expect(faltaMantida?.status).toBe('FALTA');
    expect(faltaMantida?.ligadaAoPlano).toBe(true);
    expect(iso(deslocada!.inicio)).toBe('2026-10-29T20:00:00-03:00');
    expect(deslocada?.ligadaAoPlano).toBe(false);
    expect(depois.some((aula) => iso(aula.inicio) === '2026-10-29T19:00:00-03:00')).toBe(false);
    const novas = depois.filter((aula) => aula.ligadaAoPlano && aula.status === 'AGUARDANDO');
    expect(novas.length).toBeGreaterThan(0);
    expect(novas.every((aula) => iso(aula.inicio).endsWith('T18:00:00-03:00'))).toBe(true);
    expect(novas.some((aula) => iso(aula.inicio) === '2026-10-21T18:00:00-03:00')).toBe(true);
    expect(depois.filter((aula) => aula.ligadaAoPlano && aula.status === 'AGUARDANDO' && iso(aula.inicio).endsWith('T19:00:00-03:00'))).toHaveLength(0);

    const sexta = novas.find((aula) => iso(aula.inicio) === '2026-10-23T18:00:00-03:00');
    expect(sexta).toBeTruthy();
    const trocada = await s.aulas.atualizar(sexta!.id, { responsavelId: socioAtual.id }, AGORA);
    expect(trocada.ligadaAoPlano).toBe(false);
    await s.alunos.atualizar(ana.id, { horarios: [{ dia: 'qua', horarioInicio: '18:00' }], responsavelId: marina.id }, AGORA);
    const final = await aulasDe(orm, ana.id);
    expect(final.find((aula) => aula.id === sexta!.id)?.ligadaAoPlano).toBe(false);
    expect(final.find((aula) => aula.id === sexta!.id)?.responsavel.id).toBe(socioAtual.id);
    expect(final.some((aula) => aula.ligadaAoPlano && iso(aula.inicio) === '2026-10-21T18:00:00-03:00')).toBe(true);
  });

  it('marca falta sozinha ou com reposição aguardando fora do plano', async () => {
    const s = servicos(orm);
    const marina = await professor(s);
    const ana = await s.alunos.criar({
      nome: 'Ana Lima',
      telefone: '11911110001',
      plano: 'MENSAL',
      categoria: 'B',
      horarios: [{ dia: 'qui', horarioInicio: '19:00' }],
      responsavelId: marina.id,
    }, AGORA);
    const origemPlano = (await aulasDe(orm, ana.id))[0];
    const quantidade = (await aulasDe(orm, ana.id)).length;
    const faltaPlano = await s.aulas.atualizar(origemPlano.id, { status: 'FALTA' }, AGORA);
    expect(faltaPlano.status).toBe('FALTA');
    expect(faltaPlano.ligadaAoPlano).toBe(true);
    expect(await aulasDe(orm, ana.id)).toHaveLength(quantidade);

    const avulsa = await s.aulas.criar({
      alunoId: ana.id,
      responsavelId: marina.id,
      inicio: '2026-10-23T11:00:00-03:00',
      experimental: false,
    }, AGORA);
    await s.aulas.atualizar(avulsa.id, { status: 'FALTA' }, AGORA);
    expect(await aulasDe(orm, ana.id)).toHaveLength((await orm.em.fork().count(Aula, { aluno: ana.id })));
    const comReposicao = await s.aulas.atualizar(avulsa.id, {
      status: 'FALTA',
      reposicao: { responsavelId: marina.id, inicio: '2026-10-26T11:00:00-03:00' },
    }, AGORA);
    expect(comReposicao.status).toBe('FALTA');
    const todas = await aulasDe(orm, ana.id);
    const reposicoes = todas.filter((aula) => aula.reposicaoDe?.id === avulsa.id);
    expect(reposicoes).toHaveLength(1);
    expect(reposicoes[0].status).toBe('AGUARDANDO');
    expect(reposicoes[0].ligadaAoPlano).toBe(false);
    expect(reposicoes[0].experimental).toBe(false);
    await s.aulas.atualizar(avulsa.id, {
      status: 'FALTA',
      reposicao: { responsavelId: marina.id, inicio: '2026-10-28T11:00:00-03:00' },
    }, AGORA);
    expect((await aulasDe(orm, ana.id)).filter((aula) => aula.reposicaoDe?.id === avulsa.id)).toHaveLength(2);
    await expect(s.aulas.atualizar(avulsa.id, {
      status: 'CONFIRMADA',
      reposicao: { responsavelId: marina.id, inicio: '2026-10-30T11:00:00-03:00' },
    }, AGORA)).rejects.toMatchObject({ codigo: 'DADOS_INVALIDOS' });
  });

  it('evento e aula se excluem em qualquer tipo, sem cancelar o que já existe', async () => {
    const s = servicos(orm);
    const marina = await professor(s);
    const outro = await professor(s, 'paulo@personalytte.local');
    const ana = await s.alunos.criar({
      nome: 'Ana Lima',
      telefone: '11911110001',
      plano: 'PARTICULAR',
      categoria: 'D',
      horarios: [{ dia: 'qui', horarioInicio: '19:00' }],
      responsavelId: marina.id,
    }, AGORA);
    const bruno = await s.alunos.criar({ nome: 'Bruno', telefone: '11911110002', plano: 'GYMPASS', categoria: 'C' }, AGORA);
    const ocupada = await s.aulas.criar({
      alunoId: bruno.id,
      responsavelId: outro.id,
      inicio: '2026-10-22T15:30:00-03:00',
      experimental: false,
    }, AGORA);
    await expect(s.eventos.criar({
      tipo: 'AGENDA_FECHADA',
      nome: 'Fecha a tarde',
      inicio: '2026-10-22T14:00:00-03:00',
      fim: '2026-10-22T16:00:00-03:00',
      bloqueiaAulas: false,
      responsavelId: null,
    }, AGORA)).rejects.toMatchObject({ codigo: 'HORARIO_OCUPADO', status: 409 });
    expect((await aulasDe(orm)).find((aula) => aula.id === ocupada.id)?.status).toBe('AGUARDANDO');

    await expect(s.eventos.criar({
      tipo: 'FERIADO',
      nome: 'Quinta ocupada',
      inicio: '2026-10-22T00:00:00-03:00',
      fim: '2026-10-23T00:00:00-03:00',
      bloqueiaAulas: true,
      responsavelId: null,
    }, AGORA)).rejects.toMatchObject({ codigo: 'HORARIO_OCUPADO' });
    expect((await aulasDe(orm, ana.id)).find((aula) => iso(aula.inicio) === '2026-10-22T19:00:00-03:00')?.status).toBe('AGUARDANDO');

    const aniversario = await s.eventos.criar({
      tipo: 'ANIVERSARIO',
      nome: 'Aniversário',
      inicio: '2026-10-23T08:00:00-03:00',
      fim: '2026-10-23T10:00:00-03:00',
      contato: null,
      bloqueiaAulas: false,
      responsavelId: null,
    }, AGORA);
    await expect(s.aulas.criar({
      alunoId: bruno.id, responsavelId: marina.id, inicio: '2026-10-23T09:00:00-03:00', experimental: false,
    }, AGORA)).rejects.toMatchObject({ codigo: 'BLOQUEIO_AGENDA', status: 409 });
    await expect(s.aulas.criar({
      alunoId: bruno.id, responsavelId: outro.id, inicio: '2026-10-23T09:00:00-03:00', experimental: false,
    }, AGORA)).rejects.toMatchObject({ codigo: 'BLOQUEIO_AGENDA' });

    await s.eventos.criar({
      tipo: 'TORNEIO',
      nome: 'Torneio',
      inicio: '2026-10-24T08:00:00-03:00',
      fim: '2026-10-24T10:00:00-03:00',
      bloqueiaAulas: false,
      responsavelId: null,
    }, AGORA);
    await expect(s.aulas.criar({
      alunoId: bruno.id, responsavelId: outro.id, inicio: '2026-10-24T09:00:00-03:00', experimental: false,
    }, AGORA)).rejects.toMatchObject({ codigo: 'BLOQUEIO_AGENDA' });

    await s.eventos.criar({
      tipo: 'AGENDA_FECHADA',
      nome: 'Sem marcador antigo',
      inicio: '2026-10-25T08:00:00-03:00',
      fim: '2026-10-25T10:00:00-03:00',
      bloqueiaAulas: false,
      responsavelId: null,
    }, AGORA);
    await expect(s.aulas.criar({
      alunoId: bruno.id, responsavelId: marina.id, inicio: '2026-10-25T09:00:00-03:00', experimental: false,
    }, AGORA)).rejects.toMatchObject({ codigo: 'BLOQUEIO_AGENDA' });

    await s.eventos.criar({
      tipo: 'AUSENCIA',
      nome: 'Marina fora',
      inicio: '2026-10-26T08:00:00-03:00',
      fim: '2026-10-26T10:00:00-03:00',
      bloqueiaAulas: false,
      responsavelId: marina.id,
    }, AGORA);
    await expect(s.aulas.criar({
      alunoId: bruno.id, responsavelId: outro.id, inicio: '2026-10-26T09:00:00-03:00', experimental: false,
    }, AGORA)).rejects.toMatchObject({ codigo: 'BLOQUEIO_AGENDA' });

    const bloqueado = await s.alunos.criar({
      nome: 'Carla',
      telefone: '11911110003',
      plano: 'MENSAL',
      categoria: 'B',
      horarios: [{ dia: 'sex', horarioInicio: '09:00' }],
      responsavelId: marina.id,
    }, AGORA);
    expect((await aulasDe(orm, bloqueado.id)).some((aula) => iso(aula.inicio) === '2026-10-23T09:00:00-03:00')).toBe(false);
    expect((await aulasDe(orm, bloqueado.id)).some((aula) => iso(aula.inicio) === '2026-10-30T09:00:00-03:00')).toBe(true);

    await s.eventos.apagar(aniversario.id);
    const liberada = await s.aulas.criar({
      alunoId: bruno.id, responsavelId: outro.id, inicio: '2026-10-23T09:00:00-03:00', experimental: false,
    }, AGORA);
    expect(liberada.status).toBe('AGUARDANDO');
    await expect(s.eventos.criar({
      tipo: 'ANIVERSARIO',
      nome: 'De novo',
      inicio: '2026-10-23T09:30:00-03:00',
      fim: '2026-10-23T11:00:00-03:00',
      bloqueiaAulas: false,
      responsavelId: null,
    }, AGORA)).rejects.toMatchObject({ codigo: 'HORARIO_OCUPADO' });

    await s.eventos.criar({
      tipo: 'FERIADO',
      nome: 'Fora do horizonte atual',
      inicio: '2026-12-17T00:00:00-03:00',
      fim: '2026-12-18T00:00:00-03:00',
      bloqueiaAulas: false,
      responsavelId: null,
    }, AGORA);
    const novas = await new AgendaService().estenderHorizonte(orm.em.fork(), em('2026-10-23T15:00:00-03:00'));
    const apos = await aulasDe(orm, ana.id);
    expect(apos.some((aula) => iso(aula.inicio) === '2026-12-17T19:00:00-03:00')).toBe(false);
    expect(novas).toBe(0);
    expect(apos.some((aula) => iso(aula.inicio) === '2026-12-10T19:00:00-03:00' && aula.status === 'AGUARDANDO')).toBe(true);
  });

  it('aula experimental cria aluno temporário e recusa data anterior a hoje', async () => {
    const s = servicos(orm);
    const marina = await professor(s);
    const criada = await s.aulas.criar({
      experimental: true,
      alunoTemporario: { nome: 'Visitante', telefone: '(11) 99999-8888' },
      responsavelId: marina.id,
      inicio: '2026-10-23T10:00:00-03:00',
    }, AGORA);
    expect(criada.experimental).toBe(true);
    expect(criada.aluno).toMatchObject({ nome: 'Visitante', categoria: null, telefone: '11999998888', temporario: true });
    const gravado = await orm.em.fork().findOneOrFail(Aluno, { nome: 'Visitante' });
    expect(gravado.temporario).toBe(true);
    expect(gravado.telefone).toBe('11999998888');
    const comTelefone = await s.aulas.atualizar(criada.id, { telefone: '11888887777' }, AGORA);
    expect(comTelefone.aluno.telefone).toBe('11888887777');
    expect(gravado.plano).toBeNull();
    expect((await s.alunos.listar()).some((aluno) => aluno.nome === 'Visitante')).toBe(false);
    await expect(s.aulas.criar({
      experimental: false,
      alunoId: gravado.id,
      responsavelId: marina.id,
      inicio: '2026-10-23T11:00:00-03:00',
    }, AGORA)).rejects.toMatchObject({ codigo: 'DADOS_INVALIDOS' });
    await expect(s.aulas.criar({
      experimental: false,
      responsavelId: marina.id,
      inicio: '2026-10-23T12:00:00-03:00',
    }, AGORA)).rejects.toMatchObject({ codigo: 'DADOS_INVALIDOS' });
    const efetivo = await s.alunos.criar({ nome: 'Ana', telefone: '11911110001', plano: 'PARTICULAR', categoria: 'D' }, AGORA);
    await expect(s.aulas.criar({
      alunoId: efetivo.id,
      responsavelId: marina.id,
      inicio: '2020-01-02T10:00:00-03:00',
      experimental: false,
    }, AGORA)).rejects.toMatchObject({ codigo: 'DADOS_INVALIDOS' });
    await expect(s.eventos.criar({
      tipo: 'FERIADO',
      nome: 'Passado',
      inicio: '2020-01-02T10:00:00-03:00',
      fim: '2020-01-02T12:00:00-03:00',
      responsavelId: null,
    }, AGORA)).rejects.toMatchObject({ codigo: 'DADOS_INVALIDOS' });
  });

  it('depois do início muda o status e recusa mudar o horário', async () => {
    const s = servicos(orm);
    const marina = await professor(s);
    const ana = await s.alunos.criar({ nome: 'Ana', telefone: '11911110001', plano: 'PARTICULAR', categoria: 'A' }, AGORA);
    const depoisDoInicio = new Date('2026-10-22T15:00:00-03:00');
    const aula = await s.aulas.criar({
      alunoId: ana.id,
      responsavelId: marina.id,
      inicio: '2026-10-22T10:00:00-03:00',
      experimental: false,
    }, AGORA);
    const atualizada = await s.aulas.atualizar(aula.id, { status: 'CONFIRMADA' }, depoisDoInicio);
    expect(atualizada.status).toBe('CONFIRMADA');
    expect(atualizada.inicio).toBe('2026-10-22T10:00:00-03:00');
    await expect(s.aulas.atualizar(aula.id, { inicio: '2026-10-22T09:00:00-03:00' }, depoisDoInicio)).rejects.toMatchObject({
      codigo: 'AULA_JA_INICIOU',
      status: 409,
    });
    expect(iso((await aulasDe(orm, ana.id))[0].inicio)).toBe('2026-10-22T10:00:00-03:00');
    const mesmoInstante = await s.aulas.atualizar(aula.id, { inicio: '2026-10-22T13:00:00Z', status: 'FALTA' }, depoisDoInicio);
    expect(mesmoInstante.status).toBe('FALTA');
    expect(mesmoInstante.inicio).toBe('2026-10-22T10:00:00-03:00');
  });

  it('inativa aluno preservando histórico e recusa inativar integrante com agenda ou o último administrador', async () => {
    const s = servicos(orm);
    const marina = await professor(s);
    const primeiro = await socio(s);
    const ana = await s.alunos.criar({
      nome: 'Ana Lima',
      telefone: '11911110001',
      plano: 'PARTICULAR',
      categoria: 'D',
      horarios: [{ dia: 'qui', horarioInicio: '19:00' }],
      responsavelId: marina.id,
    }, AGORA);
    const lista = await aulasDe(orm, ana.id);
    const confirmada = lista[1];
    const falta = lista[2];
    const cancelada = lista[3];
    await s.aulas.atualizar(confirmada.id, { status: 'CONFIRMADA' }, AGORA);
    await s.aulas.atualizar(falta.id, { status: 'FALTA' }, AGORA);
    await expect(s.aulas.atualizar(cancelada.id, { status: 'CANCELADA' }, AGORA))
      .rejects.toMatchObject({ codigo: 'DADOS_INVALIDOS' });
    await s.aulas.cancelar(cancelada.id, { justificativa: 'Chuva', geraReposicao: false }, AGORA);
    const meioDoDia = new Date('2026-10-22T15:00:00-03:00');
    await s.aulas.criar({
      alunoId: ana.id,
      responsavelId: marina.id,
      inicio: '2026-10-22T10:00:00-03:00',
      experimental: false,
    }, AGORA);
    await s.alunos.inativar(ana.id, meioDoDia);
    const historico = await aulasDe(orm, ana.id);
    expect(historico.some((aula) => aula.status === 'AGUARDANDO' && aula.inicio.getTime() > meioDoDia.getTime())).toBe(false);
    expect(historico.some((aula) => aula.id === confirmada.id && aula.status === 'CONFIRMADA')).toBe(true);
    expect(historico.some((aula) => aula.id === falta.id && aula.status === 'FALTA')).toBe(true);
    expect(historico.some((aula) => aula.id === cancelada.id && aula.status === 'CANCELADA')).toBe(true);
    expect(historico.some((aula) => iso(aula.inicio) === '2026-10-22T10:00:00-03:00' && aula.status === 'AGUARDANDO')).toBe(true);
    expect(await orm.em.fork().findOne(Aluno, { id: ana.id })).toMatchObject({ ativo: false });
    await expect(s.alunos.listar()).resolves.not.toEqual(expect.arrayContaining([expect.objectContaining({ id: ana.id })]));

    const paulo = await professor(s, 'paulo@personalytte.local');
    const comPlano = await s.alunos.criar({
      nome: 'Elena',
      telefone: '11911110005',
      plano: 'MENSAL',
      categoria: 'B',
      horarios: [{ dia: 'sex', horarioInicio: '07:00' }],
      responsavelId: paulo.id,
    }, AGORA);
    await expect(s.integrantes.inativar(paulo.id, AGORA)).rejects.toMatchObject({ codigo: 'INTEGRANTE_COM_AGENDA', status: 409 });
    await s.alunos.atualizar(comPlano.id, { horarios: [], responsavelId: null }, AGORA);
    const futura = await s.aulas.criar({
      alunoId: comPlano.id,
      responsavelId: paulo.id,
      inicio: '2026-10-23T15:00:00-03:00',
      experimental: false,
    }, AGORA);
    await expect(s.integrantes.inativar(paulo.id, AGORA)).rejects.toMatchObject({ codigo: 'INTEGRANTE_COM_AGENDA' });
    await s.aulas.cancelar(futura.id, { justificativa: 'Professor saiu', geraReposicao: false }, AGORA);
    const tokenMarina = s.sessao.emitir(await orm.em.fork().findOneOrFail(Integrante, paulo.id), AGORA);
    const inativa = await s.integrantes.inativar(paulo.id, AGORA);
    expect(inativa.ativo).toBe(false);
    expect(await new SessaoService(orm.em.fork()).autenticar(tokenMarina, AGORA)).toBeNull();

    await expect(s.integrantes.inativar(primeiro.id, AGORA)).rejects.toMatchObject({ codigo: 'ULTIMO_ADMINISTRADOR', status: 409 });
    await expect(s.integrantes.atualizar(primeiro.id, { funcao: 'PROFESSOR' })).rejects.toMatchObject({ codigo: 'ULTIMO_ADMINISTRADOR' });
    expect((await orm.em.fork().findOneOrFail(Integrante, primeiro.id)).ativo).toBe(true);
    expect((await orm.em.fork().findOneOrFail(Integrante, primeiro.id)).funcao).toBe('SOCIO');
    const segundo = await socio(s, 'segundo@personalytte.local');
    const versaoAntes = (await orm.em.fork().findOneOrFail(Integrante, primeiro.id)).versaoSessao;
    const token = s.sessao.emitir(await orm.em.fork().findOneOrFail(Integrante, primeiro.id), AGORA);
    await s.integrantes.atualizar(primeiro.id, { senha: 'senha-novinha' });
    const depoisDaSenha = await orm.em.fork().findOneOrFail(Integrante, primeiro.id);
    expect(depoisDaSenha.versaoSessao).toBe(versaoAntes + 1);
    expect(await new SessaoService(orm.em.fork()).autenticar(token, AGORA)).toBeNull();
    expect((await new SessaoService(orm.em.fork()).autenticar(
      new SessaoService(orm.em.fork()).emitir(depoisDaSenha, AGORA),
      AGORA,
    ))?.id).toBe(primeiro.id);
    await s.integrantes.inativar(primeiro.id, AGORA);
    await expect(s.integrantes.inativar(segundo.id, AGORA)).rejects.toMatchObject({ codigo: 'ULTIMO_ADMINISTRADOR' });

    const cabecalhos: string[] = [];
    definirSessao({ append: (_nome: string, valor: string) => cabecalhos.push(valor) } as never, token);
    expect(cabecalhos[0]).toContain('HttpOnly');
    expect(cabecalhos[0]).toContain('SameSite=Lax');
    expect(cabecalhos[0]).toContain('Max-Age=604800');
    expect(cabecalhos[0]).not.toContain('Secure');
    process.env.NODE_ENV = 'production';
    definirSessao({ append: (_nome: string, valor: string) => cabecalhos.push(valor) } as never, token);
    process.env.NODE_ENV = 'test';
    expect(cabecalhos[1]).toContain('Secure');
    const expirado = new SessaoService(orm.em.fork()).emitir(depoisDaSenha, AGORA);
    expect(await new SessaoService(orm.em.fork()).autenticar(expirado, new Date(AGORA.getTime() + 8 * 24 * 60 * 60 * 1000))).toBeNull();
  });
});
