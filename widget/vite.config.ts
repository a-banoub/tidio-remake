import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['iife'],
      name: 'TidioRemake',
      fileName: () => 'chat-widget.js',
    },
    rollupOptions: { output: { extend: true } },
    cssCodeSplit: false,
    minify: 'terser',
    sourcemap: true,
    outDir: 'dist',
    emptyOutDir: true,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
  },
});
