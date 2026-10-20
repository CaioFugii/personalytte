export const FUSO = 'America/Sao_Paulo';
export const DURACAO_AULA_MS = 60 * 60 * 1000;
export const SEMANA_MS = 7 * 24 * 60 * 60 * 1000;
export const SESSAO_MS = 7 * 24 * 60 * 60 * 1000;
export const SESSAO_MAX_AGE = 7 * 24 * 60 * 60;

const ORDEM_DIAS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'] as const;
export type DiaSemana = (typeof ORDEM_DIAS)[number];

export function ehDiaSemana(valor: string): valor is DiaSemana {
  return (ORDEM_DIAS as readonly string[]).includes(valor);
}

export function ordenarDias(dias: DiaSemana[]): DiaSemana[] {
  return [...dias].sort((a, b) => ORDEM_DIAS.indexOf(a) - ORDEM_DIAS.indexOf(b));
}

type Partes = { ano: number; mes: number; dia: number; hora: number; minuto: number; segundo: number };

export function partesSP(instante: Date): Partes {
  const formatador = new Intl.DateTimeFormat('en-US', {
    timeZone: FUSO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const mapa = new Map(formatador.formatToParts(instante).map((parte) => [parte.type, parte.value]));
  let hora = Number(mapa.get('hour'));
  if (hora === 24) hora = 0;
  return {
    ano: Number(mapa.get('year')),
    mes: Number(mapa.get('month')),
    dia: Number(mapa.get('day')),
    hora,
    minuto: Number(mapa.get('minute')),
    segundo: Number(mapa.get('second')),
  };
}

export function instanteSP(ano: number, mes: number, dia: number, hora = 0, minuto = 0, segundo = 0): Date {
  return new Date(Date.UTC(ano, mes - 1, dia, hora + 3, minuto, segundo));
}

export function doisDigitos(valor: number): string {
  return String(valor).padStart(2, '0');
}

export function dataRetroativa(inicio: Date, agora = new Date()): boolean {
  return dataSP(inicio) < dataSP(agora);
}

export function dataSP(instante: Date): string {
  const partes = partesSP(instante);
  return `${partes.ano}-${doisDigitos(partes.mes)}-${doisDigitos(partes.dia)}`;
}

export function formatarInstante(instante: Date): string {
  const partes = partesSP(instante);
  return `${partes.ano}-${doisDigitos(partes.mes)}-${doisDigitos(partes.dia)}T${doisDigitos(partes.hora)}:${doisDigitos(partes.minuto)}:${doisDigitos(partes.segundo)}-03:00`;
}

export function inicioDoDia(instante: Date): Date {
  const partes = partesSP(instante);
  return instanteSP(partes.ano, partes.mes, partes.dia);
}

export function dataCalendario(iso: string): Date {
  const [ano, mes, dia] = iso.split('-').map(Number);
  return instanteSP(ano, mes, dia);
}

export function adicionarDias(dia: Date, quantidade: number): Date {
  const partes = partesSP(dia);
  return instanteSP(partes.ano, partes.mes, partes.dia + quantidade, partes.hora, partes.minuto, partes.segundo);
}

export function limiteHorizonte(agora: Date): Date {
  return adicionarDias(inicioDoDia(agora), 56);
}

export function diaDaSemana(instante: Date): DiaSemana {
  const partes = partesSP(instante);
  const indice = new Date(Date.UTC(partes.ano, partes.mes - 1, partes.dia)).getUTCDay();
  return (['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'] as const)[indice];
}

export function inicioDaSemana(agora: Date): Date {
  const hoje = inicioDoDia(agora);
  const deslocamento = { seg: 0, ter: 1, qua: 2, qui: 3, sex: 4, sab: 5, dom: 6 }[diaDaSemana(hoje)];
  return adicionarDias(hoje, -deslocamento);
}

export function combinarDataHorario(dia: Date, horario: string): Date {
  const partes = partesSP(dia);
  const [hora, minuto] = horario.split(':').map(Number);
  return instanteSP(partes.ano, partes.mes, partes.dia, hora, minuto, 0);
}

export function fimDaAula(inicio: Date): Date {
  return new Date(inicio.getTime() + DURACAO_AULA_MS);
}

export function terminaNoMesmoDia(inicio: Date): boolean {
  return dataSP(inicio) === dataSP(fimDaAula(inicio));
}

export function jaComecou(inicio: Date, agora: Date): boolean {
  return inicio.getTime() <= agora.getTime();
}

export function dataCalendarioValida(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const [ano, mes, dia] = iso.split('-').map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  return data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia;
}

export function horarioValido(valor: string): boolean {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(valor)) return false;
  const [hora, minuto] = valor.split(':').map(Number);
  return hora * 60 + minuto + 60 < 24 * 60;
}

export function calcularOcorrencias(dias: readonly string[], horario: string, agora: Date): Date[] {
  const limite = limiteHorizonte(agora);
  const ocorrencias: Date[] = [];
  for (let dia = inicioDoDia(agora); dia.getTime() < limite.getTime(); dia = adicionarDias(dia, 1)) {
    if (!dias.includes(diaDaSemana(dia))) continue;
    const inicio = combinarDataHorario(dia, horario);
    if (inicio.getTime() <= agora.getTime()) continue;
    if (inicio.getTime() >= limite.getTime()) continue;
    ocorrencias.push(inicio);
  }
  return ocorrencias;
}
