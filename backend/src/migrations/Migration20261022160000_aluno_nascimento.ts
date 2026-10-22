import { Migration } from '@mikro-orm/migrations';

export class Migration20261022160000_aluno_nascimento extends Migration {
  override up(): void {
    this.addSql(`alter table alunos add column if not exists data_nascimento date null`);
  }

  override down(): void {
    this.addSql(`alter table alunos drop column if exists data_nascimento`);
  }
}
