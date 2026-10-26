import { Migration } from '@mikro-orm/migrations';

export class Migration20261026120000_aulas_grupo_cancelamento extends Migration {
  override up(): void {
    this.addSql(`alter table aulas drop constraint if exists aulas_responsavel_sem_sobreposicao`);
    this.addSql(`alter table aulas add constraint aulas_responsavel_sem_sobreposicao
      exclude using gist (
        responsavel_id with =,
        tstzrange(inicio, fim, '[)') with &&,
        inicio with <>
      ) where (status <> 'CANCELADA')`);
    this.addSql(`alter table aulas add column if not exists justificativa_cancelamento text null`);
    this.addSql(`alter table aulas add column if not exists cancelamento_gera_reposicao boolean null`);
  }

  override down(): void {
    this.addSql(`alter table aulas drop column if exists cancelamento_gera_reposicao`);
    this.addSql(`alter table aulas drop column if exists justificativa_cancelamento`);
    this.addSql(`alter table aulas drop constraint if exists aulas_responsavel_sem_sobreposicao`);
    this.addSql(`alter table aulas add constraint aulas_responsavel_sem_sobreposicao
      exclude using gist (
        responsavel_id with =,
        tstzrange(inicio, fim, '[)') with &&
      ) where (status <> 'CANCELADA')`);
  }
}
