import 'reflect-metadata';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.DATABASE_URL_TEST ??
  'postgres://personalytte:personalytte@localhost:5432/personalytte_test';
process.env.SESSION_SECRET = 'segredo-de-teste-personalytte';
process.env.BOOTSTRAP_ADMIN_NAME = 'Administrador';
process.env.BOOTSTRAP_ADMIN_EMAIL = 'admin@personalytte.local';
process.env.BOOTSTRAP_ADMIN_PASSWORD = 'senha-inicial';
