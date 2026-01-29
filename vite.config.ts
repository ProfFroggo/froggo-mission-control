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
  base: './',
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        // Use function form for manualChunks to properly split vendor code.
        // Object form merges everything used by the entry into a single chunk.
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          // vosk-browser: huge WASM bundle, keep completely separate (lazy loaded by VoicePanel)
          if (id.includes('vosk-browser')) return 'vosk';

          // recharts + d3: only used by analytics panels (lazy loaded)
          if (id.includes('/recharts/') || id.includes('/d3-') || id.includes('/victory-vendor/')) {
            return 'vendor-charts';
          }

          // dnd-kit: only used by Kanban (lazy loaded)
          if (id.includes('/@dnd-kit/')) return 'vendor-dnd';

          // fuse.js: search library
          if (id.includes('/fuse.js/')) return 'vendor-fuse';

          // React core: always loaded, but cacheable separately
          if (id.includes('/react-dom/') || id.includes('/react/') || id.includes('/scheduler/')) {
            return 'vendor-react';
          }

          // Zustand: state management
          if (id.includes('/zustand/')) return 'vendor-zustand';
        },
      },
    },
    // Chunk size warnings
    chunkSizeWarningLimit: 500,
    // Minification
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.logs in production
        drop_debugger: true,
      },
    },
  },
  // Performance optimizations
  optimizeDeps: {
    include: ['react', 'react-dom', 'zustand', 'lucide-react'],
    exclude: ['vosk-browser'], // Don't pre-bundle vosk
  },
});
