import { createHmac, timingSafeEqual } from 'crypto';

export function textoEnv(nome: string): string {
  return process.env[nome]?.trim() ?? '';
}

export function gympassConfigurado(): boolean {
  return Boolean(textoEnv('GYMPASS_API_TOKEN') && textoEnv('GYMPASS_GYM_ID') && textoEnv('GYMPASS_WEBHOOK_SECRET'));
}

export function totalpassConfigurado(): boolean {
  return Boolean(
    textoEnv('TOTALPASS_PARTNER_API_KEY') &&
      textoEnv('TOTALPASS_PLACE_API_KEY') &&
      textoEnv('TOTALPASS_WEBHOOK_TOKEN'),
  );
}

/** HMAC-SHA1 do corpo cru. O exemplo publicado da Wellhub tem 40 hex, às vezes com prefixo 0x. */
export function assinaturaGympass(corpo: Buffer, segredo: string): string {
  return createHmac('sha1', segredo).update(corpo).digest('hex');
}

export function assinaturaConfere(recebida: string | undefined, corpo: Buffer, segredo: string): boolean {
  if (!recebida || !segredo || corpo.length === 0) return false;
  const esperada = assinaturaGympass(corpo, segredo);
  const limpa = recebida.trim().replace(/^0x/i, '').toLowerCase();
  if (limpa.length !== esperada.length) return false;
  return timingSafeEqual(Buffer.from(limpa), Buffer.from(esperada));
}

export function tokenConfere(recebido: string | undefined, esperado: string): boolean {
  if (!recebido || !esperado) return false;
  const informado = Buffer.from(recebido);
  const oficial = Buffer.from(esperado);
  if (informado.length !== oficial.length) return false;
  return timingSafeEqual(informado, oficial);
}
