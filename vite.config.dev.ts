import { defineConfig } from 'vite';
import { resolve } from 'path';
import { jsxContextualPlugin } from './src/vite-plugins/jsx-contextual';
import { jsxSignalsPlugin } from './src/vite-plugins/jsx-signals';
import { routeGeneratorPlugin } from './src/vite-plugins/router/route-generator-plugin';

export default defineConfig({
  root: './app',

  resolve: {
    alias: {
      'v-ibe/jsx-runtime': resolve(__dirname, './src/jsx/jsx-runtime.ts'),
      'v-ibe/jsx-dev-runtime': resolve(__dirname, './src/jsx/jsx-dev-runtime.ts'),
      'v-ibe': resolve(__dirname, './src/index.ts'),
    },
  },

  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'v-ibe',
  },

  plugins: [
    jsxSignalsPlugin(),
    jsxContextualPlugin(),
    routeGeneratorPlugin({
      srcDir: 'app',
      outputPath: 'app/router/generated-routes.ts',
      verbose: true,
    }),
  ],
});
