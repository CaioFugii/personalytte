import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core';
import { randomUUID } from 'crypto';
import type { TipoEvento } from './enums';
import { Integrante } from './integrante.entity';

@Entity({ tableName: 'eventos' })
export class Evento {
  @PrimaryKey({ type: 'uuid' })
  id: string = randomUUID();

  @Property({ type: 'text' })
  tipo!: TipoEvento;

  @Property({ type: 'text' })
  nome!: string;

  @Property({ type: 'timestamptz' })
  inicio!: Date;

  @Property({ type: 'timestamptz' })
  fim!: Date;

  @Property({ type: 'text', nullable: true })
  contato: string | null = null;

  @Property({ type: 'boolean' })
  bloqueiaAulas = false;

  @ManyToOne(() => Integrante, { nullable: true })
  responsavel: Integrante | null = null;
}
