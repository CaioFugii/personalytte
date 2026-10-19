import { EntityManager } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import type { AulaResposta, AvisoResposta, EventoResposta } from '../../comum/contrato';
import { serializarAula, serializarAviso, serializarEvento } from '../../comum/serializar';
import { adicionarDias, inicioDaSemana, inicioDoDia } from '../../comum/tempo';
import { Aluno } from '../../entidades/aluno.entity';
import { Aula } from '../../entidades/aula.entity';
import { Aviso } from '../../entidades/aviso.entity';
import { Evento } from '../../entidades/evento.entity';

@Injectable()
export class DashboardService {
  constructor(private readonly em: EntityManager) {}

  async obter(agora = new Date()): Promise<{
    aulasHoje: number;
    confirmadas: number;
    alunosCadastrados: number;
    alunosDoDia: number;
    proximoHorario: AulaResposta | null;
    eventosDaSemana: EventoResposta[];
    avisos: AvisoResposta[];
  }> {
    const inicioHoje = inicioDoDia(agora);
    const fimHoje = adicionarDias(inicioHoje, 1);
    const aulasHoje = await this.em.find(Aula, {
      inicio: { $gte: inicioHoje, $lt: fimHoje },
      status: { $ne: 'CANCELADA' },
    }, { populate: ['aluno'] });
    const proxima = await this.em.findOne(Aula, {
      status: { $ne: 'CANCELADA' },
      fim: { $gt: agora },
    }, { populate: ['aluno', 'responsavel', 'reposicaoDe'], orderBy: { inicio: 'asc' } });
    const segunda = inicioDaSemana(agora);
    const proximaSegunda = adicionarDias(segunda, 7);
    const eventos = await this.em.find(Evento, {
      inicio: { $lt: proximaSegunda },
      fim: { $gt: segunda },
    }, { populate: ['responsavel'], orderBy: { inicio: 'asc' } });
    const avisos = await this.em.find(Aviso, {}, { orderBy: { criadoEm: 'desc', id: 'desc' } });
    return {
      aulasHoje: aulasHoje.length,
      confirmadas: aulasHoje.filter((aula) => aula.status === 'CONFIRMADA').length,
      alunosCadastrados: await this.em.count(Aluno, { ativo: true }),
      alunosDoDia: new Set(aulasHoje.map((aula) => aula.aluno.id)).size,
      proximoHorario: proxima ? serializarAula(proxima) : null,
      eventosDaSemana: eventos.map(serializarEvento),
      avisos: avisos.map(serializarAviso),
    };
  }
}
