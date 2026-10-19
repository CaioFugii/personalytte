import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { AulasService } from './aulas.service';

@Controller('aulas')
export class AulasController {
  constructor(private readonly aulas: AulasService) {}

  @Get()
  listar(@Query('de') de?: string, @Query('ate') ate?: string) {
    return this.aulas.listar(de, ate);
  }

  @Get(':id')
  obter(@Param('id') id: string) {
    return this.aulas.obter(id);
  }

  @Post()
  @HttpCode(201)
  criar(@Body() corpo: unknown) {
    return this.aulas.criar(corpo);
  }

  @Patch(':id')
  atualizar(@Param('id') id: string, @Body() corpo: unknown) {
    return this.aulas.atualizar(id, corpo);
  }

  @Post(':id/cancelar')
  @HttpCode(200)
  cancelar(@Param('id') id: string) {
    return this.aulas.cancelar(id);
  }
}
