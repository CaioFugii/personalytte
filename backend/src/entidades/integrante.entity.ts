import { Entity, PrimaryKey, Property } from '@mikro-orm/core';
import { randomUUID } from 'crypto';
import type { FuncaoIntegrante } from './enums';

@Entity({ tableName: 'integrantes' })
export class Integrante {
  @PrimaryKey({ type: 'uuid' })
  id: string = randomUUID();

  @Property({ type: 'text' })
  nome!: string;

  @Property({ type: 'text', unique: true })
  email!: string;

  @Property({ type: 'text' })
  senhaHash!: string;

  @Property({ type: 'text' })
  funcao!: FuncaoIntegrante;

  @Property({ type: 'text', nullable: true })
  telefone: string | null = null;

  @Property({ type: 'date', nullable: true })
  dataNascimento: string | null = null;

  @Property({ type: 'boolean' })
  ativo = true;

  @Property({ type: 'int' })
  versaoSessao = 1;

  @Property({ type: 'timestamptz' })
  cadastradoEm: Date = new Date();
}
