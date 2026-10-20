import { Migration } from '@mikro-orm/migrations';

export class Migration20261020140000_aluno_temporario extends Migration {
  override up(): void {
    this.addSql(`alter table alunos add column if not exists temporario boolean not null default false`);
    this.addSql(`alter table alunos alter column telefone drop not null`);
    this.addSql(`alter table alunos alter column plano drop not null`);
    this.addSql(`alter table alunos alter column categoria drop not null`);
    this.addSql(`alter table alunos drop constraint if exists alunos_plano_valido`);
    this.addSql(`alter table alunos drop constraint if exists alunos_categoria_valida`);
    this.addSql(`alter table alunos add constraint alunos_plano_valido check (plano is null or plano in ('PARTICULAR', 'GYMPASS', 'MENSAL'))`);
    this.addSql(`alter table alunos add constraint alunos_categoria_valida check (categoria is null or categoria in ('D', 'C', 'B', 'A'))`);
    this.addSql(`alter table alunos drop constraint if exists alunos_efetivo_completo`);
    this.addSql(`alter table alunos add constraint alunos_efetivo_completo check (
      temporario = true or (telefone is not null and plano is not null and categoria is not null)
    )`);
  }

  override down(): void {
    this.addSql(`alter table alunos drop constraint if exists alunos_efetivo_completo`);
    this.addSql(`delete from alunos where temporario = true`);
    this.addSql(`alter table alunos drop column if exists temporario`);
    this.addSql(`alter table alunos alter column telefone set not null`);
    this.addSql(`alter table alunos alter column plano set not null`);
    this.addSql(`alter table alunos alter column categoria set not null`);
  }
}
