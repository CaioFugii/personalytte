import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { GuardAdministrador } from '../../comum/guard-administrador';
import { IntegrantesService } from './integrantes.service';

@Controller('integrantes')
export class IntegrantesController {
  constructor(private readonly integrantes: IntegrantesService) {}

  @Get('responsaveis')
  responsaveis() {
    return this.integrantes.listarResponsaveis();
  }

  @Get()
  @UseGuards(GuardAdministrador)
  listar(@Query('busca') busca?: string) {
    return this.integrantes.listar(typeof busca === 'string' ? busca : undefined);
  }

  @Post()
  @HttpCode(201)
  @UseGuards(GuardAdministrador)
  criar(@Body() corpo: unknown) {
    return this.integrantes.criar(corpo);
  }

  @Patch(':id')
  @UseGuards(GuardAdministrador)
  atualizar(@Param('id') id: string, @Body() corpo: unknown) {
    return this.integrantes.atualizar(id, corpo);
  }

  @Post(':id/inativar')
  @HttpCode(200)
  @UseGuards(GuardAdministrador)
  inativar(@Param('id') id: string) {
    return this.integrantes.inativar(id);
  }
}
