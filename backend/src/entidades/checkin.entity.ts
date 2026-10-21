import { Entity, ManyToOne, PrimaryKey, Property, Unique } from '@mikro-orm/core';
import { randomUUID } from 'crypto';
import type { ProvedorCheckin } from './enums';
import { Aluno } from './aluno.entity';

@Entity({ tableName: 'checkins' })
@Unique({ properties: ['provedor', 'referencia'] })
export class Checkin {
  @PrimaryKey({ type: 'uuid' })
  id: string = randomUUID();

  @Property({ type: 'text' })
  provedor!: ProvedorCheckin;

  @Property({ type: 'text' })
  referencia!: string;

  @Property({ type: 'text' })
  nome!: string;

  @Property({ type: 'text', nullable: true })
  email: string | null = null;

  @Property({ type: 'text', nullable: true })
  telefone: string | null = null;

  @Property({ type: 'timestamptz' })
  iniciadoEm!: Date;

  @Property({ type: 'timestamptz' })
  recebidoEm: Date = new Date();

  @ManyToOne(() => Aluno, { nullable: true, deleteRule: 'set null' })
  aluno: Aluno | null = null;
}
