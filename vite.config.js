import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  esbuild: mode === 'production' ? {
    drop: ['console', 'debugger'],
    legalComments: 'none',
  } : {},
  server: {
    port: 8080,
  },
}));
