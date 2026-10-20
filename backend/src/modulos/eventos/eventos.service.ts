import { EntityManager } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import type { EventoResposta } from '../../comum/contrato';
import { dadosInvalidos, naoEncontrado, traduzirErroBanco } from '../../comum/erros';
import { serializarEvento } from '../../comum/serializar';
import { booleanoDe, exigirIntervalo, exigirObjeto, instanteDe, responsavelAtivo, textoObrigatorio, textoOpcional, tipoEventoDe, uuidDe, veio } from '../../comum/validacao';
import { AgendaService } from '../../dominio/agenda.service';
import { Evento } from '../../entidades/evento.entity';

@Injectable()
export class EventosService {
  constructor(
    private readonly em: EntityManager,
    private readonly agenda: AgendaService,
  ) {}

  async listar(de: unknown, ate: unknown): Promise<EventoResposta[]> {
    const intervalo = exigirIntervalo(de, ate);
    const eventos = await this.em.find(Evento, {
      inicio: { $lt: intervalo.fim },
      fim: { $gt: intervalo.inicio },
    }, { populate: ['responsavel'], orderBy: { inicio: 'asc' } });
    return eventos.map(serializarEvento);
  }

  async criar(corpo: unknown, agora = new Date()): Promise<EventoResposta> {
    const dados = exigirObjeto(corpo);
    try {
      return await this.em.transactional(async (em) => {
        const evento = new Evento();
        await this.aplicar(em, evento, dados, true);
        this.agenda.exigirDataAgenda(evento.inicio, agora);
        await this.agenda.assertEventoSemAula(em, evento.inicio, evento.fim);
        em.persist(evento);
        await em.flush();
        return serializarEvento(evento);
      });
    } catch (erro) {
      const traduzido = traduzirErroBanco(erro);
      if (traduzido) throw traduzido;
      throw erro;
    }
  }

  async atualizar(id: string, corpo: unknown, agora = new Date()): Promise<EventoResposta> {
    uuidDe(id, 'Identificador');
    const dados = exigirObjeto(corpo);
    return this.em.transactional(async (em) => {
      const evento = await em.findOne(Evento, { id }, { populate: ['responsavel'] });
      if (!evento) throw naoEncontrado('Evento não encontrado.');
      const inicioAntes = evento.inicio.getTime();
      const fimAntes = evento.fim.getTime();
      await this.aplicar(em, evento, dados, false);
      if (evento.inicio.getTime() !== inicioAntes || evento.fim.getTime() !== fimAntes) {
        this.agenda.exigirDataAgenda(evento.inicio, agora);
        await this.agenda.assertEventoSemAula(em, evento.inicio, evento.fim);
      }
      await em.flush();
      return serializarEvento(evento);
    });
  }

  async apagar(id: string): Promise<{ ok: true }> {
    uuidDe(id, 'Identificador');
    return this.em.transactional(async (em) => {
      const evento = await em.findOne(Evento, { id });
      if (!evento) throw naoEncontrado('Evento não encontrado.');
      em.remove(evento);
      await em.flush();
      return { ok: true };
    });
  }

  private async aplicar(em: EntityManager, evento: Evento, dados: Record<string, unknown>, criacao: boolean): Promise<void> {
    if (criacao || veio(dados, 'tipo')) evento.tipo = tipoEventoDe(dados.tipo);
    if (criacao || veio(dados, 'nome')) evento.nome = textoObrigatorio(dados.nome, 'o nome');
    if (criacao || veio(dados, 'inicio')) evento.inicio = instanteDe(dados.inicio, 'O início');
    if (criacao || veio(dados, 'fim')) evento.fim = instanteDe(dados.fim, 'O fim');
    if (criacao || veio(dados, 'contato')) evento.contato = textoOpcional(dados.contato, 'Contato');
    if (evento.fim.getTime() <= evento.inicio.getTime()) {
      throw dadosInvalidos('O fim do evento precisa ser posterior ao início.');
    }
    if (evento.tipo === 'AUSENCIA') {
      const responsavelId = veio(dados, 'responsavelId') ? dados.responsavelId : evento.responsavel?.id;
      if (responsavelId == null || responsavelId === '') throw dadosInvalidos('Ausência precisa de um responsável.');
      evento.responsavel = await responsavelAtivo(em, uuidDe(responsavelId, 'Responsável'));
      evento.bloqueiaAulas = false;
      return;
    }
    evento.responsavel = null;
    if (evento.tipo === 'FERIADO' || evento.tipo === 'AGENDA_FECHADA') {
      if (veio(dados, 'bloqueiaAulas')) evento.bloqueiaAulas = booleanoDe(dados.bloqueiaAulas, 'Bloqueio de aulas');
      else if (criacao) evento.bloqueiaAulas = false;
    } else {
      evento.bloqueiaAulas = false;
    }
  }
}
