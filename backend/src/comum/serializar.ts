import { Aluno } from '../entidades/aluno.entity';
import { Aula } from '../entidades/aula.entity';
import { Aviso } from '../entidades/aviso.entity';
import { Evento } from '../entidades/evento.entity';
import { papelDe } from '../entidades/enums';
import { Integrante } from '../entidades/integrante.entity';
import type { AlunoResposta, AulaResposta, AvisoResposta, EventoResposta, IntegranteAtual, IntegranteResposta, ResponsavelResposta } from './contrato';
import { formatarInstante } from './tempo';
import { idRelacao } from './validacao';

export function dataNascimentoDe(valor: string | Date | null | undefined): string | null {
  if (!valor) return null;
  if (typeof valor === 'string') return valor.slice(0, 10);
  const ano = valor.getUTCFullYear();
  const mes = String(valor.getUTCMonth() + 1).padStart(2, '0');
  const dia = String(valor.getUTCDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

export function serializarSessao(integrante: Integrante): IntegranteAtual {
  return {
    id: integrante.id,
    nome: integrante.nome,
    email: integrante.email,
    funcao: integrante.funcao,
    papel: papelDe(integrante.funcao),
    ativo: integrante.ativo,
  };
}

export function serializarIntegrante(integrante: Integrante): IntegranteResposta {
  return {
    ...serializarSessao(integrante),
    telefone: integrante.telefone,
    dataNascimento: dataNascimentoDe(integrante.dataNascimento),
    cadastradoEm: formatarInstante(integrante.cadastradoEm),
  };
}

export function serializarResponsavel(integrante: Integrante): ResponsavelResposta {
  return { id: integrante.id, nome: integrante.nome, funcao: integrante.funcao };
}

export function serializarAluno(aluno: Aluno): AlunoResposta {
  return {
    id: aluno.id,
    nome: aluno.nome,
    telefone: aluno.telefone,
    email: aluno.email,
    instagram: aluno.instagram,
    dataNascimento: dataNascimentoDe(aluno.dataNascimento),
    plano: aluno.plano,
    categoria: aluno.categoria,
    horarios: aluno.horarios,
    responsavelId: idRelacao(aluno.responsavel),
    ativo: aluno.ativo,
    temporario: aluno.temporario,
    cadastradoEm: formatarInstante(aluno.cadastradoEm),
  };
}

export function serializarAula(aula: Aula): AulaResposta {
  return {
    id: aula.id,
    aluno: {
      id: aula.aluno.id,
      nome: aula.aluno.nome,
      categoria: aula.aluno.categoria,
      telefone: aula.aluno.telefone,
      temporario: aula.aluno.temporario,
    },
    responsavel: { id: aula.responsavel.id, nome: aula.responsavel.nome },
    inicio: formatarInstante(aula.inicio),
    fim: formatarInstante(aula.fim),
    status: aula.status,
    experimental: aula.experimental,
    reposicaoDeAulaId: idRelacao(aula.reposicaoDe),
    ligadaAoPlano: aula.ligadaAoPlano,
  };
}

export function serializarEvento(evento: Evento): EventoResposta {
  return {
    id: evento.id,
    tipo: evento.tipo,
    nome: evento.nome,
    inicio: formatarInstante(evento.inicio),
    fim: formatarInstante(evento.fim),
    contato: evento.contato,
    bloqueiaAulas: evento.bloqueiaAulas,
    responsavelId: idRelacao(evento.responsavel),
  };
}

export function serializarAviso(aviso: Aviso): AvisoResposta {
  return {
    id: aviso.id,
    titulo: aviso.titulo,
    mensagem: aviso.mensagem,
    criadoEm: formatarInstante(aviso.criadoEm),
  };
}
