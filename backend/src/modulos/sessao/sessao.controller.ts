import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { definirSessao, limparSessao } from '../../comum/cookie';
import { ErroApi, MENSAGEM_SESSAO } from '../../comum/erros';
import { Publico } from '../../comum/publico';
import { SessaoService } from './sessao.service';

@Controller('sessao')
export class SessaoController {
  constructor(private readonly sessao: SessaoService) {}

  @Publico()
  @Post()
  @HttpCode(200)
  async entrar(@Body() corpo: unknown, @Res({ passthrough: true }) resposta: Response) {
    const resultado = await this.sessao.entrar(corpo);
    definirSessao(resposta, resultado.token);
    return resultado.integrante;
  }

  @Publico()
  @Post('encerrar')
  @HttpCode(200)
  encerrar(@Res({ passthrough: true }) resposta: Response) {
    limparSessao(resposta);
    return { ok: true };
  }

  @Get('atual')
  atual(@Req() requisicao: Request) {
    if (!requisicao.integrante) throw new ErroApi(401, 'CREDENCIAIS_INVALIDAS', MENSAGEM_SESSAO);
    return requisicao.integrante;
  }
}
