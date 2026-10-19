import { SetMetadata } from '@nestjs/common';

export const CHAVE_PUBLICO = 'publico';
export const Publico = () => SetMetadata(CHAVE_PUBLICO, true);
