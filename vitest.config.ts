import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Usar ambiente de DOM (jsdom) para tests que necesiten DOM
    environment: 'jsdom',

    // Configuración de cobertura
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.test.{ts,tsx}',
        'src/**/*.spec.{ts,tsx}',
        'src/vite-plugins/**', // Excluir plugins de vite de coverage
      ],
    },

    // Globales como describe, it, expect
    globals: true,

    // Setup files que se ejecutan antes de cada test
    setupFiles: ['./test/setup.ts'],
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '/virtual:generated-routes': path.resolve(__dirname, './test/mocks/generated-routes.ts'),
    },
  },
});
