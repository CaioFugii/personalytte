import { Entity, PrimaryKey, Property } from '@mikro-orm/core';
import { randomUUID } from 'crypto';

@Entity({ tableName: 'avisos' })
export class Aviso {
  @PrimaryKey({ type: 'uuid' })
  id: string = randomUUID();

  @Property({ type: 'text' })
  titulo!: string;

  @Property({ type: 'text' })
  mensagem!: string;

  @Property({ type: 'timestamptz' })
  criadoEm: Date = new Date();

  @Property({ type: 'timestamptz' })
  atualizadoEm: Date = new Date();
}
