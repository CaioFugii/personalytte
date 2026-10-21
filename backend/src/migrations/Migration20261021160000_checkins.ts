import { Migration } from '@mikro-orm/migrations';

export class Migration20261021160000_checkins extends Migration {
  override up(): void {
    this.addSql(`create table if not exists checkins (
      id uuid primary key,
      provedor text not null,
      referencia text not null,
      nome text not null,
      email text null,
      telefone text null,
      iniciado_em timestamptz not null,
      recebido_em timestamptz not null,
      aluno_id uuid null references alunos (id) on delete set null,
      constraint checkins_provedor_valido check (provedor in ('GYMPASS', 'TOTALPASS')),
      constraint checkins_referencia_unica unique (provedor, referencia)
    )`);
    this.addSql(`create index if not exists checkins_iniciado_idx on checkins (iniciado_em)`);
  }

  override down(): void {
    this.addSql(`drop table if exists checkins`);
  }
}
