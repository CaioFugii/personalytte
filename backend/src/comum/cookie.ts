import { createHmac, timingSafeEqual } from 'crypto';
import type { Response } from 'express';
import { SESSAO_MAX_AGE, SESSAO_MS } from './tempo';

export const NOME_COOKIE = 'sessao';

type Payload = { id: string; v: number; exp: number };

function segredo(): string {
  const valor = process.env.SESSION_SECRET;
  if (!valor) throw new Error('SESSION_SECRET ausente');
  return valor;
}

export function emitirToken(id: string, versao: number, agora = new Date()): string {
  const corpo = Buffer.from(JSON.stringify({ id, v: versao, exp: agora.getTime() + SESSAO_MS }), 'utf8').toString('base64url');
  const mac = createHmac('sha256', segredo()).update(corpo).digest('base64url');
  return `${corpo}.${mac}`;
}

export function lerToken(token: string, agora = new Date()): Payload | null {
  const ponto = token.lastIndexOf('.');
  if (ponto <= 0) return null;
  const corpo = token.slice(0, ponto);
  const mac = token.slice(ponto + 1);
  const esperado = createHmac('sha256', segredo()).update(corpo).digest('base64url');
  const recebido = Buffer.from(mac);
  const calculado = Buffer.from(esperado);
  if (recebido.length !== calculado.length || !timingSafeEqual(recebido, calculado)) return null;
  try {
    const json = JSON.parse(Buffer.from(corpo, 'base64url').toString('utf8')) as Partial<Payload>;
    if (typeof json.id !== 'string' || typeof json.v !== 'number' || typeof json.exp !== 'number') return null;
    if (json.exp <= agora.getTime()) return null;
    return { id: json.id, v: json.v, exp: json.exp };
  } catch {
    return null;
  }
}

export function lerCookie(cabecalho: string | undefined, nome = NOME_COOKIE): string | undefined {
  if (!cabecalho) return undefined;
  for (const parte of cabecalho.split(';')) {
    const [chave, ...resto] = parte.trim().split('=');
    if (chave === nome) return decodeURIComponent(resto.join('='));
  }
  return undefined;
}

function producao(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function definirSessao(res: Response, token: string): void {
  const partes = [
    `${NOME_COOKIE}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${SESSAO_MAX_AGE}`,
  ];
  if (producao()) partes.push('Secure');
  res.append('Set-Cookie', partes.join('; '));
}

export function limparSessao(res: Response): void {
  const partes = [`${NOME_COOKIE}=`, 'HttpOnly', 'SameSite=Lax', 'Path=/', 'Max-Age=0'];
  if (producao()) partes.push('Secure');
  res.append('Set-Cookie', partes.join('; '));
}
