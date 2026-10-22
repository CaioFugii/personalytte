import { Migration } from '@mikro-orm/migrations';

export class Migration20261022140000_aluno_horarios extends Migration {
  override up(): void {
    this.addSql(`alter table alunos add column if not exists horarios jsonb not null default '[]'::jsonb`);
    this.addSql(`update alunos set horarios = (
      select coalesce(jsonb_agg(
        jsonb_build_object('dia', dia, 'horarioInicio', horario_inicio)
        order by case dia
          when 'seg' then 1 when 'ter' then 2 when 'qua' then 3 when 'qui' then 4
          when 'sex' then 5 when 'sab' then 6 when 'dom' then 7 else 8
        end
      ), '[]'::jsonb)
      from jsonb_array_elements_text(dias_semana) as dia
    ) where horario_inicio is not null and dias_semana <> '[]'::jsonb`);
    this.addSql(`alter table alunos drop column if exists dias_semana`);
    this.addSql(`alter table alunos drop column if exists horario_inicio`);
  }

  override down(): void {
    this.addSql(`alter table alunos add column if not exists dias_semana jsonb not null default '[]'::jsonb`);
    this.addSql(`alter table alunos add column if not exists horario_inicio text null`);
    this.addSql(`update alunos set
      dias_semana = coalesce((select jsonb_agg(distinct item->>'dia') from jsonb_array_elements(horarios) as item), '[]'::jsonb),
      horario_inicio = horarios->0->>'horarioInicio'
    `);
    this.addSql(`alter table alunos drop column if exists horarios`);
  }
}
