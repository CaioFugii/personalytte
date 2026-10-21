import { MikroORM } from '@mikro-orm/core';
import { type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { BootstrapService } from '../src/bootstrap/bootstrap.service';
import { configurarAplicacao } from '../src/main';
import { TRUNCAR, garantirBancoTeste } from './banco';

describe('sessão http', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await garantirBancoTeste();
    app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });
    configurarAplicacao(app as NestExpressApplication);
    await app.init();
    const orm = app.get(MikroORM);
    await orm.em.fork().getConnection().execute(TRUNCAR);
    await new BootstrapService().executar(orm.em.fork());
  });

  afterAll(async () => {
    await app?.close();
  });

  it('entra com cookie httpOnly e impede o professor de gravar aluno', async () => {
    const admin = request.agent(app.getHttpServer());
    const entrada = await admin.post('/api/sessao').send({
      email: 'admin@personalytte.local',
      senha: 'senha-inicial',
    });
    expect(entrada.status).toBe(200);
    expect(entrada.body.papel).toBe('administrador');
    const cookie = entrada.headers['set-cookie']?.[0] ?? '';
    expect(cookie).toMatch(/sessao=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Max-Age=604800/);
    expect(cookie).not.toMatch(/Secure/);

    const atual = await admin.get('/api/sessao/atual');
    expect(atual.status).toBe(200);
    expect(atual.body.email).toBe('admin@personalytte.local');
    expect((await request(app.getHttpServer()).get('/api/sessao/atual')).status).toBe(401);

    const professor = await admin.post('/api/integrantes').send({
      nome: 'Marina Costa',
      email: 'marina-http@personalytte.local',
      senha: 'professor1',
      funcao: 'PROFESSOR',
    });
    expect(professor.status).toBe(201);

    const outros = await admin.post('/api/integrantes').send({
      nome: 'Recepção',
      email: 'recepcao-http@personalytte.local',
      senha: 'professor1',
      funcao: 'OUTROS',
    });
    expect(outros.status).toBe(201);
    expect(outros.body).toMatchObject({ funcao: 'OUTROS', papel: 'professor' });

    const sessaoProfessor = request.agent(app.getHttpServer());
    await sessaoProfessor.post('/api/sessao').send({ email: 'marina-http@personalytte.local', senha: 'professor1' });
    const negado = await sessaoProfessor.post('/api/alunos').send({
      nome: 'Ana',
      telefone: '11911110001',
      plano: 'PARTICULAR',
      categoria: 'D',
    });
    expect(negado.status).toBe(403);
    expect(negado.body.codigo).toBe('SEM_PERMISSAO');

    const criado = await admin.post('/api/alunos').send({
      nome: 'Ana Lima',
      telefone: '11911110001',
      plano: 'PARTICULAR',
      categoria: 'D',
    });
    expect(criado.status).toBe(201);
    expect(criado.body.ativo).toBe(true);

    const painel = await admin.get('/api/dashboard');
    expect(painel.status).toBe(200);
    expect(painel.body).toMatchObject({
      aulasHoje: expect.any(Number),
      confirmadas: expect.any(Number),
      alunosCadastrados: expect.any(Number),
      alunosDoDia: expect.any(Number),
      eventosDaSemana: expect.any(Array),
      avisos: expect.any(Array),
    });

    const encerrada = await admin.post('/api/sessao/encerrar');
    expect(encerrada.status).toBe(200);
    expect(encerrada.headers['set-cookie']?.[0]).toMatch(/Max-Age=0/);
  });

  it('devolve os campos das listas, a aula criada e o plano vazio', async () => {
    const admin = request.agent(app.getHttpServer());
    const entrada = await admin.post('/api/sessao').send({
      email: 'admin@personalytte.local',
      senha: 'senha-inicial',
    });
    expect(entrada.status).toBe(200);

    const integrante = await admin.post('/api/integrantes').send({
      nome: 'Paulo Campos',
      email: 'paulo-campos@personalytte.local',
      senha: 'professor1',
      funcao: 'PROFESSOR',
      telefone: '11922220002',
      dataNascimento: '1990-04-15',
    });
    expect(integrante.status).toBe(201);

    const listaIntegrantes = await admin.get('/api/integrantes');
    expect(listaIntegrantes.status).toBe(200);
    const paulo = listaIntegrantes.body.find((item: { email: string }) => item.email === 'paulo-campos@personalytte.local');
    expect(paulo).toMatchObject({
      id: integrante.body.id,
      nome: 'Paulo Campos',
      email: 'paulo-campos@personalytte.local',
      telefone: '11922220002',
      funcao: 'PROFESSOR',
      papel: 'professor',
      ativo: true,
      dataNascimento: '1990-04-15',
    });
    expect(paulo.cadastradoEm).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}-03:00$/);

    const evento = await admin.post('/api/eventos').send({
      tipo: 'AUSENCIA',
      nome: 'Ausência do Paulo',
      inicio: '2026-12-20T15:00:00-03:00',
      fim: '2026-12-20T17:00:00-03:00',
      contato: '11922220002',
      bloqueiaAulas: false,
      responsavelId: paulo.id,
    });
    expect(evento.status).toBe(201);

    const listaEventos = await admin.get('/api/eventos').query({ de: '2026-12-20', ate: '2026-12-20' });
    expect(listaEventos.status).toBe(200);
    const ausencia = listaEventos.body.find((item: { id: string }) => item.id === evento.body.id);
    expect(ausencia).toEqual({
      id: evento.body.id,
      tipo: 'AUSENCIA',
      nome: 'Ausência do Paulo',
      inicio: '2026-12-20T15:00:00-03:00',
      fim: '2026-12-20T17:00:00-03:00',
      contato: '11922220002',
      bloqueiaAulas: false,
      responsavelId: paulo.id,
    });

    const um = await admin.get(`/api/eventos/${ausencia.id}`);
    expect(um.status).toBe(200);
    expect(um.body).toEqual(ausencia);

    const editado = await admin.patch(`/api/eventos/${ausencia.id}`).send({ nome: 'Ausência editada' });
    expect(editado.status).toBe(200);
    expect(editado.body.id).toBe(ausencia.id);
    expect(editado.body.nome).toBe('Ausência editada');
    const apagado = await admin.delete(`/api/eventos/${ausencia.id}`);
    expect(apagado.status).toBe(200);
    expect(apagado.body).toEqual({ ok: true });

    const aviso = await admin.post('/api/avisos').send({
      titulo: 'Quadra',
      mensagem: 'A quadra fecha às 22h.',
    });
    expect(aviso.status).toBe(201);
    const listaAvisos = await admin.get('/api/avisos');
    expect(listaAvisos.status).toBe(200);
    const gravado = listaAvisos.body.find((item: { id: string }) => item.id === aviso.body.id);
    expect(gravado).toMatchObject({
      id: aviso.body.id,
      titulo: 'Quadra',
      mensagem: 'A quadra fecha às 22h.',
    });
    expect(gravado.criadoEm).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}-03:00$/);

    const aluno = await admin.post('/api/alunos').send({
      nome: 'Sem plano',
      telefone: '11933330003',
      plano: 'PARTICULAR',
      categoria: 'D',
      diasSemana: [],
      horarioInicio: null,
      responsavelId: null,
    });
    expect(aluno.status).toBe(201);
    expect(aluno.body).toMatchObject({
      diasSemana: [],
      horarioInicio: null,
      responsavelId: null,
      ativo: true,
    });

    const aula = await admin.post('/api/aulas').send({
      alunoId: aluno.body.id,
      responsavelId: paulo.id,
      inicio: '2026-12-15T10:00:00-03:00',
      experimental: false,
    });
    expect(aula.status).toBe(201);
    expect(aula.body).toMatchObject({
      id: expect.any(String),
      aluno: { id: aluno.body.id, nome: 'Sem plano', categoria: 'D' },
      responsavel: { id: paulo.id, nome: 'Paulo Campos' },
      inicio: '2026-12-15T10:00:00-03:00',
      fim: '2026-12-15T11:00:00-03:00',
      status: 'AGUARDANDO',
      experimental: false,
      reposicaoDeAulaId: null,
      ligadaAoPlano: false,
    });
  });
});
