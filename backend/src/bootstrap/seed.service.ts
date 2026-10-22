import { MikroORM } from '@mikro-orm/core';
import { formatarInstante, adicionarDias, combinarDataHorario, diaDaSemana, inicioDoDia, type DiaSemana } from '../comum/tempo';
import { AgendaService } from '../dominio/agenda.service';
import { Aula } from '../entidades/aula.entity';
import { Aviso } from '../entidades/aviso.entity';
import { AlunosService } from '../modulos/alunos/alunos.service';
import { AulasService } from '../modulos/aulas/aulas.service';
import { AvisosService } from '../modulos/avisos/avisos.service';
import { EventosService } from '../modulos/eventos/eventos.service';
import { IntegrantesService } from '../modulos/integrantes/integrantes.service';
import { Integrante } from '../entidades/integrante.entity';

const EMAIL_PROFESSOR = 'marina@personalytte.local';

export class SeedService {
  async executar(orm: MikroORM): Promise<void> {
    if (process.env.NODE_ENV !== 'development') return;
    const em = orm.em.fork();
    if (await em.findOne(Integrante, { email: EMAIL_PROFESSOR })) return;

    const agenda = new AgendaService();
    const integrantes = new IntegrantesService(em);
    const alunos = new AlunosService(em, agenda);
    const aulas = new AulasService(em, agenda);
    const eventos = new EventosService(em, agenda);
    const avisos = new AvisosService(em);
    const agora = new Date();

    const professora = await integrantes.criar({
      nome: 'Marina Costa',
      email: EMAIL_PROFESSOR,
      senha: 'professor1',
      funcao: 'PROFESSOR',
      telefone: '11988887777',
      dataNascimento: '1990-05-12',
    });
    const admin = await em.findOneOrFail(Integrante, { funcao: 'SOCIO', ativo: true });

    const ana = await alunos.criar({
      nome: 'Ana Lima',
      telefone: '(11) 91111-0001',
      email: 'ana.lima@email.com',
      plano: 'PARTICULAR',
      categoria: 'D',
      horarios: [
        { dia: 'ter', horarioInicio: '19:00' },
        { dia: 'qui', horarioInicio: '19:00' },
      ],
      responsavelId: professora.id,
    }, agora);
    await alunos.criar({
      nome: 'Bruno Souza',
      telefone: '11911110002',
      email: null,
      plano: 'GYMPASS',
      categoria: 'C',
      horarios: [],
      responsavelId: null,
    }, agora);
    await alunos.criar({
      nome: 'Carla Mendes',
      telefone: '11911110003',
      email: 'carla.mendes@email.com',
      plano: 'MENSAL',
      categoria: 'B',
      horarios: [
        { dia: 'seg', horarioInicio: '07:00' },
        { dia: 'qua', horarioInicio: '07:00' },
        { dia: 'sex', horarioInicio: '07:00' },
      ],
      responsavelId: admin.id,
    }, agora);
    await alunos.criar({
      nome: 'Diego Alves',
      telefone: '11911110004',
      plano: 'PARTICULAR',
      categoria: 'A',
      horarios: [{ dia: 'sab', horarioInicio: '09:00' }],
      responsavelId: professora.id,
    }, agora);
    const elena = await alunos.criar({
      nome: 'Elena Prado',
      telefone: '11911110005',
      plano: 'GYMPASS',
      categoria: 'D',
    }, agora);

    const leitura = orm.em.fork();
    const daAna = await leitura.find(Aula, { aluno: ana.id, ligadaAoPlano: true }, { orderBy: { inicio: 'asc' } });
    if (daAna[0]) {
      await aulas.atualizar(daAna[0].id, { status: 'CONFIRMADA' }, agora);
    }
    if (daAna[1]) {
      const reposicao = proximoDia(agora, 'seg', '11:00');
      await aulas.atualizar(daAna[1].id, {
        status: 'FALTA',
        reposicao: { responsavelId: professora.id, inicio: formatarInstante(reposicao) },
      }, agora);
    }

    const amanhaMeioDia = combinarDataHorario(adicionarDias(inicioDoDia(agora), 1), '12:00');
    await aulas.criar({
      alunoId: elena.id,
      responsavelId: professora.id,
      inicio: formatarInstante(amanhaMeioDia),
      experimental: true,
    });

    const aniversario = proximoDia(agora, 'sab', '15:00');
    await eventos.criar({
      tipo: 'ANIVERSARIO',
      nome: 'Aniversário da Ana',
      inicio: formatarInstante(aniversario),
      fim: formatarInstante(new Date(aniversario.getTime() + 2 * 60 * 60 * 1000)),
      contato: '11911110001',
      bloqueiaAulas: false,
      responsavelId: null,
    }, agora);

    const torneio = adicionarDias(proximoDia(agora, 'sab', '11:00'), 21);
    await eventos.criar({
      tipo: 'TORNEIO',
      nome: 'Torneio interno',
      inicio: formatarInstante(torneio),
      fim: formatarInstante(new Date(torneio.getTime() + 3 * 60 * 60 * 1000)),
      contato: null,
      bloqueiaAulas: false,
      responsavelId: null,
    }, agora);

    const domingo = proximoDia(agora, 'dom', '00:00');
    const depoisDoDomingo = adicionarDias(domingo, 1);
    await eventos.criar({
      tipo: 'AUSENCIA',
      nome: 'Ausência da Marina',
      inicio: formatarInstante(domingo),
      fim: formatarInstante(depoisDoDomingo),
      contato: null,
      bloqueiaAulas: false,
      responsavelId: professora.id,
    }, agora);

    const fechada = combinarDataHorario(depoisDoDomingo, '22:00');
    await eventos.criar({
      tipo: 'AGENDA_FECHADA',
      nome: 'Manutenção da quadra',
      inicio: formatarInstante(fechada),
      fim: formatarInstante(new Date(fechada.getTime() + 60 * 60 * 1000)),
      contato: null,
      bloqueiaAulas: true,
      responsavelId: null,
    }, agora);

    const feriado = adicionarDias(inicioDoDia(agora), 70);
    await eventos.criar({
      tipo: 'FERIADO',
      nome: 'Feriado',
      inicio: formatarInstante(feriado),
      fim: formatarInstante(adicionarDias(feriado, 1)),
      contato: null,
      bloqueiaAulas: true,
      responsavelId: null,
    }, agora);

    const primeiro = await avisos.criar({
      titulo: 'Boas-vindas',
      mensagem: 'Bem-vindos ao painel da Personalytte. A agenda mostra as aulas e os eventos da escola.',
    });
    const emAviso = orm.em.fork();
    const gravado = await emAviso.findOneOrFail(Aviso, { id: primeiro.id });
    gravado.criadoEm = new Date(agora.getTime() - 60_000);
    gravado.atualizadoEm = gravado.criadoEm;
    await emAviso.flush();
    await new AvisosService(orm.em.fork()).criar({
      titulo: 'Quadra molhada',
      mensagem: 'Se a quadra estiver molhada, confirme o horário com o responsável antes da aula.',
    });

    console.log('Seed de desenvolvimento pronto.');
    console.log(`Professor: ${EMAIL_PROFESSOR} / professor1`);
    console.log('Administrador: variáveis BOOTSTRAP_ADMIN_EMAIL e BOOTSTRAP_ADMIN_PASSWORD');
  }
}

function proximoDia(agora: Date, dia: DiaSemana, horario: string): Date {
  let cursor = inicioDoDia(agora);
  for (let i = 0; i < 14; i += 1) {
    const inicio = combinarDataHorario(cursor, horario);
    if (diaDaSemana(cursor) === dia && inicio.getTime() > agora.getTime()) return inicio;
    cursor = adicionarDias(cursor, 1);
  }
  return combinarDataHorario(adicionarDias(inicioDoDia(agora), 7), horario);
}
