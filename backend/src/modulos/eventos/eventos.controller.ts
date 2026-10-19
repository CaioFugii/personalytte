import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { GuardAdministrador } from '../../comum/guard-administrador';
import { EventosService } from './eventos.service';

@Controller('eventos')
export class EventosController {
  constructor(private readonly eventos: EventosService) {}

  @Get()
  listar(@Query('de') de?: string, @Query('ate') ate?: string) {
    return this.eventos.listar(de, ate);
  }

  @Post()
  @HttpCode(201)
  @UseGuards(GuardAdministrador)
  criar(@Body() corpo: unknown) {
    return this.eventos.criar(corpo);
  }

  @Patch(':id')
  @UseGuards(GuardAdministrador)
  atualizar(@Param('id') id: string, @Body() corpo: unknown) {
    return this.eventos.atualizar(id, corpo);
  }

  @Delete(':id')
  @UseGuards(GuardAdministrador)
  apagar(@Param('id') id: string) {
    return this.eventos.apagar(id);
  }
}
