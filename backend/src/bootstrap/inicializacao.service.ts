import { MikroORM } from '@mikro-orm/core';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { BootstrapService } from './bootstrap.service';
import { SeedService } from './seed.service';

@Injectable()
export class InicializacaoService implements OnModuleInit {
  constructor(private readonly orm: MikroORM) {}

  async onModuleInit(): Promise<void> {
    await this.orm.migrator.up();
    const em = this.orm.em.fork();
    await new BootstrapService().executar(em);
    await new SeedService().executar(this.orm);
  }
}
