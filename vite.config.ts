import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
          query: ['@tanstack/react-query'],
        },
      },
    },
    sourcemap: false,
    // Vite's built-in esbuild minifier. The config sets no terser-specific
    // options, and terser is an optional peer dependency that is not installed,
    // so `minify: 'terser'` made every production build fail outright.
    minify: 'esbuild',
    target: 'es2020',
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    // Only affects `vite dev` / `vite preview`; the production bundle is static
    // files served by Cloudflare Pages. Needed so the app can be reached
    // through a proxied preview host.
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: true,
  },
});
