import { Migration } from '@mikro-orm/migrations';

export class Migration20261021150000_integrante_outros extends Migration {
  override up(): void {
    this.addSql(`alter table integrantes drop constraint if exists integrantes_funcao_valida`);
    this.addSql(
      `alter table integrantes add constraint integrantes_funcao_valida check (funcao in ('PROFESSOR', 'SOCIO', 'OUTROS'))`,
    );
  }

  override down(): void {
    this.addSql(`alter table integrantes drop constraint if exists integrantes_funcao_valida`);
    this.addSql(`alter table integrantes add constraint integrantes_funcao_valida check (funcao in ('PROFESSOR', 'SOCIO'))`);
  }
}
