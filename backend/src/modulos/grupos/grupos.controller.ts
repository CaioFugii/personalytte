import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { GruposService } from './grupos.service';

@Controller('grupos')
export class GruposController {
  constructor(private readonly grupos: GruposService) {}

  @Get('semana')
  listarFixos() {
    return this.grupos.listarFixos();
  }

  @Post('semana')
  criarFixo(@Body() corpo: unknown) {
    return this.grupos.criarFixo(corpo);
  }

  @Post('semana/alunos')
  adicionarFixo(@Body() corpo: unknown) {
    return this.grupos.adicionarFixo(corpo);
  }

  @Delete('semana/alunos')
  removerFixo(@Body() corpo: unknown) {
    return this.grupos.removerFixo(corpo);
  }

  @Patch('semana')
  trocarProfessorFixo(@Body() corpo: unknown) {
    return this.grupos.trocarProfessorFixo(corpo);
  }

  @Get()
  listar(@Query('de') de?: string, @Query('ate') ate?: string) {
    return this.grupos.listar(de, ate);
  }

  @Get(':id')
  obter(@Param('id') id: string) {
    return this.grupos.obter(id);
  }

  @Post()
  @HttpCode(201)
  criar(@Body() corpo: unknown) {
    return this.grupos.criar(corpo);
  }

  @Patch(':id')
  atualizar(@Param('id') id: string, @Body() corpo: unknown) {
    return this.grupos.atualizar(id, corpo);
  }
}
