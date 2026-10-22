import { Migration } from '@mikro-orm/migrations';

export class Migration20261022120000_aluno_plano_totalpass extends Migration {
  override up(): void {
    this.addSql(`alter table alunos drop constraint if exists alunos_plano_valido`);
    this.addSql(
      `alter table alunos add constraint alunos_plano_valido check (plano is null or plano in ('PARTICULAR', 'GYMPASS', 'TOTALPASS', 'MENSAL'))`,
    );
  }

  override down(): void {
    this.addSql(`alter table alunos drop constraint if exists alunos_plano_valido`);
    this.addSql(
      `alter table alunos add constraint alunos_plano_valido check (plano is null or plano in ('PARTICULAR', 'GYMPASS', 'MENSAL'))`,
    );
  }
}
