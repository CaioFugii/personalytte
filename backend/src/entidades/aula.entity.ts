import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core';
import { randomUUID } from 'crypto';
import type { StatusAula } from './enums';
import { Aluno } from './aluno.entity';
import { Integrante } from './integrante.entity';

@Entity({ tableName: 'aulas' })
export class Aula {
  @PrimaryKey({ type: 'uuid' })
  id: string = randomUUID();

  @ManyToOne(() => Aluno)
  aluno!: Aluno;

  @ManyToOne(() => Integrante)
  responsavel!: Integrante;

  @Property({ type: 'timestamptz' })
  inicio!: Date;

  @Property({ type: 'timestamptz' })
  fim!: Date;

  @Property({ type: 'text' })
  status: StatusAula = 'AGUARDANDO';

  @Property({ type: 'boolean' })
  experimental = false;

  @ManyToOne(() => Aula, { nullable: true, deleteRule: 'set null' })
  reposicaoDe: Aula | null = null;

  @Property({ type: 'boolean' })
  ligadaAoPlano = false;
}
