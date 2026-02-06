import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';
import { jsxContextualPlugin } from './src/vite-plugins/jsx-contextual';
import { jsxSignalsPlugin } from './src/vite-plugins/jsx-signals';
import { routeGeneratorPlugin } from './src/vite-plugins/router/route-generator-plugin';

export default defineConfig({
  resolve: {
    alias: {
      'signalsframework/jsx-runtime': resolve(__dirname, './src/jsx/jsx-runtime.ts'),
      'signalsframework/jsx-dev-runtime': resolve(__dirname, './src/jsx/jsx-dev-runtime.ts'),
    },
  },

  plugins: [
    jsxSignalsPlugin(),
    jsxContextualPlugin(),
    routeGeneratorPlugin({
      srcDir: 'src',
      outputPath: 'src/router/generated-routes.ts',
      verbose: false,
    }),
    dts({
      insertTypesEntry: true,
      rollupTypes: false,
    }),
  ],

  build: {
    minify: false,
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        'jsx-runtime': resolve(__dirname, 'src/jsx/jsx-runtime.ts'),
        'jsx-dev-runtime': resolve(__dirname, 'src/jsx/jsx-dev-runtime.ts'),
        'vite-plugins/index': resolve(__dirname, 'src/vite-plugins/index.ts'),
      },
      formats: ['es'],
      fileName: (format, entryName) => `${entryName}.js`,
    },
    rollupOptions: {
      external: [
        'vite',
        'typescript',
        'path',
        'fs',
        'fs/promises',
        /^node:.*/,
      ],
      output: {
        preserveModules: true,
        preserveModulesRoot: 'src',
        entryFileNames: '[name].js',
        exports: 'named',
      },
    },
    outDir: 'dist',
    emptyOutDir: true,
  },
});
