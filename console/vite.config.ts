import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ command }) => ({
  // Production builds are served at /console/ on the Node server. In dev (vite
  // serve at :5173) we keep the root base so /src/main.tsx and the proxy work.
  base: command === 'build' ? '/console/' : '/',
  plugins: [preact()],
  server: { port: 5173 },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        sw: resolve(__dirname, 'src/sw.ts'),
      },
      output: {
        // Emit the service worker at dist/sw.js (root) so it can be registered
        // at /console/sw.js with a /console/ scope. App chunks remain hashed.
        entryFileNames: (info) => (info.name === 'sw' ? 'sw.js' : 'assets/[name]-[hash].js'),
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/**/*.test.{ts,tsx}'],
  },
}));
