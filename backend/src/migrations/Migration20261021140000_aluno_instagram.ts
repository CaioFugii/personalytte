import { Migration } from '@mikro-orm/migrations';

export class Migration20261021140000_aluno_instagram extends Migration {
  override up(): void {
    this.addSql(`alter table alunos add column if not exists instagram text null`);
  }

  override down(): void {
    this.addSql(`alter table alunos drop column if exists instagram`);
  }
}
