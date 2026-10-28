import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      allowedHosts: true,
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      // Code-split large third-party vendor dependencies to optimize initial page load
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/three/')) {
              return 'three-vendor';
            }
            if (id.includes('node_modules/lucide-react/')) {
              return 'lucide-vendor';
            }
            if (id.includes('node_modules/firebase/') || id.includes('node_modules/@firebase/')) {
              return 'firebase-vendor';
            }
          },
        },
      },
      chunkSizeWarningLimit: 800,
    },
  };
});
