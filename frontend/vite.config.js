import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/app/',
  build: {
    outDir: '../public/app',
    emptyOutDir: true
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/auth/google_oauth2': 'http://localhost:3000',
      '/auth/apple': 'http://localhost:3000',
      '/auth/failure': 'http://localhost:3000'
    }
  }
});
