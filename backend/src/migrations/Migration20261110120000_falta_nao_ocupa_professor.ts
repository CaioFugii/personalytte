import { Migration } from '@mikro-orm/migrations';

export class Migration20261110120000_falta_nao_ocupa_professor extends Migration {
  override up(): void {
    this.addSql(`alter table aulas drop constraint if exists aulas_responsavel_sem_sobreposicao`);
    this.addSql(`alter table aulas add constraint aulas_responsavel_sem_sobreposicao
      exclude using gist (
        responsavel_id with =,
        tstzrange(inicio, fim, '[)') with &&,
        inicio with <>
      ) where (status not in ('CANCELADA', 'FALTA'))`);
  }

  override down(): void {
    this.addSql(`alter table aulas drop constraint if exists aulas_responsavel_sem_sobreposicao`);
    this.addSql(`alter table aulas add constraint aulas_responsavel_sem_sobreposicao
      exclude using gist (
        responsavel_id with =,
        tstzrange(inicio, fim, '[)') with &&,
        inicio with <>
      ) where (status <> 'CANCELADA')`);
  }
}
