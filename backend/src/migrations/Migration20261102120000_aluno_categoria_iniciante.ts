import { Migration } from '@mikro-orm/migrations';

export class Migration20261102120000_aluno_categoria_iniciante extends Migration {
  override up(): void {
    this.addSql(`alter table alunos drop constraint if exists alunos_categoria_valida`);
    this.addSql(
      `alter table alunos add constraint alunos_categoria_valida check (categoria is null or categoria in ('INICIANTE', 'D', 'C', 'B', 'A'))`,
    );
  }

  override down(): void {
    this.addSql(`alter table alunos drop constraint if exists alunos_categoria_valida`);
    this.addSql(
      `alter table alunos add constraint alunos_categoria_valida check (categoria is null or categoria in ('D', 'C', 'B', 'A'))`,
    );
  }
}
