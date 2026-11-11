import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core';
import { randomUUID } from 'crypto';
import type { StatusAula } from './enums';
import { Aluno } from './aluno.entity';
import { Grupo } from './grupo.entity';
import { Integrante } from './integrante.entity';

@Entity({ tableName: 'aulas' })
export class Aula {
  @PrimaryKey({ type: 'uuid' })
  id: string = randomUUID();

  @ManyToOne(() => Grupo)
  grupo!: Grupo;

  @ManyToOne(() => Aluno)
  aluno!: Aluno;

  @Property({ type: 'text' })
  status: StatusAula = 'AGUARDANDO';

  @Property({ type: 'boolean' })
  experimental = false;

  @ManyToOne(() => Aula, { nullable: true, deleteRule: 'set null' })
  reposicaoDe: Aula | null = null;

  @Property({ type: 'boolean' })
  ligadaAoPlano = false;

  @Property({ type: 'text', nullable: true })
  justificativaCancelamento: string | null = null;

  @Property({ type: 'boolean', nullable: true })
  cancelamentoGeraReposicao: boolean | null = null;

  @Property({ type: 'text', nullable: true })
  justificativaReposicao: string | null = null;

  get inicio(): Date {
    return this.grupo.inicio;
  }

  get fim(): Date {
    return this.grupo.fim;
  }

  get responsavel(): Integrante {
    return this.grupo.responsavel;
  }
}
