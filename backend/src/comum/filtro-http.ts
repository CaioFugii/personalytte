import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { ErroApi, traduzirErroBanco } from './erros';

@Catch()
export class FiltroHttp implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const resposta = host.switchToHttp().getResponse<Response>();
    if (exception instanceof ErroApi) {
      resposta.status(exception.status).json({ codigo: exception.codigo, mensagem: exception.mensagem });
      return;
    }
    const traduzido = traduzirErroBanco(exception);
    if (traduzido) {
      resposta.status(traduzido.status).json({ codigo: traduzido.codigo, mensagem: traduzido.mensagem });
      return;
    }
    const status = (exception as { status?: number; getStatus?: () => number }).getStatus?.()
      ?? (exception as { status?: number }).status;
    if (status === 400) {
      resposta.status(400).json({ codigo: 'DADOS_INVALIDOS', mensagem: 'JSON inválido.' });
      return;
    }
    console.error(exception);
    resposta.status(500).json({ codigo: 'ERRO_INTERNO', mensagem: 'Erro interno.' });
  }
}
