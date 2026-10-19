import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    swc.vite({
      jsc: {
        target: 'es2022',
        parser: {
          syntax: 'typescript',
          decorators: true,
        },
        transform: {
          legacyDecorator: true,
          decoratorMetadata: true,
          useDefineForClassFields: false,
        },
      },
    }),
  ],
  test: {
    environment: 'node',
    fileParallelism: false,
    maxWorkers: 1,
    setupFiles: ['./test/setup-env.ts'],
    hookTimeout: 60000,
    testTimeout: 30000,
    include: ['test/**/*.spec.ts'],
  },
});
