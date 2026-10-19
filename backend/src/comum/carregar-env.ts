import { config } from 'dotenv';
import path from 'path';

let carregado = false;

export function carregarEnv(): void {
  if (carregado) return;
  carregado = true;
  const candidatos = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '../.env'),
    path.resolve(__dirname, '../../.env'),
    path.resolve(__dirname, '../../../.env'),
  ];
  for (const arquivo of candidatos) {
    config({ path: arquivo });
  }
}
