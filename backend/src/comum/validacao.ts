import type { EntityManager } from '@mikro-orm/core';
import { Aluno } from '../entidades/aluno.entity';
import { CATEGORIAS, FUNCOES, PLANOS, STATUS_AULA, TIPOS_EVENTO, type CategoriaAluno, type FuncaoIntegrante, type PlanoAluno, type StatusAula, type TipoEvento } from '../entidades/enums';
import { Integrante } from '../entidades/integrante.entity';
import { ErroApi, MENSAGEM_PLANO, dadosInvalidos, naoEncontrado } from './erros';
import { adicionarDias, dataCalendario, dataCalendarioValida, ehDiaSemana, horarioValido, ordenarHorarios, terminaNoMesmoDia, type HorarioPlano } from './tempo';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function veio(corpo: object, chave: string): boolean {
  return Object.prototype.hasOwnProperty.call(corpo, chave);
}

export function exigirObjeto(corpo: unknown): Record<string, unknown> {
  if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) {
    throw dadosInvalidos('Corpo da requisição inválido.');
  }
  return corpo as Record<string, unknown>;
}

export function textoObrigatorio(valor: unknown, rotulo: string): string {
  if (typeof valor !== 'string' || valor.trim() === '') throw dadosInvalidos(`Informe ${rotulo}.`);
  return valor.trim();
}

export function textoOpcional(valor: unknown, rotulo: string): string | null {
  if (valor == null || valor === '') return null;
  if (typeof valor !== 'string') throw dadosInvalidos(`${rotulo} inválido.`);
  const texto = valor.trim();
  return texto === '' ? null : texto;
}

export function emailObrigatorio(valor: unknown): string {
  const email = textoObrigatorio(valor, 'o e-mail').toLowerCase();
  if (!EMAIL.test(email)) throw dadosInvalidos('E-mail inválido.');
  return email;
}

export function emailOpcional(valor: unknown): string | null {
  const email = textoOpcional(valor, 'E-mail');
  if (email && !EMAIL.test(email)) throw dadosInvalidos('E-mail inválido.');
  return email ? email.toLowerCase() : null;
}

export function instagramOpcional(valor: unknown): string | null {
  const texto = textoOpcional(valor, 'Instagram');
  if (!texto) return null;
  const usuario = texto.replace(/^@+/, '');
  if (!/^[A-Za-z0-9._]{1,30}$/.test(usuario)) {
    throw dadosInvalidos('Informe o usuário do Instagram, sem o endereço.');
  }
  return usuario;
}

export function senhaObrigatoria(valor: unknown): string {
  if (typeof valor !== 'string' || valor.length < 8) throw dadosInvalidos('A senha precisa ter no mínimo 8 caracteres.');
  if (valor.length > 72) throw dadosInvalidos('A senha pode ter no máximo 72 caracteres.');
  return valor;
}

export function telefoneObrigatorio(valor: unknown): string {
  const digitos = normalizarTelefone(valor);
  if (!digitos) throw dadosInvalidos('Informe o telefone.');
  if (digitos.length < 10 || digitos.length > 11) throw dadosInvalidos('Telefone precisa ter 10 ou 11 dígitos.');
  return digitos;
}

export function telefoneOpcional(valor: unknown): string | null {
  if (valor == null || valor === '') return null;
  const digitos = normalizarTelefone(valor);
  if (!digitos || digitos.length < 10 || digitos.length > 11) {
    throw dadosInvalidos('Telefone precisa ter 10 ou 11 dígitos.');
  }
  return digitos;
}

function normalizarTelefone(valor: unknown): string | null {
  if (typeof valor !== 'string') return null;
  const digitos = valor.replace(/\D/g, '');
  return digitos;
}

export function enumerado<T extends string>(valor: unknown, opcoes: readonly T[], rotulo: string): T {
  if (typeof valor !== 'string' || !opcoes.includes(valor as T)) {
    throw dadosInvalidos(`${rotulo} inválido.`);
  }
  return valor as T;
}

export function funcaoDe(valor: unknown): FuncaoIntegrante {
  return enumerado(valor, FUNCOES, 'Função');
}

export function planoDe(valor: unknown): PlanoAluno {
  return enumerado(valor, PLANOS, 'Plano');
}

export function categoriaDe(valor: unknown): CategoriaAluno {
  return enumerado(valor, CATEGORIAS, 'Categoria');
}

export function statusDe(valor: unknown): StatusAula {
  return enumerado(valor, STATUS_AULA, 'Status');
}

export function tipoEventoDe(valor: unknown): TipoEvento {
  return enumerado(valor, TIPOS_EVENTO, 'Tipo de evento');
}

export function dataOpcional(valor: unknown, rotulo: string): string | null {
  if (valor == null || valor === '') return null;
  if (typeof valor !== 'string' || !dataCalendarioValida(valor)) throw dadosInvalidos(`${rotulo} inválida.`);
  return valor;
}

export function uuidDe(valor: unknown, rotulo: string): string {
  if (typeof valor !== 'string' || !UUID.test(valor)) throw dadosInvalidos(`${rotulo} inválido.`);
  return valor;
}

export function instanteDe(valor: unknown, rotulo: string): Date {
  if (typeof valor !== 'string' || valor.trim() === '') throw dadosInvalidos(`Informe ${rotulo}.`);
  if (!/(?:Z|[+-]\d{2}:\d{2})$/i.test(valor)) throw dadosInvalidos(`${rotulo} precisa incluir o fuso.`);
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) throw dadosInvalidos(`${rotulo} inválido.`);
  return data;
}

export function booleanoDe(valor: unknown, rotulo: string): boolean {
  if (typeof valor !== 'boolean') throw dadosInvalidos(`${rotulo} inválido.`);
  return valor;
}

function minutosDoHorario(horario: string): number {
  const [hora, minuto] = horario.split(':').map(Number);
  return hora * 60 + minuto;
}

function horariosCruzam(a: string, b: string): boolean {
  const inicioA = minutosDoHorario(a);
  const inicioB = minutosDoHorario(b);
  return inicioA < inicioB + 60 && inicioB < inicioA + 60;
}

export function horariosDe(valor: unknown): HorarioPlano[] {
  if (!Array.isArray(valor)) throw dadosInvalidos('Horários inválidos.');
  const horarios: HorarioPlano[] = [];
  for (const item of valor) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw dadosInvalidos('Horário inválido.');
    const bruto = item as Record<string, unknown>;
    if (typeof bruto.dia !== 'string' || !ehDiaSemana(bruto.dia)) throw dadosInvalidos('Dia da semana inválido.');
    if (typeof bruto.horarioInicio !== 'string' || !horarioValido(bruto.horarioInicio)) {
      throw dadosInvalidos('Horário precisa caber em uma aula de 60 minutos no mesmo dia.');
    }
    horarios.push({ dia: bruto.dia, horarioInicio: bruto.horarioInicio });
  }
  const ordenados = ordenarHorarios(horarios);
  for (let indice = 1; indice < ordenados.length; indice += 1) {
    const anterior = ordenados[indice - 1];
    const atual = ordenados[indice];
    if (anterior.dia !== atual.dia) continue;
    if (anterior.horarioInicio === atual.horarioInicio) throw dadosInvalidos('Esse dia e horário já estão no plano.');
    if (horariosCruzam(anterior.horarioInicio, atual.horarioInicio)) throw dadosInvalidos('Dois horários do mesmo dia se cruzam.');
  }
  return ordenados;
}

export type PlanoInterpretado = {
  horarios: HorarioPlano[];
  responsavelId: string | null;
  completo: boolean;
};

export function interpretarPlano(
  horariosInformados: boolean,
  horariosValor: unknown,
  responsavelInformado: boolean,
  responsavelValor: unknown,
  atual?: { horarios: HorarioPlano[]; responsavelId: string | null },
): PlanoInterpretado {
  const horarios = horariosInformados ? horariosDe(horariosValor) : (atual?.horarios ?? []);
  let responsavelId: string | null;
  if (responsavelInformado) {
    responsavelId = responsavelValor == null || responsavelValor === '' ? null : uuidDe(responsavelValor, 'Responsável');
  } else {
    responsavelId = atual?.responsavelId ?? null;
  }
  const temHorario = horarios.length > 0;
  const temResponsavel = responsavelId != null;
  if (temHorario !== temResponsavel) throw new ErroApi(400, 'PLANO_INCOMPLETO', MENSAGEM_PLANO);
  return {
    horarios: temHorario ? horarios : [],
    responsavelId: temResponsavel ? responsavelId : null,
    completo: temHorario && temResponsavel,
  };
}

export function exigirMesmoDia(inicio: Date): void {
  if (!terminaNoMesmoDia(inicio)) {
    throw dadosInvalidos('A aula precisa começar e terminar no mesmo dia.');
  }
}

export async function responsavelAtivo(em: EntityManager, id: string): Promise<Integrante> {
  const responsavel = await em.findOne(Integrante, { id });
  if (!responsavel) throw naoEncontrado('Responsável não encontrado.');
  if (!responsavel.ativo) throw dadosInvalidos('Responsável inativo.');
  return responsavel;
}

export async function alunoAtivo(em: EntityManager, id: string): Promise<Aluno> {
  const aluno = await em.findOne(Aluno, { id });
  if (!aluno || !aluno.ativo) throw naoEncontrado('Aluno não encontrado.');
  return aluno;
}

export function escaparLike(valor: string): string {
  return valor.replace(/[\\%_]/g, '\\$&');
}

export function planoMudou(
  antes: { horarios: HorarioPlano[]; responsavelId: string | null },
  depois: { horarios: HorarioPlano[]; responsavelId: string | null },
): boolean {
  const chave = (horarios: HorarioPlano[]) => horarios.map((horario) => `${horario.dia} ${horario.horarioInicio}`).join('|');
  return antes.responsavelId !== depois.responsavelId || chave(antes.horarios) !== chave(depois.horarios);
}

export function idRelacao(relacao: { id: string } | null | undefined): string | null {
  return relacao?.id ?? null;
}

export function exigirIntervalo(de: unknown, ate: unknown): { inicio: Date; fim: Date } {
  if (typeof de !== 'string' || typeof ate !== 'string' || !dataCalendarioValida(de) || !dataCalendarioValida(ate) || de > ate) {
    throw dadosInvalidos('Informe o intervalo com as datas de e ate.');
  }
  return { inicio: dataCalendario(de), fim: adicionarDias(dataCalendario(ate), 1) };
}
