import { EntityManager, UniqueConstraintViolationException } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { ErroApi } from '../../comum/erros';
import { adicionarDias, dataCalendario, dataSP, formatarInstante } from '../../comum/tempo';
import { Aluno } from '../../entidades/aluno.entity';
import { Checkin } from '../../entidades/checkin.entity';
import { assinaturaConfere, gympassConfigurado, tokenConfere, totalpassConfigurado } from './assinatura';
import { lerGympass, lerTotalpass, type EntradaCheckin } from './leitura';

export type CheckinResposta = {
  id: string;
  provedor: 'GYMPASS' | 'TOTALPASS';
  nome: string;
  email: string | null;
  telefone: string | null;
  iniciadoEm: string;
  alunoId: string | null;
};

export type ListaCheckins = {
  itens: CheckinResposta[];
  gympass: boolean;
  totalpass: boolean;
};

function diaValido(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  return dataSP(dataCalendario(valor)) === valor;
}

@Injectable()
export class CheckinsService {
  constructor(private readonly em: EntityManager) {}

  async listar(data: string | undefined, agora = new Date()): Promise<ListaCheckins> {
    const dia = data && data.length > 0 ? data : dataSP(agora);
    if (!diaValido(dia)) throw new ErroApi(400, 'DADOS_INVALIDOS', 'Informe a data.');
    const inicio = dataCalendario(dia);
    const fim = adicionarDias(inicio, 1);
    const linhas = await this.em.find(
      Checkin,
      { iniciadoEm: { $gte: inicio, $lt: fim } },
      { populate: ['aluno'], orderBy: { iniciadoEm: 'desc', id: 'desc' } },
    );
    return {
      itens: linhas.map((linha) => ({
        id: linha.id,
        provedor: linha.provedor,
        nome: linha.nome,
        email: linha.email,
        telefone: linha.telefone,
        iniciadoEm: formatarInstante(linha.iniciadoEm),
        alunoId: linha.aluno?.id ?? null,
      })),
      gympass: gympassConfigurado(),
      totalpass: totalpassConfigurado(),
    };
  }

  async receberGympass(corpo: Buffer, assinatura: string | undefined): Promise<{ recebido: boolean }> {
    if (!gympassConfigurado()) throw new ErroApi(401, 'CREDENCIAIS_INVALIDAS', 'Gympass não configurado.');
    if (!assinaturaConfere(assinatura, corpo, process.env.GYMPASS_WEBHOOK_SECRET ?? '')) {
      throw new ErroApi(401, 'CREDENCIAIS_INVALIDAS', 'Assinatura inválida.');
    }
    let json: unknown;
    try {
      json = JSON.parse(corpo.toString('utf8')) as unknown;
    } catch {
      throw new ErroApi(400, 'DADOS_INVALIDOS', 'JSON inválido.');
    }
    const leitura = lerGympass(json);
    if (!leitura) throw new ErroApi(400, 'DADOS_INVALIDOS', 'Check-in do Gympass incompleto.');
    if (leitura.ignorar) return { recebido: false };
    await this.gravar(leitura.entrada);
    return { recebido: true };
  }

  async receberTotalpass(corpo: unknown, token: string | undefined): Promise<{ recebido: boolean }> {
    if (!totalpassConfigurado()) throw new ErroApi(401, 'CREDENCIAIS_INVALIDAS', 'TotalPass não configurado.');
    if (!tokenConfere(token, process.env.TOTALPASS_WEBHOOK_TOKEN ?? '')) {
      throw new ErroApi(401, 'CREDENCIAIS_INVALIDAS', 'Token inválido.');
    }
    const leitura = lerTotalpass(corpo);
    if (!leitura) throw new ErroApi(400, 'DADOS_INVALIDOS', 'Check-in da TotalPass incompleto.');
    if (leitura.ignorar) return { recebido: false };
    await this.gravar(leitura.entrada);
    return { recebido: true };
  }

  private async gravar(entrada: EntradaCheckin): Promise<void> {
    const existente = await this.em.findOne(Checkin, { provedor: entrada.provedor, referencia: entrada.referencia });
    if (existente) return;
    const checkin = new Checkin();
    checkin.provedor = entrada.provedor;
    checkin.referencia = entrada.referencia;
    checkin.nome = entrada.nome;
    checkin.email = entrada.email;
    checkin.telefone = entrada.telefone;
    checkin.iniciadoEm = entrada.iniciadoEm;
    checkin.recebidoEm = new Date();
    checkin.aluno = await this.alunoUnico(entrada.email, entrada.telefone);
    try {
      await this.em.persist(checkin).flush();
    } catch (erro) {
      if (!(erro instanceof UniqueConstraintViolationException)) throw erro;
      this.em.clear();
    }
  }

  private async alunoUnico(email: string | null, telefone: string | null): Promise<Aluno | null> {
    const filtros = [];
    if (email) filtros.push({ email: { $ilike: email } });
    const digitos = (telefone ?? '').replace(/\D/g, '');
    if (digitos.length >= 10 && digitos.length <= 11) filtros.push({ telefone: digitos });
    if (filtros.length === 0) return null;
    const alunos = await this.em.find(Aluno, { ativo: true, temporario: false, $or: filtros });
    const ids = new Set(alunos.map((aluno) => aluno.id));
    if (ids.size !== 1) return null;
    return alunos[0] ?? null;
  }
}

export function corpoCru(requisicao: Request): Buffer {
  const cru = (requisicao as Request & { rawBody?: Buffer }).rawBody;
  if (cru && cru.length > 0) return cru;
  return Buffer.from(JSON.stringify(requisicao.body ?? {}));
}
