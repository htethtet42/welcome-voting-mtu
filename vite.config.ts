import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    // Pinned because Google OAuth matches the origin EXACTLY. If Vite silently
    // falls forward to another port, sign-in fails with `origin_mismatch`.
    // strictPort makes that a startup error instead of a confusing auth error.
    port: 5173,
    strictPort: true,
  },
});