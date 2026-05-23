import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/recharts')) return 'vendor-charts';
          if (id.includes('/src/pages/')) {
            return 'page-' + id
              .split('/src/pages/')[1]
              .split('.')[0]
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-');
          }
        },
      },
    },
  },
});
