import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { ErroApi, MENSAGEM_SEM_PERMISSAO } from './erros';

@Injectable()
export class GuardAdministrador implements CanActivate {
  canActivate(contexto: ExecutionContext): boolean {
    const requisicao = contexto.switchToHttp().getRequest<Request>();
    if (requisicao.integrante?.papel !== 'administrador') {
      throw new ErroApi(403, 'SEM_PERMISSAO', MENSAGEM_SEM_PERMISSAO);
    }
    return true;
  }
}
