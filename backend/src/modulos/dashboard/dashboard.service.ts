import { EntityManager } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import type { AulaResposta, AvisoResposta, EventoResposta } from '../../comum/contrato';
import { serializarAviso, serializarEvento } from '../../comum/serializar';
import { responderAulas } from '../../dominio/reposicao';
import { adicionarDias, inicioDaSemana, inicioDoDia } from '../../comum/tempo';
import { garantirAvisoAniversariantes } from '../../dominio/aniversariantes';
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
    proximoHorario: AulaResposta[];
    eventosDaSemana: EventoResposta[];
    avisos: AvisoResposta[];
  }> {
    const inicioHoje = inicioDoDia(agora);
    const fimHoje = adicionarDias(inicioHoje, 1);
    const aulasHoje = await this.em.find(Aula, {
      grupo: { inicio: { $gte: inicioHoje, $lt: fimHoje } },
      status: { $ne: 'CANCELADA' },
    }, { populate: ['aluno', 'grupo'] });
    const candidatas = await this.em.find(Aula, {
      status: { $ne: 'CANCELADA' },
      grupo: { fim: { $gt: agora } },
    }, {
      populate: ['aluno', 'grupo', 'grupo.responsavel', 'reposicaoDe'],
      orderBy: { grupo: { inicio: 'asc' } },
    });
    const inicioProximo = candidatas[0]?.grupo.inicio.getTime();
    const doHorario = candidatas.filter((aula) => aula.grupo.inicio.getTime() === inicioProximo);
    doHorario.sort((a, b) => {
      const responsavel = a.grupo.responsavel.nome.localeCompare(b.grupo.responsavel.nome, 'pt-BR');
      if (responsavel !== 0) return responsavel;
      return a.aluno.nome.localeCompare(b.aluno.nome, 'pt-BR');
    });
    const segunda = inicioDaSemana(agora);
    const proximaSegunda = adicionarDias(segunda, 7);
    const eventos = await this.em.find(Evento, {
      inicio: { $lt: proximaSegunda },
      fim: { $gt: segunda },
    }, { populate: ['responsavel'], orderBy: { inicio: 'asc' } });
    await garantirAvisoAniversariantes(this.em, agora);
    const avisos = await this.em.find(Aviso, {}, { orderBy: { criadoEm: 'desc', id: 'desc' } });
    return {
      aulasHoje: aulasHoje.length,
      confirmadas: aulasHoje.filter((aula) => aula.status === 'CONFIRMADA').length,
      alunosCadastrados: await this.em.count(Aluno, { ativo: true, temporario: false }),
      alunosDoDia: new Set(aulasHoje.map((aula) => aula.aluno.id)).size,
      proximoHorario: await responderAulas(this.em, doHorario),
      eventosDaSemana: eventos.map(serializarEvento),
      avisos: avisos.map(serializarAviso),
    };
  }
}
