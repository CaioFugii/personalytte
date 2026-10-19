import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { InicializacaoService } from './bootstrap/inicializacao.service';
import { GuardAdministrador } from './comum/guard-administrador';
import { GuardSessao } from './comum/guard-sessao';
import { AgendaService } from './dominio/agenda.service';
import { criarOrmConfig } from './orm.config';
import { AlunosController } from './modulos/alunos/alunos.controller';
import { AlunosService } from './modulos/alunos/alunos.service';
import { AulasController } from './modulos/aulas/aulas.controller';
import { AulasService } from './modulos/aulas/aulas.service';
import { AvisosController } from './modulos/avisos/avisos.controller';
import { AvisosService } from './modulos/avisos/avisos.service';
import { DashboardController } from './modulos/dashboard/dashboard.controller';
import { DashboardService } from './modulos/dashboard/dashboard.service';
import { EventosController } from './modulos/eventos/eventos.controller';
import { EventosService } from './modulos/eventos/eventos.service';
import { IntegrantesController } from './modulos/integrantes/integrantes.controller';
import { IntegrantesService } from './modulos/integrantes/integrantes.service';
import { SessaoController } from './modulos/sessao/sessao.controller';
import { SessaoService } from './modulos/sessao/sessao.service';

@Module({
  imports: [MikroOrmModule.forRoot(criarOrmConfig())],
  controllers: [
    SessaoController,
    IntegrantesController,
    AlunosController,
    AulasController,
    EventosController,
    AvisosController,
    DashboardController,
  ],
  providers: [
    AgendaService,
    SessaoService,
    IntegrantesService,
    AlunosService,
    AulasService,
    EventosService,
    AvisosService,
    DashboardService,
    InicializacaoService,
    GuardAdministrador,
    { provide: APP_GUARD, useClass: GuardSessao },
  ],
})
export class AppModule {}
