import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core';
import { randomUUID } from 'crypto';
import type { DiaSemana } from '../comum/tempo';
import type { CategoriaAluno, PlanoAluno } from './enums';
import { Integrante } from './integrante.entity';

@Entity({ tableName: 'alunos' })
export class Aluno {
  @PrimaryKey({ type: 'uuid' })
  id: string = randomUUID();

  @Property({ type: 'text' })
  nome!: string;

  @Property({ type: 'text' })
  telefone!: string;

  @Property({ type: 'text', nullable: true })
  email: string | null = null;

  @Property({ type: 'text' })
  plano!: PlanoAluno;

  @Property({ type: 'text' })
  categoria!: CategoriaAluno;

  @Property({ type: 'jsonb' })
  diasSemana: DiaSemana[] = [];

  @Property({ type: 'text', nullable: true })
  horarioInicio: string | null = null;

  @ManyToOne(() => Integrante, { nullable: true })
  responsavel: Integrante | null = null;

  @Property({ type: 'boolean' })
  ativo = true;

  @Property({ type: 'timestamptz' })
  cadastradoEm: Date = new Date();
}
