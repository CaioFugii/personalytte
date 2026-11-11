import { Migration } from '@mikro-orm/migrations';

export class Migration20261111120000_grupos extends Migration {
  override up(): void {
    this.addSql(`create table if not exists grupos (
      id uuid primary key,
      responsavel_id uuid not null references integrantes (id),
      inicio timestamptz not null,
      fim timestamptz not null,
      capacidade int not null default 4,
      constraint grupos_capacidade_valida check (capacidade in (4, 6)),
      constraint grupos_duracao_minima check (fim >= inicio + interval '1 hour'),
      constraint grupos_mesmo_dia check (
        (timezone('America/Sao_Paulo', inicio))::date = (timezone('America/Sao_Paulo', fim))::date
      )
    )`);
    this.addSql(`insert into grupos (id, responsavel_id, inicio, fim, capacidade)
      select
        gen_random_uuid(),
        responsavel_id,
        inicio,
        greatest(max(fim), inicio + interval '1 hour'),
        case
          when count(*) filter (where status in ('AGUARDANDO', 'CONFIRMADA')) > 4 then 6
          when (timezone('America/Sao_Paulo', inicio))::time = time '07:00' then 6
          else 4
        end
      from aulas
      group by responsavel_id, inicio`);
    this.addSql(`alter table aulas add column if not exists grupo_id uuid null references grupos (id)`);
    this.addSql(`update aulas a
      set grupo_id = g.id
      from grupos g
      where a.grupo_id is null
        and g.responsavel_id = a.responsavel_id
        and g.inicio = a.inicio`);
    this.addSql(`alter table aulas alter column grupo_id set not null`);
    this.addSql(`alter table aulas drop constraint if exists aulas_aluno_sem_sobreposicao`);
    this.addSql(`alter table aulas drop constraint if exists aulas_responsavel_sem_sobreposicao`);
    this.addSql(`alter table aulas drop constraint if exists aulas_fim_depois`);
    this.addSql(`drop index if exists aulas_inicio_idx`);
    this.addSql(`drop index if exists aulas_responsavel_idx`);
    this.addSql(`alter table aulas drop column if exists responsavel_id`);
    this.addSql(`alter table aulas drop column if exists inicio`);
    this.addSql(`alter table aulas drop column if exists fim`);
    this.addSql(`create index if not exists aulas_grupo_idx on aulas (grupo_id)`);
    this.addSql(`create index if not exists grupos_inicio_idx on grupos (inicio)`);
    this.addSql(`create index if not exists grupos_responsavel_idx on grupos (responsavel_id)`);
    this.addSql(`create or replace function aulas_validar_participacao() returns trigger
      language plpgsql as $func$
      declare
        g record;
        ocupadas int;
      begin
        select id, responsavel_id, inicio, fim, capacidade into g from grupos where id = new.grupo_id;
        if not found then
          raise exception 'Grupo da aula não encontrado';
        end if;
        if exists (
          select 1
          from aulas a
          join grupos og on og.id = a.grupo_id
          where a.aluno_id = new.aluno_id
            and a.id is distinct from new.id
            and og.inicio < g.fim
            and og.fim > g.inicio
        ) then
          raise exception 'sobreposicao de aluno' using errcode = '23P01';
        end if;
        if new.status in ('AGUARDANDO', 'CONFIRMADA') then
          if exists (
            select 1
            from grupos og
            join aulas oa on oa.grupo_id = og.id
            where og.responsavel_id = g.responsavel_id
              and og.id <> g.id
              and oa.status in ('AGUARDANDO', 'CONFIRMADA')
              and og.inicio < g.fim
              and og.fim > g.inicio
          ) then
            raise exception 'sobreposicao de professor' using errcode = '23P01';
          end if;
          select count(*) into ocupadas
          from aulas
          where grupo_id = g.id
            and id is distinct from new.id
            and status in ('AGUARDANDO', 'CONFIRMADA');
          if ocupadas >= g.capacidade then
            raise exception 'grupo cheio' using errcode = '23P01';
          end if;
        end if;
        return new;
      end;
      $func$`);
    this.addSql(`create or replace function grupos_validar_sessao() returns trigger
      language plpgsql as $func$
      declare
        participacao aulas%rowtype;
      begin
        if (
          select count(*) from aulas
          where grupo_id = new.id and status in ('AGUARDANDO', 'CONFIRMADA')
        ) > new.capacidade then
          raise exception 'capacidade insuficiente' using errcode = '23514';
        end if;
        for participacao in select * from aulas where grupo_id = new.id
        loop
          if exists (
            select 1
            from aulas a
            join grupos og on og.id = a.grupo_id
            where a.aluno_id = participacao.aluno_id
              and a.id <> participacao.id
              and og.inicio < new.fim
              and og.fim > new.inicio
          ) then
            raise exception 'sobreposicao de aluno' using errcode = '23P01';
          end if;
          if participacao.status in ('AGUARDANDO', 'CONFIRMADA') and exists (
            select 1
            from grupos og
            join aulas oa on oa.grupo_id = og.id
            where og.responsavel_id = new.responsavel_id
              and og.id <> new.id
              and oa.status in ('AGUARDANDO', 'CONFIRMADA')
              and og.inicio < new.fim
              and og.fim > new.inicio
          ) then
            raise exception 'sobreposicao de professor' using errcode = '23P01';
          end if;
        end loop;
        return new;
      end;
      $func$`);
    this.addSql(`drop trigger if exists aulas_validar_participacao_trg on aulas`);
    this.addSql(`create constraint trigger aulas_validar_participacao_trg
      after insert or update of grupo_id, aluno_id, status on aulas
      deferrable initially deferred
      for each row execute function aulas_validar_participacao()`);
    this.addSql(`drop trigger if exists grupos_validar_sessao_trg on grupos`);
    this.addSql(`create constraint trigger grupos_validar_sessao_trg
      after update of responsavel_id, inicio, fim, capacidade on grupos
      deferrable initially deferred
      for each row execute function grupos_validar_sessao()`);
  }

  override down(): void {
    this.addSql(`drop trigger if exists grupos_validar_sessao_trg on grupos`);
    this.addSql(`drop trigger if exists aulas_validar_participacao_trg on aulas`);
    this.addSql(`drop function if exists grupos_validar_sessao()`);
    this.addSql(`drop function if exists aulas_validar_participacao()`);
    this.addSql(`alter table aulas add column if not exists responsavel_id uuid null references integrantes (id)`);
    this.addSql(`alter table aulas add column if not exists inicio timestamptz null`);
    this.addSql(`alter table aulas add column if not exists fim timestamptz null`);
    this.addSql(`update aulas a
      set responsavel_id = g.responsavel_id, inicio = g.inicio, fim = g.fim
      from grupos g
      where g.id = a.grupo_id`);
    this.addSql(`alter table aulas alter column responsavel_id set not null`);
    this.addSql(`alter table aulas alter column inicio set not null`);
    this.addSql(`alter table aulas alter column fim set not null`);
    this.addSql(`alter table aulas drop column if exists grupo_id`);
    this.addSql(`drop table if exists grupos cascade`);
    this.addSql(`alter table aulas add constraint aulas_fim_depois check (fim > inicio)`);
    this.addSql(`create index if not exists aulas_inicio_idx on aulas (inicio)`);
    this.addSql(`create index if not exists aulas_responsavel_idx on aulas (responsavel_id)`);
    this.addSql(`alter table aulas add constraint aulas_aluno_sem_sobreposicao
      exclude using gist (
        aluno_id with =,
        tstzrange(inicio, fim, '[)') with &&
      ) where (status <> 'CANCELADA')`);
    this.addSql(`alter table aulas add constraint aulas_responsavel_sem_sobreposicao
      exclude using gist (
        responsavel_id with =,
        tstzrange(inicio, fim, '[)') with &&,
        inicio with <>
      ) where (status not in ('CANCELADA', 'FALTA'))`);
  }
}
