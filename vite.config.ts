import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import path from 'path';

export default defineConfig(({ mode }) => {
  // Load env file based on mode
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [
      react(),
      process.env.ANALYZE && visualizer({
        open: true,
        filename: 'dist/bundle-analysis.html',
        gzipSize: true,
        brotliSize: true,
      }),
    ].filter(Boolean),
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    base: './',
    define: {
      // Explicitly expose env vars to the app
      'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY),
      'import.meta.env.VITE_GOOGLE_API_KEY': JSON.stringify(env.VITE_GOOGLE_API_KEY),
    },
    build: {
      outDir: 'dist',
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true,
        },
      },
      // Disable source maps for faster builds
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom'],
            'vendor-recharts': ['recharts'],
            'vendor-tiptap': [
              '@tiptap/react',
              '@tiptap/starter-kit',
              '@tiptap/extensions',
              '@tiptap/markdown',
              '@tiptap/extension-highlight',
              '@tiptap/extension-link',
              '@tiptap/extension-placeholder',
              '@tiptap/extension-character-count',
              '@tiptap/extension-typography',
            ],
            'vendor-dnd': ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
            'vendor-state': ['zustand'],
          },
        },
      },
    },
    // Performance optimizations
    optimizeDeps: {
      include: ['react', 'react-dom', 'zustand', 'lucide-react'],
      exclude: ['vosk-browser'], // Don't pre-bundle vosk
    },
  };
});
