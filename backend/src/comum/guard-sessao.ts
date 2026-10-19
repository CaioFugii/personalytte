import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MikroORM } from '@mikro-orm/core';
import type { Request } from 'express';
import { lerCookie } from './cookie';
import { ErroApi, MENSAGEM_SESSAO } from './erros';
import { CHAVE_PUBLICO } from './publico';
import { SessaoService } from '../modulos/sessao/sessao.service';

@Injectable()
export class GuardSessao implements CanActivate {
  constructor(
    private readonly orm: MikroORM,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const publico = this.reflector.getAllAndOverride<boolean>(CHAVE_PUBLICO, [
      contexto.getHandler(),
      contexto.getClass(),
    ]);
    if (publico) return true;
    const requisicao = contexto.switchToHttp().getRequest<Request>();
    const sessao = new SessaoService(this.orm.em.fork());
    const atual = await sessao.autenticar(lerCookie(requisicao.headers.cookie));
    if (!atual) throw new ErroApi(401, 'CREDENCIAIS_INVALIDAS', MENSAGEM_SESSAO);
    requisicao.integrante = atual;
    return true;
  }
}
