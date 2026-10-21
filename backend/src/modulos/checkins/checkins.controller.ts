import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Publico } from '../../comum/publico';
import { CheckinsService, corpoCru } from './checkins.service';

@Controller()
export class CheckinsController {
  constructor(private readonly checkins: CheckinsService) {}

  @Publico()
  @Post('webhooks/gympass')
  gympass(@Req() requisicao: Request) {
    const assinatura = requisicao.header('x-gympass-signature');
    return this.checkins.receberGympass(corpoCru(requisicao), assinatura);
  }

  @Publico()
  @Post('webhooks/totalpass')
  totalpass(@Body() corpo: unknown, @Query('token') token?: string) {
    return this.checkins.receberTotalpass(corpo, token);
  }

  @Get('checkins')
  listar(@Query('data') data?: string) {
    return this.checkins.listar(typeof data === 'string' ? data : undefined);
  }
}
