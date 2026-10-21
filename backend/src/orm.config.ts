import 'reflect-metadata';
import path from 'path';
import { defineConfig } from '@mikro-orm/postgresql';
import { Migrator } from '@mikro-orm/migrations';
import { carregarEnv } from './comum/carregar-env';
import { Aluno } from './entidades/aluno.entity';
import { Aula } from './entidades/aula.entity';
import { Aviso } from './entidades/aviso.entity';
import { Evento } from './entidades/evento.entity';
import { Checkin } from './entidades/checkin.entity';
import { Integrante } from './entidades/integrante.entity';
import { Migration20261019120000_inicial } from './migrations/Migration20261019120000_inicial';
import { Migration20261020140000_aluno_temporario } from './migrations/Migration20261020140000_aluno_temporario';
import { Migration20261021140000_aluno_instagram } from './migrations/Migration20261021140000_aluno_instagram';
import { Migration20261021150000_integrante_outros } from './migrations/Migration20261021150000_integrante_outros';
import { Migration20261021160000_checkins } from './migrations/Migration20261021160000_checkins';

export function criarOrmConfig() {
  carregarEnv();
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL ausente');
  const local = /localhost|127\.0\.0\.1/.test(url);
  return defineConfig({
    clientUrl: url,
    entities: [Integrante, Aluno, Aula, Evento, Aviso, Checkin],
    extensions: [Migrator],
    allowGlobalContext: true,
    debug: process.env.DEBUG_SQL === '1',
    migrations: {
      tableName: 'mikro_orm_migrations',
      path: path.join(__dirname, 'migrations'),
      pathTs: path.join(__dirname, 'migrations'),
      snapshot: false,
      migrationsList: [
        { name: 'Migration20261019120000_inicial', class: Migration20261019120000_inicial },
        { name: 'Migration20261020140000_aluno_temporario', class: Migration20261020140000_aluno_temporario },
        { name: 'Migration20261021140000_aluno_instagram', class: Migration20261021140000_aluno_instagram },
        { name: 'Migration20261021150000_integrante_outros', class: Migration20261021150000_integrante_outros },
        { name: 'Migration20261021160000_checkins', class: Migration20261021160000_checkins },
      ],
    },
    driverOptions: local ? {} : { connection: { ssl: { rejectUnauthorized: false } } },
  });
}
