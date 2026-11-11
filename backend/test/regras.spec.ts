import { MikroORM, type EntityManager } from '@mikro-orm/postgresql';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { definirSessao } from '../src/comum/cookie';
import { MENSAGEM_GRUPO_CHEIO, MENSAGEM_OCUPADO, mensagemGrupoCheio } from '../src/comum/erros';
import { formatarInstante } from '../src/comum/tempo';
import { AgendaService } from '../src/dominio/agenda.service';
import { tituloAvisoAniversariantes } from '../src/dominio/aniversariantes';
import { Aluno } from '../src/entidades/aluno.entity';
import { Aula } from '../src/entidades/aula.entity';
import { Integrante } from '../src/entidades/integrante.entity';
import { AlunosService } from '../src/modulos/alunos/alunos.service';
import { AulasService } from '../src/modulos/aulas/aulas.service';
import { AvisosService } from '../src/modulos/avisos/avisos.service';
import { DashboardService } from '../src/modulos/dashboard/dashboard.service';
import { EventosService } from '../src/modulos/eventos/eventos.service';
import { GruposService } from '../src/modulos/grupos/grupos.service';
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
  grupos: GruposService;
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
    grupos: new GruposService(contexto, agenda),
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
    populate: ['aluno', 'grupo', 'grupo.responsavel', 'reposicaoDe'],
    orderBy: { grupo: { inicio: 'asc' }, id: 'asc' },
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
      genero: 'FEMININO', plano: 'GYMPASS',
      categoria: 'C',
    }, AGORA);
    expect(semPlano.telefone).toBe('11911110002');
    expect(semPlano.instagram).toBe('Bruno.Souza');
    expect(semPlano.horarios).toEqual([]);
    expect(await aulasDe(orm, semPlano.id)).toHaveLength(0);
    await expect(s.alunos.criar({
      nome: 'Incompleto',
      telefone: '11911110009',
      genero: 'FEMININO', plano: 'MENSAL',
      categoria: 'B',
      horarios: [{ dia: 'seg', horarioInicio: '19:00' }],
    }, AGORA)).rejects.toMatchObject({ codigo: 'PLANO_INCOMPLETO' });
    await expect(s.alunos.criar({
      nome: 'Madrugada',
      telefone: '11911110008',
      genero: 'FEMININO', plano: 'PARTICULAR',
      categoria: 'A',
      horarios: [{ dia: 'seg', horarioInicio: '23:30', responsavelId: responsavel.id }],
    }, AGORA)).rejects.toMatchObject({ codigo: 'DADOS_INVALIDOS' });
    const caio = await s.alunos.criar({
      nome: 'Caio',
      telefone: '11911110007',
      genero: 'FEMININO', plano: 'PARTICULAR',
      categoria: 'C',
      horarios: [
        { dia: 'seg', horarioInicio: '19:00', responsavelId: responsavel.id },
        { dia: 'qui', horarioInicio: '09:00', responsavelId: responsavel.id },
      ],
    }, AGORA);
    const horasCaio = (await aulasDe(orm, caio.id)).map((aula) => iso(aula.inicio));
    expect(horasCaio).toContain('2026-10-22T09:00:00-03:00');
    expect(horasCaio).toContain('2026-10-26T19:00:00-03:00');
    await expect(s.alunos.criar({
      nome: 'Repetido',
      telefone: '11911110006',
      genero: 'FEMININO', plano: 'PARTICULAR',
      categoria: 'D',
      horarios: [
        { dia: 'ter', horarioInicio: '19:00', responsavelId: responsavel.id },
        { dia: 'ter', horarioInicio: '19:30', responsavelId: responsavel.id },
      ],
    }, AGORA)).rejects.toMatchObject({ codigo: 'DADOS_INVALIDOS' });

    const ana = await s.alunos.criar({
      nome: 'Ana Lima',
      telefone: '11911110001',
      email: 'ana@email.com',
      genero: 'FEMININO', plano: 'PARTICULAR',
      categoria: 'D',
      horarios: [{ dia: 'qui', horarioInicio: '19:00', responsavelId: responsavel.id }],
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

    const outroProfessor = await professor(s, 'outro-plano@personalytte.local');
    const dois = await s.alunos.criar({
      nome: 'Dois Professores',
      telefone: '11911110004',
      genero: 'MASCULINO',
      plano: 'PARTICULAR',
      categoria: 'B',
      horarios: [
        { dia: 'seg', horarioInicio: '10:00', responsavelId: responsavel.id },
        { dia: 'qua', horarioInicio: '10:00', responsavelId: outroProfessor.id },
      ],
    }, AGORA);
    const aulasDois = await aulasDe(orm, dois.id);
    expect(aulasDois.find((aula) => iso(aula.inicio) === '2026-10-26T10:00:00-03:00')?.responsavel.id).toBe(responsavel.id);
    expect(aulasDois.find((aula) => iso(aula.inicio) === '2026-10-28T10:00:00-03:00')?.responsavel.id).toBe(outroProfessor.id);
  });

  it('aceita a categoria Iniciante abaixo de D', async () => {
    const s = servicos(orm);
    const aluno = await s.alunos.criar({
      nome: 'João Iniciante',
      telefone: '11911110099',
      genero: 'FEMININO', plano: 'PARTICULAR',
      categoria: 'INICIANTE',
    }, AGORA);
    expect(aluno.categoria).toBe('INICIANTE');
    expect(aluno.genero).toBe('FEMININO');
    await expect(s.alunos.criar({
      nome: 'Categoria inválida',
      telefone: '11911110098',
      genero: 'FEMININO', plano: 'PARTICULAR',
      categoria: 'E',
    }, AGORA)).rejects.toMatchObject({ codigo: 'DADOS_INVALIDOS' });
    await expect(s.alunos.criar({
      nome: 'Sem gênero',
      telefone: '11911110097',
      plano: 'PARTICULAR',
      categoria: 'D',
    }, AGORA)).rejects.toMatchObject({ codigo: 'DADOS_INVALIDOS' });
    await expect(s.alunos.criar({
      nome: 'Gênero inválido',
      telefone: '11911110096',
      plano: 'PARTICULAR',
      categoria: 'D',
      genero: 'OUTRO',
    }, AGORA)).rejects.toMatchObject({ codigo: 'DADOS_INVALIDOS' });
    const atualizado = await s.alunos.atualizar(aluno.id, { genero: 'MASCULINO' }, AGORA);
    expect(atualizado.genero).toBe('MASCULINO');
  });

  it('mostra no painel os alunos do próximo horário em grupo', async () => {
    const s = servicos(orm);
    const marina = await professor(s);
    const ana = await s.alunos.criar({ nome: 'Ana', telefone: '11911110001', genero: 'FEMININO', plano: 'PARTICULAR', categoria: 'D' }, AGORA);
    const bruno = await s.alunos.criar({ nome: 'Bruno', telefone: '11911110002', genero: 'FEMININO', plano: 'GYMPASS', categoria: 'C' }, AGORA);
    const carla = await s.alunos.criar({ nome: 'Carla', telefone: '11911110003', genero: 'FEMININO', plano: 'MENSAL', categoria: 'B' }, AGORA);
    await s.grupos.criar({
      alunoIds: [ana.id, bruno.id],
      responsavelId: marina.id,
      inicio: '2026-10-21T18:00:00-03:00',
      experimental: false,
    }, AGORA);
    await s.aulas.criar({
      alunoId: carla.id,
      responsavelId: marina.id,
      inicio: '2026-10-21T19:00:00-03:00',
      experimental: false,
    }, AGORA);
    const painel = await new DashboardService(s.em).obter(AGORA);
    expect(painel.proximoHorario.map((aula) => aula.aluno.nome)).toEqual(['Ana', 'Bruno']);
    expect(painel.proximoHorario.every((aula) => aula.inicio === '2026-10-21T18:00:00-03:00')).toBe(true);
  });

  it('recusa cruzamento do mesmo responsável ou aluno e ignora aula cancelada', async () => {
    const s = servicos(orm);
    const marina = await professor(s);
    const outro = await professor(s, 'outro@personalytte.local');
    const ana = await s.alunos.criar({ nome: 'Ana', telefone: '11911110001', genero: 'FEMININO', plano: 'PARTICULAR', categoria: 'D' }, AGORA);
    const bruno = await s.alunos.criar({ nome: 'Bruno', telefone: '11911110002', genero: 'FEMININO', plano: 'GYMPASS', categoria: 'C' }, AGORA);
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
    await expect(s.aulas.criar({
      alunoId: ana.id, responsavelId: outro.id, inicio: '2026-10-22T19:00:00-03:00', experimental: false,
    }, AGORA)).rejects.toMatchObject({ codigo: 'HORARIO_OCUPADO' });
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
      alunos.push(await s.alunos.criar({ nome: `Aluno ${i}`, telefone: `1191111000${i}`, genero: 'FEMININO', plano: 'PARTICULAR', categoria: 'D' }, AGORA));
    }
    const inicio = '2026-10-22T19:00:00-03:00';
    const grupo = await s.grupos.criar({
      alunoIds: alunos.slice(0, 3).map((aluno) => aluno.id), responsavelId: marina.id, inicio, experimental: false,
    }, AGORA);
    expect(grupo.aulas).toHaveLength(3);
    await s.aulas.criar({ alunoId: alunos[3].id, responsavelId: marina.id, inicio, experimental: false }, AGORA);
    await expect(s.aulas.criar({ alunoId: alunos[4].id, responsavelId: marina.id, inicio, experimental: false }, AGORA))
      .rejects.toMatchObject({ codigo: 'HORARIO_OCUPADO', mensagem: MENSAGEM_GRUPO_CHEIO });
    await expect(s.aulas.criar({
      alunoId: alunos[4].id, responsavelId: marina.id, inicio: '2026-10-22T19:30:00-03:00', experimental: false,
    }, AGORA)).rejects.toMatchObject({ codigo: 'HORARIO_OCUPADO', mensagem: MENSAGEM_OCUPADO });
    await expect(s.grupos.criar({
      alunoIds: [alunos[4].id, alunos[4].id], responsavelId: marina.id, inicio: '2026-10-23T19:00:00-03:00', experimental: false,
    }, AGORA)).rejects.toMatchObject({ codigo: 'DADOS_INVALIDOS' });
    await expect(s.grupos.criar({
      alunoIds: alunos.slice(0, 5).map((aluno) => aluno.id), responsavelId: marina.id, inicio: '2026-10-23T19:00:00-03:00', experimental: false,
    }, AGORA)).rejects.toMatchObject({ codigo: 'DADOS_INVALIDOS' });
    await expect(s.grupos.criar({
      alunoIds: [alunos[4].id, alunos[0].id], responsavelId: marina.id, inicio: '2026-10-22T19:00:00-03:00', experimental: false,
    }, AGORA)).rejects.toMatchObject({ codigo: 'HORARIO_OCUPADO' });
    expect(await aulasDe(orm, alunos[4].id)).toHaveLength(0);

    await s.aulas.cancelar(grupo.aulas[0].id, { justificativa: 'Aluno doente', geraReposicao: false }, AGORA);
    await s.aulas.criar({ alunoId: alunos[4].id, responsavelId: marina.id, inicio, experimental: false }, AGORA);
    const banco = orm.em.fork().getConnection();
    await expect(banco.execute(
      `with novo as (
         insert into grupos (id, responsavel_id, inicio, fim, capacidade)
         values (gen_random_uuid(), '${marina.id}', '2026-10-22T19:30:00-03:00', '2026-10-22T20:30:00-03:00', 4)
         returning id
       )
       insert into aulas (id, grupo_id, aluno_id, status, experimental, ligada_ao_plano)
       select gen_random_uuid(), novo.id, '${alunos[5].id}', 'AGUARDANDO', false, false from novo`,
    )).rejects.toBeDefined();
  });

  it('amplia o grupo para 6 alunos e recusa menos de 1 hora', async () => {
    const s = servicos(orm);
    const marina = await professor(s);
    const outro = await professor(s, 'outro-capacidade@personalytte.local');
    const alunos = [];
    for (let i = 1; i <= 7; i += 1) {
      alunos.push(await s.alunos.criar({ nome: `Sete ${i}`, telefone: `1192222000${i}`, genero: 'FEMININO', plano: 'PARTICULAR', categoria: 'D' }, AGORA));
    }
    const inicio = '2026-10-22T07:00:00-03:00';
    await expect(s.grupos.criar({
      alunoIds: alunos.slice(0, 5).map((aluno) => aluno.id), responsavelId: marina.id, inicio, experimental: false,
    }, AGORA)).rejects.toMatchObject({ codigo: 'DADOS_INVALIDOS' });
    const grupo = await s.grupos.criar({
      alunoIds: alunos.slice(0, 4).map((aluno) => aluno.id),
      responsavelId: marina.id,
      inicio,
      capacidade: 4,
      experimental: false,
    }, AGORA);
    expect(grupo.capacidade).toBe(4);
    expect(grupo.fim).toBe('2026-10-22T08:00:00-03:00');
    const ampliado = await s.grupos.atualizar(grupo.id, { capacidade: 6, fim: '2026-10-22T08:30:00-03:00' }, AGORA);
    expect(ampliado.capacidade).toBe(6);
    expect(ampliado.fim).toBe('2026-10-22T08:30:00-03:00');
    expect(ampliado.aulas.every((aula) => aula.ligadaAoPlano === false)).toBe(true);
    const quinto = await s.aulas.criar({ alunoId: alunos[4].id, responsavelId: marina.id, inicio, experimental: false }, AGORA);
    const sexto = await s.aulas.criar({ alunoId: alunos[5].id, responsavelId: marina.id, inicio, experimental: false }, AGORA);
    expect(quinto.grupo.capacidade).toBe(6);
    expect(sexto.grupo.id).toBe(grupo.id);
    await expect(s.aulas.criar({
      alunoId: alunos[6].id, responsavelId: marina.id, inicio, experimental: false,
    }, AGORA)).rejects.toMatchObject({ codigo: 'HORARIO_OCUPADO', mensagem: mensagemGrupoCheio(6) });
    await expect(s.grupos.criar({
      alunoIds: alunos.map((aluno) => aluno.id),
      responsavelId: marina.id,
      inicio: '2026-10-23T09:00:00-03:00',
      capacidade: 6,
      experimental: false,
    }, AGORA)).rejects.toMatchObject({ codigo: 'DADOS_INVALIDOS' });
    await expect(s.grupos.atualizar(grupo.id, { fim: '2026-10-22T07:30:00-03:00' }, AGORA))
      .rejects.toMatchObject({ codigo: 'DADOS_INVALIDOS' });
    await expect(s.grupos.atualizar(grupo.id, { capacidade: 5 }, AGORA))
      .rejects.toMatchObject({ codigo: 'DADOS_INVALIDOS' });
    await expect(s.aulas.criar({
      alunoId: alunos[6].id, responsavelId: marina.id, inicio: '2026-10-22T07:30:00-03:00', experimental: false,
    }, AGORA)).rejects.toMatchObject({ codigo: 'HORARIO_OCUPADO', mensagem: MENSAGEM_OCUPADO });

    const depois = new Date('2026-10-22T07:10:00-03:00');
    const trocado = await s.grupos.atualizar(grupo.id, { responsavelId: outro.id }, depois);
    expect(trocado.responsavel.id).toBe(outro.id);
    await expect(s.grupos.atualizar(grupo.id, { inicio: '2026-10-22T09:00:00-03:00' }, depois))
      .rejects.toMatchObject({ codigo: 'AULA_JA_INICIOU' });

    await s.aulas.cancelar(grupo.aulas[0].id, { justificativa: 'Aluno doente', geraReposicao: false }, AGORA);
    const entrou = await s.aulas.criar({
      alunoId: alunos[6].id, responsavelId: outro.id, inicio, experimental: false,
    }, AGORA);
    expect(entrou.status).toBe('AGUARDANDO');
    expect(entrou.grupo.id).toBe(grupo.id);
  });

  it('falta libera a vaga do grupo e mantém o aluno ocupado', async () => {
    const s = servicos(orm);
    const marina = await professor(s);
    const outro = await professor(s, 'outro-falta@personalytte.local');
    const alunos = [];
    for (let i = 1; i <= 6; i += 1) {
      alunos.push(await s.alunos.criar({
        nome: `Vaga ${i}`, telefone: `1193333000${i}`, genero: 'FEMININO', plano: 'PARTICULAR', categoria: 'D',
      }, AGORA));
    }
    const inicio = '2026-10-22T19:00:00-03:00';
    const grupo = await s.grupos.criar({
      alunoIds: alunos.slice(0, 4).map((aluno) => aluno.id), responsavelId: marina.id, inicio, experimental: false,
    }, AGORA);
    await expect(s.aulas.criar({
      alunoId: alunos[4].id, responsavelId: marina.id, inicio, experimental: true,
    }, AGORA)).rejects.toMatchObject({ codigo: 'HORARIO_OCUPADO', mensagem: MENSAGEM_GRUPO_CHEIO });

    await s.aulas.atualizar(grupo.aulas[0].id, { status: 'FALTA' }, AGORA);
    const experimental = await s.aulas.criar({
      alunoId: alunos[4].id, responsavelId: marina.id, inicio, experimental: true,
    }, AGORA);
    expect(experimental.experimental).toBe(true);
    await expect(s.aulas.criar({
      alunoId: alunos[5].id, responsavelId: marina.id, inicio, experimental: false,
    }, AGORA)).rejects.toMatchObject({ codigo: 'HORARIO_OCUPADO', mensagem: MENSAGEM_GRUPO_CHEIO });
    await expect(s.aulas.criar({
      alunoId: alunos[5].id, responsavelId: marina.id, inicio: '2026-10-22T19:30:00-03:00', experimental: false,
    }, AGORA)).rejects.toMatchObject({ codigo: 'HORARIO_OCUPADO', mensagem: MENSAGEM_OCUPADO });
    await expect(s.aulas.criar({
      alunoId: alunos[0].id, responsavelId: outro.id, inicio, experimental: false,
    }, AGORA)).rejects.toMatchObject({ codigo: 'HORARIO_OCUPADO', mensagem: MENSAGEM_OCUPADO });
    await expect(s.aulas.atualizar(grupo.aulas[0].id, { status: 'CONFIRMADA' }, AGORA))
      .rejects.toMatchObject({ codigo: 'HORARIO_OCUPADO', mensagem: MENSAGEM_GRUPO_CHEIO });
    s.em.clear();

    await s.aulas.cancelar(grupo.aulas[1].id, { justificativa: 'Aluno viajou', geraReposicao: false }, AGORA);
    const noLugar = await s.aulas.criar({
      alunoId: alunos[5].id, responsavelId: marina.id, inicio, experimental: false,
    }, AGORA);
    expect(noLugar.status).toBe('AGUARDANDO');
    await expect(s.aulas.criar({
      alunoId: alunos[1].id, responsavelId: outro.id, inicio, experimental: false,
    }, AGORA)).rejects.toMatchObject({ codigo: 'HORARIO_OCUPADO', mensagem: MENSAGEM_OCUPADO });
    await expect(s.aulas.atualizar(grupo.aulas[1].id, { status: 'CONFIRMADA' }, AGORA))
      .rejects.toMatchObject({ codigo: 'HORARIO_OCUPADO', mensagem: MENSAGEM_GRUPO_CHEIO });
  });

  it('cancela com justificativa e diz se gera reposição', async () => {
    const s = servicos(orm);
    const marina = await professor(s);
    const ana = await s.alunos.criar({ nome: 'Ana', telefone: '11911110001', genero: 'FEMININO', plano: 'PARTICULAR', categoria: 'D' }, AGORA);
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
      reposicao: { responsavelId: marina.id, inicio: '2026-10-24T09:00:00-03:00' },
    }, AGORA);
    expect(cancelada.status).toBe('CANCELADA');
    expect(cancelada.cancelamento).toEqual({ justificativa: 'Chuva forte', geraReposicao: true });
    const reposicoes = (await aulasDe(orm, ana.id)).filter((item) => item.reposicaoDe?.id === aula.id);
    expect(reposicoes.map((item) => iso(item.inicio))).toEqual(['2026-10-24T09:00:00-03:00']);
    expect(cancelada.reposicaoAgendadaId).toBe(reposicoes[0].id);
    expect((await s.alunos.obter(ana.id)).reposicoesDisponiveis).toBe(0);
    await expect(s.aulas.cancelar(aula.id, { justificativa: 'De novo', geraReposicao: false }, AGORA))
      .rejects.toMatchObject({ codigo: 'DADOS_INVALIDOS' });
    await expect(s.aulas.atualizar(aula.id, { reposicao: { responsavelId: marina.id, inicio: '2026-10-24T09:00:00-03:00' } }, AGORA))
      .rejects.toMatchObject({ codigo: 'DADOS_INVALIDOS', mensagem: 'Esta aula já tem uma reposição agendada.' });
    expect((await aulasDe(orm, ana.id)).filter((item) => item.reposicaoDe?.id === aula.id)).toHaveLength(1);

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
      genero: 'FEMININO', plano: 'PARTICULAR',
      categoria: 'D',
      horarios: [
        { dia: 'ter', horarioInicio: '19:00', responsavelId: marina.id },
        { dia: 'qui', horarioInicio: '19:00', responsavelId: marina.id },
      ],
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
    const solta = await s.grupos.atualizar(outraQuinta!.grupo.id, { inicio: '2026-10-29T20:00:00-03:00' }, AGORA);
    expect(solta.aulas[0].ligadaAoPlano).toBe(false);
    expect(solta.inicio).toBe('2026-10-29T20:00:00-03:00');
    await s.alunos.atualizar(ana.id, { categoria: 'A' }, AGORA);
    expect((await aulasDe(orm, ana.id)).filter((aula) => aula.ligadaAoPlano && aula.status === 'AGUARDANDO').length).toBe(antes.length - 3);

    await s.alunos.atualizar(ana.id, {
      horarios: [
        { dia: 'qua', horarioInicio: '18:00', responsavelId: marina.id },
        { dia: 'sex', horarioInicio: '18:00', responsavelId: marina.id },
      ],
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
    const trocada = await s.grupos.atualizar(sexta!.grupo.id, { responsavelId: socioAtual.id }, AGORA);
    expect(trocada.aulas[0].ligadaAoPlano).toBe(false);
    await s.alunos.atualizar(ana.id, { horarios: [{ dia: 'qua', horarioInicio: '18:00', responsavelId: marina.id }] }, AGORA);
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
      genero: 'FEMININO', plano: 'MENSAL',
      categoria: 'B',
      horarios: [{ dia: 'qui', horarioInicio: '19:00', responsavelId: marina.id }],
    }, AGORA);
    const origemPlano = (await aulasDe(orm, ana.id))[0];
    const quantidade = (await aulasDe(orm, ana.id)).length;
    const faltaPlano = await s.aulas.atualizar(origemPlano.id, { status: 'FALTA' }, AGORA);
    expect(faltaPlano.status).toBe('FALTA');
    expect(faltaPlano.ligadaAoPlano).toBe(true);
    expect(faltaPlano.justificativaReposicao).toBeNull();
    expect(faltaPlano.reposicoesDisponiveis).toBe(0);
    expect(await aulasDe(orm, ana.id)).toHaveLength(quantidade);

    const avulsa = await s.aulas.criar({
      alunoId: ana.id,
      responsavelId: marina.id,
      inicio: '2026-10-23T11:00:00-03:00',
      experimental: false,
    }, AGORA);
    await s.aulas.atualizar(avulsa.id, { status: 'FALTA' }, AGORA);
    expect((await s.alunos.obter(ana.id)).reposicoesDisponiveis).toBe(0);
    await expect(s.aulas.atualizar(avulsa.id, {
      status: 'FALTA',
      reposicao: { responsavelId: marina.id, inicio: '2026-10-26T11:00:00-03:00' },
    }, AGORA)).rejects.toMatchObject({ codigo: 'DADOS_INVALIDOS', mensagem: 'Informe a justificativa da reposição.' });
    const concedida = await s.aulas.atualizar(avulsa.id, {
      status: 'FALTA',
      concederReposicao: { justificativa: '  Aluno avisou  ' },
    }, AGORA);
    expect(concedida.justificativaReposicao).toBe('Aluno avisou');
    expect(concedida.reposicoesDisponiveis).toBe(1);
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
    expect((await s.alunos.obter(ana.id)).reposicoesDisponiveis).toBe(0);
    await expect(s.aulas.atualizar(avulsa.id, {
      status: 'FALTA',
      reposicao: { responsavelId: marina.id, inicio: '2026-10-28T11:00:00-03:00' },
    }, AGORA)).rejects.toMatchObject({ codigo: 'DADOS_INVALIDOS', mensagem: 'Esta aula já tem uma reposição agendada.' });
    await s.aulas.cancelar(reposicoes[0].id, { justificativa: 'Remarcou', geraReposicao: false }, AGORA);
    expect((await s.alunos.obter(ana.id)).reposicoesDisponiveis).toBe(1);
    const remarcada = await s.aulas.atualizar(avulsa.id, {
      status: 'FALTA',
      reposicao: { responsavelId: marina.id, inicio: '2026-10-28T11:00:00-03:00' },
    }, AGORA);
    expect(remarcada.reposicaoAgendadaId).toBeTruthy();
    expect((await s.alunos.obter(ana.id)).reposicoesDisponiveis).toBe(0);
    await expect(s.aulas.atualizar(avulsa.id, {
      status: 'CONFIRMADA',
      reposicao: { responsavelId: marina.id, inicio: '2026-10-30T11:00:00-03:00' },
    }, AGORA)).rejects.toMatchObject({ codigo: 'DADOS_INVALIDOS' });
  });

  it('usa a reposição mais antiga no novo agendamento', async () => {
    const s = servicos(orm);
    const marina = await professor(s);
    const ana = await s.alunos.criar({
      nome: 'Ana Lima',
      telefone: '11911110001',
      genero: 'FEMININO', plano: 'PARTICULAR',
      categoria: 'D',
    }, AGORA);
    const antiga = await s.aulas.criar({
      alunoId: ana.id, responsavelId: marina.id, inicio: '2026-10-22T10:00:00-03:00', experimental: false,
    }, AGORA);
    const recente = await s.aulas.criar({
      alunoId: ana.id, responsavelId: marina.id, inicio: '2026-10-23T10:00:00-03:00', experimental: false,
    }, AGORA);
    await s.aulas.atualizar(antiga.id, { status: 'FALTA', concederReposicao: { justificativa: 'Avisou' } }, AGORA);
    await s.aulas.atualizar(recente.id, { status: 'FALTA', concederReposicao: { justificativa: 'Chuva' } }, AGORA);
    expect((await s.alunos.obter(ana.id)).reposicoesDisponiveis).toBe(2);

    const usada = await s.aulas.usarReposicao({
      alunoId: ana.id, responsavelId: marina.id, inicio: '2026-10-26T11:00:00-03:00',
    }, AGORA);
    expect(usada.reposicaoDeAulaId).toBe(antiga.id);
    expect(usada.status).toBe('AGUARDANDO');
    expect(usada.experimental).toBe(false);
    expect(usada.ligadaAoPlano).toBe(false);
    expect((await s.alunos.obter(ana.id)).reposicoesDisponiveis).toBe(1);
    expect((await s.aulas.obter(antiga.id)).reposicaoAgendadaId).toBe(usada.id);

    const segunda = await s.aulas.usarReposicao({
      alunoId: ana.id, responsavelId: marina.id, inicio: '2026-10-27T11:00:00-03:00',
    }, AGORA);
    expect(segunda.reposicaoDeAulaId).toBe(recente.id);
    expect((await s.alunos.obter(ana.id)).reposicoesDisponiveis).toBe(0);
    await expect(s.aulas.usarReposicao({
      alunoId: ana.id, responsavelId: marina.id, inicio: '2026-10-28T11:00:00-03:00',
    }, AGORA)).rejects.toMatchObject({ codigo: 'DADOS_INVALIDOS', mensagem: 'Este aluno não tem reposição disponível.' });
  });

  it('evento e aula se excluem em qualquer tipo, sem cancelar o que já existe', async () => {
    const s = servicos(orm);
    const marina = await professor(s);
    const outro = await professor(s, 'paulo@personalytte.local');
    const ana = await s.alunos.criar({
      nome: 'Ana Lima',
      telefone: '11911110001',
      genero: 'FEMININO', plano: 'PARTICULAR',
      categoria: 'D',
      horarios: [{ dia: 'qui', horarioInicio: '19:00', responsavelId: marina.id }],
    }, AGORA);
    const bruno = await s.alunos.criar({ nome: 'Bruno', telefone: '11911110002', genero: 'FEMININO', plano: 'GYMPASS', categoria: 'C' }, AGORA);
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
      genero: 'FEMININO', plano: 'MENSAL',
      categoria: 'B',
      horarios: [{ dia: 'sex', horarioInicio: '09:00', responsavelId: marina.id }],
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
    expect((await s.alunos.listar(undefined, true)).some((aluno) => aluno.nome === 'Visitante')).toBe(false);
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
    const efetivo = await s.alunos.criar({ nome: 'Ana', telefone: '11911110001', genero: 'FEMININO', plano: 'PARTICULAR', categoria: 'D' }, AGORA);
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
    const ana = await s.alunos.criar({ nome: 'Ana', telefone: '11911110001', genero: 'FEMININO', plano: 'PARTICULAR', categoria: 'A' }, AGORA);
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
    await expect(s.grupos.atualizar(aula.grupo.id, { inicio: '2026-10-22T09:00:00-03:00' }, depoisDoInicio)).rejects.toMatchObject({
      codigo: 'AULA_JA_INICIOU',
      status: 409,
    });
    expect(iso((await aulasDe(orm, ana.id))[0].inicio)).toBe('2026-10-22T10:00:00-03:00');
    const mesmoInstante = await s.grupos.atualizar(aula.grupo.id, { inicio: '2026-10-22T13:00:00Z' }, depoisDoInicio);
    expect(mesmoInstante.inicio).toBe('2026-10-22T10:00:00-03:00');
    const falta = await s.aulas.atualizar(aula.id, { status: 'FALTA' }, depoisDoInicio);
    expect(falta.status).toBe('FALTA');
    expect(falta.inicio).toBe('2026-10-22T10:00:00-03:00');
  });

  it('inativa aluno preservando histórico e recusa inativar integrante com agenda ou o último administrador', async () => {
    const s = servicos(orm);
    const marina = await professor(s);
    const primeiro = await socio(s);
    const ana = await s.alunos.criar({
      nome: 'Ana Lima',
      telefone: '11911110001',
      genero: 'FEMININO', plano: 'PARTICULAR',
      categoria: 'D',
      horarios: [{ dia: 'qui', horarioInicio: '19:00', responsavelId: marina.id }],
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
    expect(await s.alunos.listar(undefined, true)).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: ana.id, ativo: false, nome: 'Ana Lima' })]),
    );
    expect(await s.alunos.obter(ana.id)).toMatchObject({ id: ana.id, ativo: false });
    await expect(s.alunos.atualizar(ana.id, { nome: 'Ana Inativa' }, AGORA)).rejects.toMatchObject({ codigo: 'NAO_ENCONTRADO' });
    const antes = (await aulasDe(orm, ana.id)).map((aula) => aula.id).sort();
    const reativado = await s.alunos.reativar(ana.id);
    expect(reativado.ativo).toBe(true);
    expect((await aulasDe(orm, ana.id)).map((aula) => aula.id).sort()).toEqual(antes);
    expect(await new AgendaService().estenderHorizonte(orm.em.fork(), meioDoDia)).toBe(0);
    expect((await aulasDe(orm, ana.id)).map((aula) => aula.id).sort()).toEqual(antes);
    await expect(s.alunos.reativar(ana.id)).rejects.toMatchObject({ codigo: 'DADOS_INVALIDOS', mensagem: 'Aluno já está ativo.' });
    await s.alunos.atualizar(ana.id, {
      horarios: [{ dia: 'qui', horarioInicio: '18:00', responsavelId: marina.id }],
    }, meioDoDia);
    const depois = await aulasDe(orm, ana.id);
    expect(depois.some((aula) => iso(aula.inicio) === '2026-10-22T18:00:00-03:00' && aula.status === 'AGUARDANDO')).toBe(true);
    expect(depois.some((aula) => iso(aula.inicio) === '2026-10-22T19:00:00-03:00' && aula.status === 'AGUARDANDO')).toBe(false);

    const paulo = await professor(s, 'paulo@personalytte.local');
    const comPlano = await s.alunos.criar({
      nome: 'Elena',
      telefone: '11911110005',
      genero: 'FEMININO', plano: 'MENSAL',
      categoria: 'B',
      horarios: [{ dia: 'sex', horarioInicio: '07:00', responsavelId: paulo.id }],
    }, AGORA);
    await expect(s.integrantes.inativar(paulo.id, AGORA)).rejects.toMatchObject({ codigo: 'INTEGRANTE_COM_AGENDA', status: 409 });
    await s.alunos.atualizar(comPlano.id, { horarios: [] }, AGORA);
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

  it('cria o aviso dos aniversariantes da semana na leitura do painel, sem duplicar', async () => {
    const s = servicos(orm);
    const marina = await professor(s);
    await s.alunos.criar({
      nome: 'Ana Lima',
      telefone: '11911110001',
      genero: 'FEMININO', plano: 'PARTICULAR',
      categoria: 'D',
      dataNascimento: '1992-10-21',
    }, AGORA);
    await s.alunos.criar({
      nome: 'Bruno Souza',
      telefone: '11911110002',
      genero: 'FEMININO', plano: 'GYMPASS',
      categoria: 'C',
      dataNascimento: '2000-10-24',
    }, AGORA);
    await s.alunos.criar({
      nome: 'Carla Mendes',
      telefone: '11911110003',
      genero: 'FEMININO', plano: 'MENSAL',
      categoria: 'B',
      dataNascimento: '1990-11-01',
    }, AGORA);
    const inativo = await s.alunos.criar({
      nome: 'Diego Alves',
      telefone: '11911110004',
      genero: 'FEMININO', plano: 'PARTICULAR',
      categoria: 'A',
      dataNascimento: '1990-10-22',
    }, AGORA);
    await s.alunos.inativar(inativo.id, AGORA);
    const experimental = await s.aulas.criar({
      experimental: true,
      alunoTemporario: { nome: 'Visitante', telefone: '11999998888' },
      responsavelId: marina.id,
      inicio: '2026-10-23T10:00:00-03:00',
    }, AGORA);
    const visitante = await s.em.findOneOrFail(Aluno, { id: experimental.aluno.id });
    visitante.dataNascimento = '1992-10-21';
    await s.em.flush();

    const painel = await new DashboardService(s.em).obter(AGORA);
    const titulo = tituloAvisoAniversariantes(AGORA);
    const aniversario = painel.avisos.filter((aviso) => aviso.titulo === titulo);
    expect(aniversario).toHaveLength(1);
    expect(titulo).toBe('Aniversariantes da semana · 19 a 25 de outubro de 2026');
    expect(aniversario[0].mensagem).toContain('Ana Lima — quarta-feira, 21 de outubro');
    expect(aniversario[0].mensagem).toContain('Bruno Souza — sábado, 24 de outubro');
    expect(aniversario[0].mensagem).not.toContain('Carla Mendes');
    expect(aniversario[0].mensagem).not.toContain('Diego Alves');
    expect(aniversario[0].mensagem).not.toContain('Visitante');

    const outraLeitura = await new DashboardService(s.em).obter(AGORA);
    expect(outraLeitura.avisos.filter((aviso) => aviso.titulo === titulo)).toHaveLength(1);
    const pelaLista = await new AvisosService(s.em).listar(AGORA);
    expect(pelaLista.filter((aviso) => aviso.titulo === titulo)).toHaveLength(1);
  });

  it('cria aviso informando que não há aniversariantes na semana', async () => {
    const s = servicos(orm);
    await s.alunos.criar({
      nome: 'Carla Mendes',
      telefone: '11911110003',
      genero: 'FEMININO', plano: 'MENSAL',
      categoria: 'B',
      dataNascimento: '1990-11-01',
    }, AGORA);
    const painel = await new DashboardService(s.em).obter(AGORA);
    const titulo = tituloAvisoAniversariantes(AGORA);
    const aniversario = painel.avisos.filter((aviso) => aviso.titulo === titulo);
    expect(aniversario).toHaveLength(1);
    expect(aniversario[0].mensagem).toBe('Não há aniversariantes nesta semana.');

    const outraLeitura = await new DashboardService(s.em).obter(AGORA);
    expect(outraLeitura.avisos.filter((aviso) => aviso.titulo === titulo)).toHaveLength(1);
  });

  it('trata 29 de fevereiro como 28 em ano comum', async () => {
    const s = servicos(orm);
    const fevereiro = new Date('2026-02-25T12:00:00-03:00');
    await s.alunos.criar({
      nome: 'Elena Bissexto',
      telefone: '11911110005',
      genero: 'FEMININO', plano: 'PARTICULAR',
      categoria: 'D',
      dataNascimento: '2000-02-29',
    }, fevereiro);
    const avisos = await new AvisosService(s.em).listar(fevereiro);
    expect(avisos).toHaveLength(1);
    expect(avisos[0].titulo).toBe(tituloAvisoAniversariantes(fevereiro));
    expect(avisos[0].mensagem).toContain('Elena Bissexto — sábado, 28 de fevereiro');
  });

  it('adiciona e remove aluno do grupo fixo, sem depender do dia do mês', async () => {
    const s = servicos(orm);
    const marina = await professor(s, 'grupo-fixo@personalytte.local');
    const ana = await s.alunos.criar({
      nome: 'Ana Fixa',
      telefone: '11911118001',
      genero: 'FEMININO',
      plano: 'PARTICULAR',
      categoria: 'D',
      horarios: [{ dia: 'qua', horarioInicio: '19:00', responsavelId: marina.id }],
    }, AGORA);
    const bruno = await s.alunos.criar({
      nome: 'Bruno Fixo',
      telefone: '11911118002',
      genero: 'MASCULINO',
      plano: 'PARTICULAR',
      categoria: 'C',
    }, AGORA);

    const lista = await s.grupos.listarFixos(AGORA);
    const quarta = lista.find((grupo) => grupo.dia === 'qua' && grupo.horarioInicio === '19:00' && grupo.responsavel.id === marina.id);
    expect(quarta?.alunos.map((aluno) => aluno.nome)).toEqual(['Ana Fixa']);
    expect(lista.some((grupo) => grupo.dia === 'dom')).toBe(false);

    const comBruno = await s.grupos.adicionarFixo({
      dia: 'qua',
      horarioInicio: '19:00',
      responsavelId: marina.id,
      alunoId: bruno.id,
    }, AGORA);
    const atualizado = comBruno.find((grupo) => grupo.dia === 'qua' && grupo.horarioInicio === '19:00');
    expect(atualizado?.alunos.map((aluno) => aluno.nome)).toEqual(['Ana Fixa', 'Bruno Fixo']);
    const aulasBruno = await aulasDe(orm, bruno.id);
    expect(aulasBruno.some((aula) => iso(aula.inicio) === '2026-10-28T19:00:00-03:00' && aula.ligadaAoPlano)).toBe(true);

    const semAna = await s.grupos.removerFixo({
      dia: 'qua',
      horarioInicio: '19:00',
      responsavelId: marina.id,
      alunoId: ana.id,
    }, AGORA);
    expect(semAna.find((grupo) => grupo.responsavel.id === marina.id)?.alunos.map((aluno) => aluno.nome)).toEqual(['Bruno Fixo']);
    const aulasAna = await aulasDe(orm, ana.id);
    expect(aulasAna.filter((aula) => aula.status === 'AGUARDANDO' && aula.ligadaAoPlano)).toHaveLength(0);
  });

  it('troca o professor do grupo fixo e mantém a aula confirmada', async () => {
    const s = servicos(orm);
    const marina = await professor(s, 'troca-marina@personalytte.local');
    const paulo = await s.integrantes.criar({
      nome: 'Paulo Nunes',
      email: 'troca-paulo@personalytte.local',
      senha: 'professor1',
      funcao: 'PROFESSOR',
      telefone: '11988886666',
    });
    const ana = await s.alunos.criar({
      nome: 'Ana Troca',
      telefone: '11911118011',
      genero: 'FEMININO',
      plano: 'PARTICULAR',
      categoria: 'D',
      horarios: [{ dia: 'qua', horarioInicio: '19:00', responsavelId: marina.id }],
    }, AGORA);
    const bruno = await s.alunos.criar({
      nome: 'Bruno Troca',
      telefone: '11911118012',
      genero: 'MASCULINO',
      plano: 'PARTICULAR',
      categoria: 'C',
      horarios: [{ dia: 'qua', horarioInicio: '19:00', responsavelId: marina.id }],
    }, AGORA);
    const aulasAna = await aulasDe(orm, ana.id);
    const confirmada = aulasAna.find((aula) => aula.grupo.inicio > AGORA);
    expect(confirmada).toBeTruthy();
    await s.aulas.atualizar(confirmada!.id, { status: 'CONFIRMADA' }, AGORA);
    await s.grupos.atualizar(confirmada!.grupo.id, { capacidade: 6 }, AGORA);

    const lista = await s.grupos.trocarProfessorFixo({
      dia: 'qua',
      horarioInicio: '19:00',
      responsavelId: marina.id,
      novoResponsavelId: paulo.id,
    }, AGORA);
    const quarta = lista.find((grupo) => grupo.dia === 'qua' && grupo.horarioInicio === '19:00');
    expect(quarta?.responsavel.id).toBe(paulo.id);
    expect(quarta?.capacidade).toBe(6);
    expect(quarta?.alunos.map((aluno) => aluno.nome)).toEqual(['Ana Troca', 'Bruno Troca']);
    expect(lista.some((grupo) => grupo.responsavel.id === marina.id && grupo.horarioInicio === '19:00')).toBe(false);

    const aluno = await orm.em.fork().findOneOrFail(Aluno, ana.id);
    expect(aluno.horarios).toEqual([{ dia: 'qua', horarioInicio: '19:00', responsavelId: paulo.id }]);
    const depois = await aulasDe(orm, ana.id);
    const mantida = depois.find((aula) => aula.id === confirmada!.id);
    expect(mantida?.status).toBe('CONFIRMADA');
    expect(mantida?.grupo.responsavel.id).toBe(marina.id);
    const novas = depois.filter((aula) => aula.status === 'AGUARDANDO' && aula.ligadaAoPlano);
    expect(novas.length).toBeGreaterThan(0);
    expect(novas.every((aula) => aula.grupo.responsavel.id === paulo.id && aula.grupo.capacidade === 6)).toBe(true);

    const ocupado = await s.alunos.criar({
      nome: 'Carla Ocupada',
      telefone: '11911118013',
      genero: 'FEMININO',
      plano: 'PARTICULAR',
      categoria: 'B',
    }, AGORA);
    await s.grupos.criar({
      alunoIds: [ocupado.id],
      responsavelId: marina.id,
      inicio: '2026-11-04T19:30:00-03:00',
    }, AGORA);
    await expect(s.grupos.trocarProfessorFixo({
      dia: 'qua',
      horarioInicio: '19:00',
      responsavelId: paulo.id,
      novoResponsavelId: marina.id,
    }, AGORA)).rejects.toMatchObject({ codigo: 'HORARIO_OCUPADO' });
    const segue = await orm.em.fork().findOneOrFail(Aluno, ana.id);
    expect(segue.horarios[0]?.responsavelId).toBe(paulo.id);
  });

  it('altera o limite do grupo fixo e a ocorrência nova acompanha', async () => {
    const s = servicos(orm);
    const marina = await professor(s, 'limite-fixo@personalytte.local');
    const ana = await s.alunos.criar({
      nome: 'Ana Limite',
      telefone: '11911118021',
      genero: 'FEMININO',
      plano: 'PARTICULAR',
      categoria: 'D',
      horarios: [{ dia: 'seg', horarioInicio: '07:00', responsavelId: marina.id }],
    }, AGORA);
    const ampliado = await s.grupos.trocarProfessorFixo({
      dia: 'seg',
      horarioInicio: '07:00',
      responsavelId: marina.id,
      capacidade: 6,
    }, AGORA);
    const grupo = ampliado.find((item) => item.dia === 'seg' && item.horarioInicio === '07:00');
    expect(grupo?.capacidade).toBe(6);
    const aulas = await aulasDe(orm, ana.id);
    const futuras = aulas.filter((aula) => aula.grupo.inicio > AGORA);
    expect(futuras.length).toBeGreaterThan(0);
    expect(futuras.every((aula) => aula.grupo.capacidade === 6 && aula.ligadaAoPlano)).toBe(true);

    const ultima = futuras[futuras.length - 1];
    const contexto = orm.em.fork();
    const aula = await contexto.findOneOrFail(Aula, ultima.id, { populate: ['grupo'] });
    contexto.remove(aula);
    contexto.remove(aula.grupo);
    await contexto.flush();
    const aluno = await s.em.findOneOrFail(Aluno, ana.id);
    await s.agenda.gerarOcorrencias(s.em, aluno, AGORA, 'recusar');
    await s.em.flush();
    const recriadas = await aulasDe(orm, ana.id);
    const nova = recriadas.find((item) => item.grupo.inicio.getTime() === ultima.grupo.inicio.getTime());
    expect(nova?.grupo.capacidade).toBe(6);
    expect(nova?.ligadaAoPlano).toBe(true);

    for (const [indice, nome] of ['Bruno Limite', 'Carla Limite', 'Diego Limite', 'Elena Limite'].entries()) {
      const criado = await s.alunos.criar({
        nome,
        telefone: `1191111803${indice}`,
        genero: 'MASCULINO',
        plano: 'PARTICULAR',
        categoria: 'C',
      }, AGORA);
      await s.grupos.adicionarFixo({
        dia: 'seg',
        horarioInicio: '07:00',
        responsavelId: marina.id,
        alunoId: criado.id,
      }, AGORA);
    }
    await expect(s.grupos.trocarProfessorFixo({
      dia: 'seg',
      horarioInicio: '07:00',
      responsavelId: marina.id,
      capacidade: 4,
    }, AGORA)).rejects.toMatchObject({ codigo: 'HORARIO_OCUPADO' });
    const segue = await s.grupos.listarFixos(AGORA);
    expect(segue.find((item) => item.dia === 'seg' && item.horarioInicio === '07:00')?.capacidade).toBe(6);
  });

  it('cria um grupo fixo novo na sexta', async () => {
    const s = servicos(orm);
    const marina = await professor(s, 'sexta-nova@personalytte.local');
    const ana = await s.alunos.criar({
      nome: 'Ana Sexta',
      telefone: '11911118041',
      genero: 'FEMININO',
      plano: 'PARTICULAR',
      categoria: 'D',
    }, AGORA);
    const lista = await s.grupos.criarFixo({
      dia: 'sex',
      horarioInicio: '18:00',
      responsavelId: marina.id,
      capacidade: 6,
      alunoIds: [ana.id],
    }, AGORA);
    const sexta = lista.find((grupo) => grupo.dia === 'sex' && grupo.horarioInicio === '18:00');
    expect(sexta?.responsavel.id).toBe(marina.id);
    expect(sexta?.capacidade).toBe(6);
    expect(sexta?.alunos.map((aluno) => aluno.nome)).toEqual(['Ana Sexta']);
    const aulas = await aulasDe(orm, ana.id);
    expect(aulas.some((aula) => aula.status === 'AGUARDANDO' && aula.ligadaAoPlano && aula.grupo.responsavel.id === marina.id)).toBe(true);
    await expect(s.grupos.criarFixo({
      dia: 'sex',
      horarioInicio: '18:00',
      responsavelId: marina.id,
      alunoIds: [ana.id],
    }, AGORA)).rejects.toMatchObject({ codigo: 'DADOS_INVALIDOS' });
  });
});
