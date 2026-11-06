import { Migration } from '@mikro-orm/migrations';

export class Migration20261106120000_aluno_genero extends Migration {
  override up(): void {
    this.addSql(`alter table alunos add column if not exists genero text null`);
    this.addSql(`alter table alunos drop constraint if exists alunos_genero_valido`);
    this.addSql(
      `alter table alunos add constraint alunos_genero_valido check (genero is null or genero in ('FEMININO', 'MASCULINO'))`,
    );
  }

  override down(): void {
    this.addSql(`alter table alunos drop constraint if exists alunos_genero_valido`);
    this.addSql(`alter table alunos drop column if exists genero`);
  }
}
