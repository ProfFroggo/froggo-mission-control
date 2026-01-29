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
        manualChunks: {
          // Vendor chunks - separate large dependencies
          'vendor-react': ['react', 'react-dom'],
          'vendor-zustand': ['zustand'],
          'vendor-charts': ['recharts'],
          'vendor-dnd': ['@dnd-kit/core', '@dnd-kit/sortable'],
          'vendor-lucide': ['lucide-react'],
          'vendor-fuse': ['fuse.js'],
          // Vosk should be completely separate (loaded on demand)
          // 'vendor-vosk': ['vosk-browser'], // Don't bundle, lazy load instead
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
