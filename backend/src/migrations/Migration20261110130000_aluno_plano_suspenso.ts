import { Migration } from '@mikro-orm/migrations';

export class Migration20261110130000_aluno_plano_suspenso extends Migration {
  override up(): void {
    this.addSql(`alter table alunos add column if not exists plano_suspenso boolean not null default false`);
  }

  override down(): void {
    this.addSql(`alter table alunos drop column if exists plano_suspenso`);
  }
}
