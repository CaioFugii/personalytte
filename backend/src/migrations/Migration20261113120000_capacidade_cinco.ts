import { Migration } from '@mikro-orm/migrations';

export class Migration20261113120000_capacidade_cinco extends Migration {
  override up(): void {
    this.addSql(`alter table grupos drop constraint grupos_capacidade_valida`);
    this.addSql(`alter table grupos add constraint grupos_capacidade_valida check (capacidade in (4, 5, 6))`);
  }

  override down(): void {
    this.addSql(`alter table grupos drop constraint grupos_capacidade_valida`);
    this.addSql(`alter table grupos add constraint grupos_capacidade_valida check (capacidade in (4, 6))`);
  }
}
