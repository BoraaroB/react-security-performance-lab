import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const srcDir = path.resolve(import.meta.dirname, 'src');

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': srcDir,
    },
  },
  server: {
    port: 5173,
    // The API allows exactly http://localhost:5173 (CORS, CSRF Origin check, OAuth redirect).
    // Fail instead of silently moving to 5174, where every request would be rejected.
    strictPort: true,
  },
  // `vite preview` (the production build) defaults to 4173, which the API does not allow either.
  preview: {
    port: 5173,
    strictPort: true,
  },
});
