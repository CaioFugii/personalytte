import 'reflect-metadata';
import { MikroORM } from '@mikro-orm/postgresql';
import { AgendaService } from './dominio/agenda.service';
import { criarOrmConfig } from './orm.config';

async function main(): Promise<void> {
  const orm = await MikroORM.init(criarOrmConfig());
  try {
    await orm.migrator.up();
    const criadas = await new AgendaService().estenderHorizonte(orm.em.fork());
    console.log(`Horizonte estendido. Ocorrências novas: ${criadas}.`);
  } finally {
    await orm.close(true);
  }
}

if (require.main === module) {
  main().catch((erro: unknown) => {
    console.error(erro instanceof Error ? erro.message : erro);
    process.exit(1);
  });
}
