import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const STALE_EXPLORER = 'https://genlayer-explorer.vercel.app';

/** genlayer-js bakes the stale explorer into its studionet chain — rewrite it
 *  at build time to whatever VITE_EXPLORER_URL says (default explorer-studio). */
function rewriteStaleExplorer(explorer: string): Plugin {
  const target = explorer.replace(/\/+$/, '');
  return {
    name: 'rewrite-stale-explorer',
    generateBundle(_options, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type === 'chunk' && file.code.includes(STALE_EXPLORER)) {
          file.code = file.code.split(STALE_EXPLORER).join(target);
        }
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  // Vercel injects VITE_* vars into process.env; loadEnv also picks up root .env files.
  const env = loadEnv(mode, path.resolve(__dirname, '..'), 'VITE_');
  const explorer = env.VITE_EXPLORER_URL || 'https://explorer-studio.genlayer.com';

  return {
    root: 'frontend',
    // .env files live at the repo root, not in frontend/. Note: __dirname here is
    // the config file's directory (frontend/), so we go one level up.
    envDir: path.resolve(__dirname, '..'),
    plugins: [react(), rewriteStaleExplorer(explorer)],
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
  };
});
