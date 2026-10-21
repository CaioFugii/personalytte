import 'reflect-metadata';
import { existsSync } from 'fs';
import path from 'path';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { FiltroHttp } from './comum/filtro-http';
import './comum/tipos-express';

export function configurarAplicacao(app: NestExpressApplication): void {
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new FiltroHttp());
  if (process.env.NODE_ENV === 'production') {
    const pasta = path.resolve(__dirname, '../../frontend/dist');
    if (existsSync(pasta)) {
      app.useStaticAssets(pasta, { index: false });
      app.use((req: Request, res: Response, next: NextFunction) => {
        if (req.path.startsWith('/api')) return next();
        if (req.method !== 'GET' && req.method !== 'HEAD') return next();
        res.sendFile(path.join(pasta, 'index.html'));
      });
    } else {
      console.warn(`frontend/dist não encontrado em ${pasta}`);
    }
  } else {
    app.enableCors({ origin: ['http://localhost:5173'], credentials: true });
  }
  app.enableShutdownHooks();
}

async function iniciar(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  configurarAplicacao(app);
  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}

if (require.main === module) {
  iniciar().catch((erro: unknown) => {
    console.error(erro);
    process.exit(1);
  });
}
