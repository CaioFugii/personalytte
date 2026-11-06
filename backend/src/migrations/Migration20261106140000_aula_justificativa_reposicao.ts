import { Migration } from '@mikro-orm/migrations';

export class Migration20261106140000_aula_justificativa_reposicao extends Migration {
  override up(): void {
    this.addSql(`alter table aulas add column if not exists justificativa_reposicao text null`);
  }

  override down(): void {
    this.addSql(`alter table aulas drop column if exists justificativa_reposicao`);
  }
}
