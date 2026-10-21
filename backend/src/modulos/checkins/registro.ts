import { gympassConfigurado, textoEnv, totalpassConfigurado } from './assinatura';

type Buscar = (url: string, init?: RequestInit) => Promise<Response>;

const GYMPASS_SETUP = 'https://api.partners.gympass.com';
const TOTALPASS_API = 'https://gym-service-api.totalpass.com';

function basePublica(): string {
  return textoEnv('PUBLIC_BASE_URL').replace(/\/+$/, '');
}

async function tokenTotalpass(buscar: Buscar): Promise<string | null> {
  const resposta = await buscar(`${TOTALPASS_API}/partner/auth`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      partner_api_key: textoEnv('TOTALPASS_PARTNER_API_KEY'),
      place_api_key: textoEnv('TOTALPASS_PLACE_API_KEY'),
    }),
  });
  if (!resposta.ok) return null;
  const corpo = (await resposta.json()) as unknown;
  return tokenDe(corpo);
}

function tokenDe(corpo: unknown): string | null {
  if (!corpo || typeof corpo !== 'object') return null;
  const obj = corpo as Record<string, unknown>;
  for (const chave of ['token', 'jwt', 'access_token']) {
    if (typeof obj[chave] === 'string' && obj[chave]) return obj[chave];
  }
  if (obj.data && typeof obj.data === 'object') return tokenDe(obj.data);
  return null;
}

export async function registrarProvedores(buscar: Buscar = fetch): Promise<void> {
  const base = basePublica();
  if (!base) return;
  await Promise.all([registrarGympass(buscar, base), registrarTotalpass(buscar, base)]);
}

async function registrarGympass(buscar: Buscar, base: string): Promise<void> {
  if (!gympassConfigurado()) return;
  const gymId = textoEnv('GYMPASS_GYM_ID');
  const url = `${base}/api/webhooks/gympass`;
  try {
    const resposta = await buscar(`${GYMPASS_SETUP}/v1/systems/gyms/${encodeURIComponent(gymId)}/webhooks`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${textoEnv('GYMPASS_API_TOKEN')}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        webhooks: [
          {
            event: 'checkin',
            url,
            secret: textoEnv('GYMPASS_WEBHOOK_SECRET'),
            additional_data: true,
          },
        ],
      }),
    });
    if (!resposta.ok) console.warn(`Webhook do Gympass não registrado (${resposta.status}).`);
  } catch (erro) {
    console.warn('Webhook do Gympass não registrado.', erro);
  }
}

async function registrarTotalpass(buscar: Buscar, base: string): Promise<void> {
  if (!totalpassConfigurado()) return;
  const url = `${base}/api/webhooks/totalpass?token=${encodeURIComponent(textoEnv('TOTALPASS_WEBHOOK_TOKEN'))}`;
  try {
    const token = await tokenTotalpass(buscar);
    if (!token) {
      console.warn('Webhook da TotalPass não registrado: autenticação recusada.');
      return;
    }
    const resposta = await buscar(`${TOTALPASS_API}/partner/webhook/create`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ webhook_url: url, webhook_type: 'CHECKIN' }),
    });
    if (!resposta.ok) console.warn(`Webhook da TotalPass não registrado (${resposta.status}).`);
  } catch (erro) {
    console.warn('Webhook da TotalPass não registrado.', erro);
  }
}
