import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { GuardAdministrador } from '../../comum/guard-administrador';
import { AvisosService } from './avisos.service';

@Controller('avisos')
export class AvisosController {
  constructor(private readonly avisos: AvisosService) {}

  @Get()
  listar() {
    return this.avisos.listar();
  }

  @Post()
  @HttpCode(201)
  @UseGuards(GuardAdministrador)
  criar(@Body() corpo: unknown) {
    return this.avisos.criar(corpo);
  }

  @Patch(':id')
  @UseGuards(GuardAdministrador)
  atualizar(@Param('id') id: string, @Body() corpo: unknown) {
    return this.avisos.atualizar(id, corpo);
  }

  @Delete(':id')
  @UseGuards(GuardAdministrador)
  apagar(@Param('id') id: string) {
    return this.avisos.apagar(id);
  }
}
