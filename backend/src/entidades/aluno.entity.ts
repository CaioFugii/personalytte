import { Entity, PrimaryKey, Property } from '@mikro-orm/core';
import { randomUUID } from 'crypto';
import type { HorarioPlano } from '../comum/tempo';
import type { CategoriaAluno, GeneroAluno, PlanoAluno } from './enums';

@Entity({ tableName: 'alunos' })
export class Aluno {
  @PrimaryKey({ type: 'uuid' })
  id: string = randomUUID();

  @Property({ type: 'text' })
  nome!: string;

  @Property({ type: 'text', nullable: true })
  telefone: string | null = null;

  @Property({ type: 'text', nullable: true })
  email: string | null = null;

  @Property({ type: 'text', nullable: true })
  instagram: string | null = null;

  @Property({ type: 'date', nullable: true })
  dataNascimento: string | null = null;

  @Property({ type: 'text', nullable: true })
  plano: PlanoAluno | null = null;

  @Property({ type: 'text', nullable: true })
  categoria: CategoriaAluno | null = null;

  @Property({ type: 'text', nullable: true })
  genero: GeneroAluno | null = null;

  @Property({ type: 'boolean' })
  temporario = false;

  @Property({ type: 'jsonb' })
  horarios: HorarioPlano[] = [];

  @Property({ type: 'boolean' })
  ativo = true;

  @Property({ type: 'boolean' })
  planoSuspenso = false;

  @Property({ type: 'timestamptz' })
  cadastradoEm: Date = new Date();
}
