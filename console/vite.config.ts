import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig(({ command }) => ({
  // Production builds are served at /console/ on the Node server. In dev (vite
  // serve at :5173) we keep the root base so /src/main.tsx and the proxy work.
  base: command === 'build' ? '/console/' : '/',
  plugins: [preact()],
  server: { port: 5173 },
  build: { outDir: 'dist', emptyOutDir: true, sourcemap: true },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/**/*.test.{ts,tsx}'],
  },
}));
