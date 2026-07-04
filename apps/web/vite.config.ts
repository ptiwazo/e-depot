import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Le front est servi sous le sous-chemin /e-depot/ en production
// (proxy IIS ci-apps.medlog.com/e-depot → Netlify). En dev il reste à la racine.
// VITE_BASE_PATH permet de surcharger si besoin (ex. "/" pour un build racine).
export default defineConfig(({ command }) => ({
  base: process.env.VITE_BASE_PATH ?? (command === 'build' ? '/e-depot/' : '/'),
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
}));
