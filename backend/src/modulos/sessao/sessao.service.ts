import { EntityManager } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import bcrypt from 'bcrypt';
import { emitirToken, lerToken } from '../../comum/cookie';
import type { IntegranteAtual } from '../../comum/contrato';
import { ErroApi, MENSAGEM_CREDENCIAIS } from '../../comum/erros';
import { serializarSessao } from '../../comum/serializar';
import { emailObrigatorio, exigirObjeto } from '../../comum/validacao';
import { Integrante } from '../../entidades/integrante.entity';

@Injectable()
export class SessaoService {
  constructor(private readonly em: EntityManager) {}

  async entrar(corpo: unknown, agora = new Date()): Promise<{ integrante: IntegranteAtual; token: string }> {
    const dados = exigirObjeto(corpo);
    const email = emailObrigatorio(dados.email);
    const senha = typeof dados.senha === 'string' ? dados.senha : '';
    if (senha.length < 8) throw new ErroApi(401, 'CREDENCIAIS_INVALIDAS', MENSAGEM_CREDENCIAIS);
    const integrante = await this.em.findOne(Integrante, { email });
    const confere = integrante ? await bcrypt.compare(senha, integrante.senhaHash) : false;
    if (!integrante || !integrante.ativo || !confere) {
      throw new ErroApi(401, 'CREDENCIAIS_INVALIDAS', MENSAGEM_CREDENCIAIS);
    }
    return { integrante: serializarSessao(integrante), token: emitirToken(integrante.id, integrante.versaoSessao, agora) };
  }

  async autenticar(token: string | undefined, agora = new Date()): Promise<IntegranteAtual | null> {
    if (!token) return null;
    const payload = lerToken(token, agora);
    if (!payload) return null;
    const integrante = await this.em.findOne(Integrante, { id: payload.id });
    if (!integrante || !integrante.ativo || integrante.versaoSessao !== payload.v) return null;
    return serializarSessao(integrante);
  }

  emitir(integrante: Integrante, agora = new Date()): string {
    return emitirToken(integrante.id, integrante.versaoSessao, agora);
  }
}
