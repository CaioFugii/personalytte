import { Collection, Entity, ManyToOne, OneToMany, PrimaryKey, Property } from '@mikro-orm/core';
import { randomUUID } from 'crypto';
import { Aula } from './aula.entity';
import { Integrante } from './integrante.entity';

@Entity({ tableName: 'grupos' })
export class Grupo {
  @PrimaryKey({ type: 'uuid' })
  id: string = randomUUID();

  @ManyToOne(() => Integrante)
  responsavel!: Integrante;

  @Property({ type: 'timestamptz' })
  inicio!: Date;

  @Property({ type: 'timestamptz' })
  fim!: Date;

  @Property({ type: 'int' })
  capacidade = 4;

  @OneToMany(() => Aula, (aula) => aula.grupo, { cascade: [] })
  aulas = new Collection<Aula>(this);
}
