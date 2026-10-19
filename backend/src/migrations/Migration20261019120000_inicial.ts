import { Migration } from '@mikro-orm/migrations';

export const SQL_INICIAL = [
  `create extension if not exists btree_gist`,
  `create table if not exists integrantes (
    id uuid primary key,
    nome text not null,
    email text not null,
    senha_hash text not null,
    funcao text not null,
    telefone text null,
    data_nascimento date null,
    ativo boolean not null default true,
    versao_sessao integer not null default 1,
    cadastrado_em timestamptz not null,
    constraint integrantes_email_unico unique (email),
    constraint integrantes_funcao_valida check (funcao in ('PROFESSOR', 'SOCIO'))
  )`,
  `create table if not exists alunos (
    id uuid primary key,
    nome text not null,
    telefone text not null,
    email text null,
    plano text not null,
    categoria text not null,
    dias_semana jsonb not null default '[]'::jsonb,
    horario_inicio text null,
    responsavel_id uuid null references integrantes (id),
    ativo boolean not null default true,
    cadastrado_em timestamptz not null,
    constraint alunos_plano_valido check (plano in ('PARTICULAR', 'GYMPASS', 'MENSAL')),
    constraint alunos_categoria_valida check (categoria in ('D', 'C', 'B', 'A'))
  )`,
  `create table if not exists aulas (
    id uuid primary key,
    aluno_id uuid not null references alunos (id),
    responsavel_id uuid not null references integrantes (id),
    inicio timestamptz not null,
    fim timestamptz not null,
    status text not null,
    experimental boolean not null default false,
    reposicao_de_id uuid null references aulas (id) on delete set null,
    ligada_ao_plano boolean not null default false,
    constraint aulas_status_valido check (status in ('AGUARDANDO', 'CONFIRMADA', 'FALTA', 'CANCELADA')),
    constraint aulas_fim_depois check (fim > inicio)
  )`,
  `create table if not exists eventos (
    id uuid primary key,
    tipo text not null,
    nome text not null,
    inicio timestamptz not null,
    fim timestamptz not null,
    contato text null,
    bloqueia_aulas boolean not null default false,
    responsavel_id uuid null references integrantes (id),
    constraint eventos_fim_posterior check (fim > inicio),
    constraint eventos_tipo_valido check (tipo in ('FERIADO', 'AGENDA_FECHADA', 'AUSENCIA', 'ANIVERSARIO', 'TORNEIO')),
    constraint eventos_ausencia_responsavel check (
      (tipo = 'AUSENCIA' and responsavel_id is not null)
      or (tipo <> 'AUSENCIA' and responsavel_id is null)
    ),
    constraint eventos_bloqueio_tipos check (
      bloqueia_aulas = false or tipo in ('FERIADO', 'AGENDA_FECHADA')
    )
  )`,
  `create table if not exists avisos (
    id uuid primary key,
    titulo text not null,
    mensagem text not null,
    criado_em timestamptz not null,
    atualizado_em timestamptz not null
  )`,
  `create index if not exists aulas_inicio_idx on aulas (inicio)`,
  `create index if not exists aulas_aluno_idx on aulas (aluno_id)`,
  `create index if not exists aulas_responsavel_idx on aulas (responsavel_id)`,
  `create index if not exists eventos_intervalo_idx on eventos (inicio, fim)`,
  `alter table aulas drop constraint if exists aulas_aluno_sem_sobreposicao`,
  `alter table aulas drop constraint if exists aulas_responsavel_sem_sobreposicao`,
  `alter table aulas add constraint aulas_aluno_sem_sobreposicao
    exclude using gist (
      aluno_id with =,
      tstzrange(inicio, fim, '[)') with &&
    ) where (status <> 'CANCELADA')`,
  `alter table aulas add constraint aulas_responsavel_sem_sobreposicao
    exclude using gist (
      responsavel_id with =,
      tstzrange(inicio, fim, '[)') with &&
    ) where (status <> 'CANCELADA')`,
];

export class Migration20261019120000_inicial extends Migration {
  override up(): void {
    for (const sql of SQL_INICIAL) this.addSql(sql);
  }

  override down(): void {
    this.addSql('drop table if exists avisos cascade');
    this.addSql('drop table if exists eventos cascade');
    this.addSql('drop table if exists aulas cascade');
    this.addSql('drop table if exists alunos cascade');
    this.addSql('drop table if exists integrantes cascade');
  }
}
