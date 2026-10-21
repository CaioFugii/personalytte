import type { ProvedorCheckin } from '../../entidades/enums';

export type EntradaCheckin = {
  provedor: ProvedorCheckin;
  referencia: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  iniciadoEm: Date;
};

export type LeituraWebhook = { ignorar: true } | { ignorar: false; entrada: EntradaCheckin };

function objeto(valor: unknown): Record<string, unknown> | null {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return null;
  return valor as Record<string, unknown>;
}

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : '';
}

function emailDe(valor: unknown): string | null {
  const email = texto(valor).toLowerCase();
  return email.includes('@') ? email : null;
}

function telefoneDe(valor: unknown): string | null {
  const digitos = texto(valor).replace(/\D/g, '');
  return digitos || null;
}

function instanteDeNumero(valor: unknown): Date | null {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return null;
  const ms = valor > 1e12 ? valor : valor * 1000;
  const data = new Date(ms);
  return Number.isNaN(data.getTime()) ? null : data;
}

function instanteDeTexto(valor: unknown): Date | null {
  const bruto = texto(valor);
  if (!bruto) return null;
  const data = new Date(bruto);
  return Number.isNaN(data.getTime()) ? null : data;
}

export function lerGympass(corpo: unknown, agora = new Date()): LeituraWebhook | null {
  const raiz = objeto(corpo);
  if (!raiz) return null;
  if (texto(raiz.event_type) !== 'checkin') return { ignorar: true };
  const dados = objeto(raiz.event_data);
  const usuario = objeto(dados?.user);
  const token = texto(usuario?.unique_token);
  if (!token) return null;
  const instante = instanteDeNumero(dados?.timestamp) ?? agora;
  const nome = [texto(usuario?.first_name), texto(usuario?.last_name)].filter(Boolean).join(' ') || 'Visitante';
  return {
    ignorar: false,
    entrada: {
      provedor: 'GYMPASS',
      referencia: `${token}:${dados?.timestamp ?? instante.getTime()}`,
      nome,
      email: emailDe(usuario?.email),
      telefone: telefoneDe(usuario?.phone_number),
      iniciadoEm: instante,
    },
  };
}

export function lerTotalpass(corpo: unknown, agora = new Date()): LeituraWebhook | null {
  const raiz = objeto(corpo);
  if (!raiz) return null;
  if (texto(raiz.type) !== 'CHECK_IN_CREATED') return { ignorar: true };
  const usuario = objeto(raiz.user);
  const visita = objeto(raiz.check_in);
  const endpoint = texto(raiz.endpoint);
  const codigo = texto(usuario?.code);
  const inicio = instanteDeTexto(visita?.started_at) ?? agora;
  const referencia = endpoint.split('/').filter(Boolean).at(-1) || (codigo ? `${codigo}:${inicio.toISOString()}` : '');
  if (!referencia) return null;
  return {
    ignorar: false,
    entrada: {
      provedor: 'TOTALPASS',
      referencia,
      nome: texto(usuario?.name) || 'Visitante',
      email: emailDe(usuario?.email),
      telefone: telefoneDe(usuario?.phone),
      iniciadoEm: inicio,
    },
  };
}
