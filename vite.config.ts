// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    hmr: {
      overlay: false // Désactiver l'overlay d'erreur pour éviter les conflits
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          charts: ['recharts'],
          utils: ['lucide-react']
        }
      }
    },
    chunkSizeWarningLimit: 1000,
    sourcemap: false // Désactiver les sourcemaps en production
  },
  optimizeDeps: {
    exclude: ['lucide-react'] // Éviter l'optimisation des icônes
  }
});
