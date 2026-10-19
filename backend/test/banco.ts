import { Client } from 'pg';

export const TRUNCAR = 'truncate table aulas, eventos, avisos, alunos, integrantes restart identity cascade';

export async function garantirBancoTeste(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url?.includes('/personalytte_test')) {
    throw new Error(`Recusando testes fora de personalytte_test: ${url ?? ''}`);
  }
  const destinos = ['/personalytte', '/postgres'];
  let ultimo: unknown;
  for (const caminho of destinos) {
    const admin = new URL(url);
    admin.pathname = caminho;
    const client = new Client({ connectionString: admin.toString() });
    try {
      await client.connect();
      const existe = await client.query(`select 1 from pg_database where datname = 'personalytte_test'`);
      if (existe.rowCount === 0) await client.query('create database personalytte_test');
      await client.end();
      return;
    } catch (erro) {
      ultimo = erro;
      await client.end().catch(() => undefined);
    }
  }
  throw ultimo;
}
