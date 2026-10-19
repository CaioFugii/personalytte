import { EntityManager } from '@mikro-orm/core';
import bcrypt from 'bcrypt';
import { Integrante } from '../entidades/integrante.entity';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class BootstrapService {
  async executar(em: EntityManager): Promise<void> {
    if (await em.count(Integrante) > 0) return;
    const nome = process.env.BOOTSTRAP_ADMIN_NAME?.trim();
    const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
    const senha = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? '';
    if (!nome || !email || !EMAIL.test(email) || senha.length < 8 || senha.length > 72) {
      throw new Error('Defina BOOTSTRAP_ADMIN_NAME, BOOTSTRAP_ADMIN_EMAIL e BOOTSTRAP_ADMIN_PASSWORD (8 a 72 caracteres) para criar o primeiro administrador.');
    }
    const admin = new Integrante();
    admin.nome = nome;
    admin.email = email;
    admin.senhaHash = await bcrypt.hash(senha, 10);
    admin.funcao = 'SOCIO';
    em.persist(admin);
    await em.flush();
    console.log(`Administrador inicial criado: ${email}`);
  }
}
