import { Migration } from '@mikro-orm/migrations';

export class Migration20261110150000_plano_professor_por_horario extends Migration {
  override up(): void {
    this.addSql(`update alunos
      set horarios = (
        select coalesce(jsonb_agg(
          case
            when elemento ? 'responsavelId' and nullif(elemento->>'responsavelId', '') is not null then elemento
            else elemento || jsonb_build_object('responsavelId', responsavel_id::text)
          end
          order by ordinalidade
        ), '[]'::jsonb)
        from jsonb_array_elements(alunos.horarios) with ordinality as item(elemento, ordinalidade)
      )
      where responsavel_id is not null`);
    this.addSql(`alter table alunos drop column if exists responsavel_id`);
  }

  override down(): void {
    this.addSql(`alter table alunos add column if not exists responsavel_id uuid null references integrantes (id)`);
    this.addSql(`update alunos
      set responsavel_id = (horarios->0->>'responsavelId')::uuid
      where jsonb_array_length(horarios) > 0`);
    this.addSql(`update alunos
      set horarios = (
        select coalesce(jsonb_agg(elemento - 'responsavelId' order by ordinalidade), '[]'::jsonb)
        from jsonb_array_elements(alunos.horarios) with ordinality as item(elemento, ordinalidade)
      )`);
  }
}
