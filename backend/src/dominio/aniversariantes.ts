import type { EntityManager } from '@mikro-orm/core';
import { dataNascimentoDe } from '../comum/serializar';
import { adicionarDias, dataSP, FUSO, inicioDaSemana } from '../comum/tempo';
import { Aluno } from '../entidades/aluno.entity';
import { Aviso } from '../entidades/aviso.entity';

type Aniversariante = { nome: string; dia: string };

export function tituloAvisoAniversariantes(agora: Date): string {
  const segunda = inicioDaSemana(agora);
  const domingo = adicionarDias(segunda, 6);
  return `Aniversariantes da semana · ${formatarFaixa(segunda, domingo)}`;
}

export async function garantirAvisoAniversariantes(em: EntityManager, agora = new Date()): Promise<void> {
  const titulo = tituloAvisoAniversariantes(agora);
  const existe = await em.findOne(Aviso, { titulo });
  if (existe) return;
  const aniversariantes = await listarAniversariantesDaSemana(em, agora);
  if (aniversariantes.length === 0) return;
  const aviso = new Aviso();
  aviso.titulo = titulo;
  aviso.mensagem = montarMensagem(aniversariantes);
  aviso.criadoEm = agora;
  aviso.atualizadoEm = agora;
  em.persist(aviso);
  await em.flush();
}

async function listarAniversariantesDaSemana(em: EntityManager, agora: Date): Promise<Aniversariante[]> {
  const dias = diasDaSemana(agora);
  const alunos = await em.find(Aluno, {
    ativo: true,
    temporario: false,
    dataNascimento: { $ne: null },
  });
  const lista: Aniversariante[] = [];
  for (const aluno of alunos) {
    const nascimento = dataNascimentoDe(aluno.dataNascimento);
    if (!nascimento) continue;
    const dia = diaDoAniversario(nascimento, dias);
    if (!dia) continue;
    lista.push({ nome: aluno.nome, dia });
  }
  lista.sort((a, b) => a.dia.localeCompare(b.dia) || a.nome.localeCompare(b.nome, 'pt-BR'));
  return lista;
}

function diasDaSemana(agora: Date): string[] {
  const segunda = inicioDaSemana(agora);
  return Array.from({ length: 7 }, (_, indice) => dataSP(adicionarDias(segunda, indice)));
}

function diaDoAniversario(nascimento: string, dias: string[]): string | null {
  const mesDia = nascimento.slice(5, 10);
  const direto = dias.find((dia) => dia.slice(5, 10) === mesDia);
  if (direto) return direto;
  if (mesDia === '02-29') return dias.find((dia) => dia.slice(5, 10) === '02-28') ?? null;
  return null;
}

function montarMensagem(aniversariantes: Aniversariante[]): string {
  const linhas = aniversariantes.map((item) => `• ${item.nome} — ${formatarDia(item.dia)}`);
  return `Alunos que fazem aniversário nesta semana:\n\n${linhas.join('\n')}`;
}

function formatarFaixa(segunda: Date, domingo: Date): string {
  const inicio = dataSP(segunda);
  const fim = dataSP(domingo);
  const dia = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, day: 'numeric' });
  const diaMes = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, day: 'numeric', month: 'long' });
  const completo = new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  if (inicio.slice(0, 7) === fim.slice(0, 7)) return `${dia.format(segunda)} a ${completo.format(domingo)}`;
  if (inicio.slice(0, 4) === fim.slice(0, 4)) return `${diaMes.format(segunda)} a ${completo.format(domingo)}`;
  return `${completo.format(segunda)} a ${completo.format(domingo)}`;
}

function formatarDia(data: string): string {
  const instante = new Date(`${data}T12:00:00-03:00`);
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(instante);
}
