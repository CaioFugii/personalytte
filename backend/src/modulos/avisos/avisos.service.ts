import { EntityManager } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import type { AvisoResposta } from '../../comum/contrato';
import { naoEncontrado } from '../../comum/erros';
import { serializarAviso } from '../../comum/serializar';
import { exigirObjeto, textoObrigatorio, uuidDe, veio } from '../../comum/validacao';
import { Aviso } from '../../entidades/aviso.entity';

@Injectable()
export class AvisosService {
  constructor(private readonly em: EntityManager) {}

  async listar(): Promise<AvisoResposta[]> {
    const avisos = await this.em.find(Aviso, {}, { orderBy: { criadoEm: 'desc', id: 'desc' } });
    return avisos.map(serializarAviso);
  }

  async criar(corpo: unknown): Promise<AvisoResposta> {
    const dados = exigirObjeto(corpo);
    const aviso = new Aviso();
    aviso.titulo = textoObrigatorio(dados.titulo, 'o título');
    aviso.mensagem = textoObrigatorio(dados.mensagem, 'a mensagem');
    aviso.criadoEm = new Date();
    aviso.atualizadoEm = aviso.criadoEm;
    this.em.persist(aviso);
    await this.em.flush();
    return serializarAviso(aviso);
  }

  async atualizar(id: string, corpo: unknown): Promise<AvisoResposta> {
    uuidDe(id, 'Identificador');
    const dados = exigirObjeto(corpo);
    const aviso = await this.em.findOne(Aviso, { id });
    if (!aviso) throw naoEncontrado('Aviso não encontrado.');
    if (veio(dados, 'titulo')) aviso.titulo = textoObrigatorio(dados.titulo, 'o título');
    if (veio(dados, 'mensagem')) aviso.mensagem = textoObrigatorio(dados.mensagem, 'a mensagem');
    aviso.atualizadoEm = new Date();
    await this.em.flush();
    return serializarAviso(aviso);
  }

  async apagar(id: string): Promise<{ ok: true }> {
    uuidDe(id, 'Identificador');
    const aviso = await this.em.findOne(Aviso, { id });
    if (!aviso) throw naoEncontrado('Aviso não encontrado.');
    this.em.remove(aviso);
    await this.em.flush();
    return { ok: true };
  }
}
