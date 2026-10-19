import type { IntegranteAtual } from './contrato';

declare global {
  namespace Express {
    interface Request {
      integrante?: IntegranteAtual;
    }
  }
}

export {};
