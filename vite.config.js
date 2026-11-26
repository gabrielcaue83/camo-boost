import { defineConfig } from 'vite';

// No GitHub Pages o site fica em /camo-boost/; no dev, na raiz.
export default defineConfig(({ command }) => ({
  base: command === 'build' && process.env.GITHUB_ACTIONS ? '/camo-boost/' : '/',
}));
