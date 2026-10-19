import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { GuardAdministrador } from '../../comum/guard-administrador';
import { AlunosService } from './alunos.service';

@Controller('alunos')
export class AlunosController {
  constructor(private readonly alunos: AlunosService) {}

  @Get()
  listar(@Query('busca') busca?: string) {
    return this.alunos.listar(typeof busca === 'string' ? busca : undefined);
  }

  @Get(':id')
  obter(@Param('id') id: string) {
    return this.alunos.obter(id);
  }

  @Post()
  @HttpCode(201)
  @UseGuards(GuardAdministrador)
  criar(@Body() corpo: unknown) {
    return this.alunos.criar(corpo);
  }

  @Patch(':id')
  @UseGuards(GuardAdministrador)
  atualizar(@Param('id') id: string, @Body() corpo: unknown) {
    return this.alunos.atualizar(id, corpo);
  }

  @Post(':id/inativar')
  @HttpCode(200)
  @UseGuards(GuardAdministrador)
  inativar(@Param('id') id: string) {
    return this.alunos.inativar(id);
  }
}
