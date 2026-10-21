import { createHmac } from 'crypto';
import { MikroORM } from '@mikro-orm/core';
import { type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { BootstrapService } from '../src/bootstrap/bootstrap.service';
import { configurarAplicacao } from '../src/main';
import { assinaturaGympass } from '../src/modulos/checkins/assinatura';
import { registrarProvedores } from '../src/modulos/checkins/registro';
import { TRUNCAR, garantirBancoTeste } from './banco';

const SEGREDO = 'segredo-gympass';
const TOKEN = 'token-totalpass';
const CHAVES = [
  'PUBLIC_BASE_URL',
  'GYMPASS_API_TOKEN',
  'GYMPASS_GYM_ID',
  'GYMPASS_WEBHOOK_SECRET',
  'TOTALPASS_PARTNER_API_KEY',
  'TOTALPASS_PLACE_API_KEY',
  'TOTALPASS_WEBHOOK_TOKEN',
] as const;

function guardarEnv(): Record<string, string | undefined> {
  return Object.fromEntries(CHAVES.map((chave) => [chave, process.env[chave]]));
}

function restaurarEnv(antes: Record<string, string | undefined>): void {
  for (const chave of CHAVES) {
    const valor = antes[chave];
    if (valor === undefined) delete process.env[chave];
    else process.env[chave] = valor;
  }
}

describe('registro dos webhooks', () => {
  it('cadastra os dois endereços e não chama validação', async () => {
    const antes = guardarEnv();
    process.env.PUBLIC_BASE_URL = 'https://painel.exemplo';
    process.env.GYMPASS_API_TOKEN = 'token';
    process.env.GYMPASS_GYM_ID = '123';
    process.env.GYMPASS_WEBHOOK_SECRET = SEGREDO;
    process.env.TOTALPASS_PARTNER_API_KEY = 'partner';
    process.env.TOTALPASS_PLACE_API_KEY = 'place';
    process.env.TOTALPASS_WEBHOOK_TOKEN = TOKEN;
    const chamadas: { url: string; body: string }[] = [];
    try {
      await registrarProvedores(async (url, init) => {
        chamadas.push({ url, body: typeof init?.body === 'string' ? init.body : '' });
        if (url.endsWith('/partner/auth')) return Response.json({ token: 'jwt' }, { status: 201 });
        return Response.json({ ok: true }, { status: 201 });
      });
    } finally {
      restaurarEnv(antes);
    }
    const urls = chamadas.map((chamada) => chamada.url).join('\n');
    expect(urls).not.toMatch(/validate|webhook_confirmations/);
    const gympass = chamadas.find((chamada) => chamada.url.includes('/v1/systems/gyms/123/webhooks'));
    expect(gympass?.body).toContain('"event":"checkin"');
    expect(gympass?.body).toContain('"additional_data":true');
    expect(gympass?.body).toContain('https://painel.exemplo/api/webhooks/gympass');
    const totalpass = chamadas.find((chamada) => chamada.url.endsWith('/partner/webhook/create'));
    expect(totalpass?.body).toContain('"webhook_type":"CHECKIN"');
    expect(totalpass?.body).toContain(encodeURIComponent(TOKEN));
  });
});

describe('check-ins http', () => {
  let app: INestApplication;
  const chamadas: string[] = [];
  const fetchOriginal = globalThis.fetch;

  beforeAll(async () => {
    await garantirBancoTeste();
    app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false, rawBody: true });
    configurarAplicacao(app as NestExpressApplication);
    await app.init();
    const orm = app.get(MikroORM);
    await orm.em.fork().getConnection().execute(TRUNCAR);
    await new BootstrapService().executar(orm.em.fork());
    process.env.GYMPASS_API_TOKEN = 'token';
    process.env.GYMPASS_GYM_ID = '123';
    process.env.GYMPASS_WEBHOOK_SECRET = SEGREDO;
    process.env.TOTALPASS_PARTNER_API_KEY = 'partner';
    process.env.TOTALPASS_PLACE_API_KEY = 'place';
    process.env.TOTALPASS_WEBHOOK_TOKEN = TOKEN;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      chamadas.push(String(input));
      return new Response('{}', { status: 500 });
    }) as typeof fetch;
  });

  afterAll(async () => {
    globalThis.fetch = fetchOriginal;
    await app?.close();
  });

  it('grava os dois provedores no dia de Brasília e recusa assinatura inválida', async () => {
    const admin = request.agent(app.getHttpServer());
    const entrada = await admin.post('/api/sessao').send({ email: 'admin@personalytte.local', senha: 'senha-inicial' });
    expect(entrada.status).toBe(200);

    const aluno = await admin.post('/api/alunos').send({
      nome: 'Ana Lima',
      telefone: '11911110001',
      email: 'ana-checkin@personalytte.local',
      plano: 'PARTICULAR',
      categoria: 'D',
    });
    expect(aluno.status).toBe(201);

    const gympass = {
      event_type: 'checkin',
      event_data: {
        user: {
          unique_token: '0123456789012',
          first_name: 'Ana',
          last_name: 'Lima',
          email: 'ana-checkin@personalytte.local',
          phone_number: '11911110001',
        },
        timestamp: Math.floor(Date.parse('2026-10-21T10:00:00-03:00') / 1000),
      },
    };
    const bruto = JSON.stringify(gympass);
    const assinatura = assinaturaGympass(Buffer.from(bruto), SEGREDO);
    expect(createHmac('sha1', SEGREDO).update(bruto).digest('hex')).toBe(assinatura);

    const recusado = await request(app.getHttpServer())
      .post('/api/webhooks/gympass')
      .set('content-type', 'application/json')
      .set('x-gympass-signature', '0xdead')
      .send(bruto);
    expect(recusado.status).toBe(401);

    const aceito = await request(app.getHttpServer())
      .post('/api/webhooks/gympass')
      .set('content-type', 'application/json')
      .set('x-gympass-signature', `0x${assinatura}`)
      .send(bruto);
    expect(aceito.status).toBe(201);
    expect(aceito.body).toEqual({ recebido: true });

    const repetido = await request(app.getHttpServer())
      .post('/api/webhooks/gympass')
      .set('content-type', 'application/json')
      .set('x-gympass-signature', assinatura.toUpperCase())
      .send(bruto);
    expect(repetido.status).toBe(201);

    const semToken = await request(app.getHttpServer()).post('/api/webhooks/totalpass').send({
      type: 'CHECK_IN_CREATED',
      endpoint: 'https://admin.totalpass.com/api/v1/webhook_confirmations/abcTOKEN',
      check_in: { started_at: '2026-10-21T11:00:00-03:00' },
      user: { name: 'Bruno Souza', email: 'bruno@personalytte.local', phone: '11922220002', document_number: '66844563680', code: 'EQ2' },
    });
    expect(semToken.status).toBe(401);

    const totalpass = await request(app.getHttpServer())
      .post('/api/webhooks/totalpass')
      .query({ token: TOKEN })
      .send({
        type: 'CHECK_IN_CREATED',
        endpoint: 'https://admin.totalpass.com/api/v1/webhook_confirmations/abcTOKEN',
        check_in: { started_at: '2026-10-21T11:00:00-03:00' },
        user: { name: 'Bruno Souza', email: 'bruno@personalytte.local', phone: '11922220002', document_number: '66844563680', code: 'EQ2' },
      });
    expect(totalpass.status).toBe(201);

    const dia = await admin.get('/api/checkins').query({ data: '2026-10-21' });
    expect(dia.status).toBe(200);
    expect(dia.body.gympass).toBe(true);
    expect(dia.body.totalpass).toBe(true);
    expect(dia.body.itens.map((item: { nome: string; provedor: string; alunoId: string | null }) => ({
      nome: item.nome,
      provedor: item.provedor,
      alunoId: item.alunoId,
    }))).toEqual([
      { nome: 'Bruno Souza', provedor: 'TOTALPASS', alunoId: null },
      { nome: 'Ana Lima', provedor: 'GYMPASS', alunoId: aluno.body.id },
    ]);
    expect(JSON.stringify(dia.body)).not.toContain('66844563680');

    const outroDia = await admin.get('/api/checkins').query({ data: '2026-10-20' });
    expect(outroDia.body.itens).toEqual([]);

    const professor = await admin.post('/api/integrantes').send({
      nome: 'Marina Costa',
      email: 'marina-checkin@personalytte.local',
      senha: 'professor1',
      funcao: 'PROFESSOR',
    });
    expect(professor.status).toBe(201);
    const sessaoProfessor = request.agent(app.getHttpServer());
    await sessaoProfessor.post('/api/sessao').send({ email: 'marina-checkin@personalytte.local', senha: 'professor1' });
    const leitura = await sessaoProfessor.get('/api/checkins').query({ data: '2026-10-21' });
    expect(leitura.status).toBe(200);
    expect(leitura.body.itens).toHaveLength(2);

    expect(chamadas.join('\n')).not.toMatch(/validate|webhook_confirmations/);
  });
});
