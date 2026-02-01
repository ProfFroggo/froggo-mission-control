import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  // Load env file based on mode
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [react()],
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
      // Disable minification - if dev works, prod should too
      minify: false,
      // Disable source maps for faster builds
      sourcemap: false,
    },
    // Performance optimizations
    optimizeDeps: {
      include: ['react', 'react-dom', 'zustand', 'lucide-react'],
      exclude: ['vosk-browser'], // Don't pre-bundle vosk
    },
  };
});
