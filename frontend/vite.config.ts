import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const STALE_EXPLORER = 'https://genlayer-explorer.vercel.app';
const EXPLORER = 'https://explorer-studio.genlayer.com';

function rewriteStaleExplorer(): Plugin {
  return {
    name: 'rewrite-stale-explorer',
    generateBundle(_options, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type === 'chunk' && file.code.includes(STALE_EXPLORER)) {
          file.code = file.code.split(STALE_EXPLORER).join(EXPLORER);
        }
      }
    },
  };
}

export default defineConfig({
  root: 'frontend',
  // .env files live at the repo root, not in frontend/. Note: __dirname here is
  // the config file's directory (frontend/), so we go one level up.
  envDir: path.resolve(__dirname, '..'),
  plugins: [react(), rewriteStaleExplorer()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
});
