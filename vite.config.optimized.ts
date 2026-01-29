/**
 * Optimized Vite Configuration
 * 
 * Aggressive code splitting and optimization for production builds.
 * Target: <20MB bundle (from 88MB)
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [
    react({
      // Enable React Fast Refresh
      fastRefresh: true,
      // Babel config for optimization
      babel: {
        plugins: [
          // Remove PropTypes in production
          ['babel-plugin-transform-react-remove-prop-types', { mode: 'remove' }],
        ],
      },
    }),
  ],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  base: './',

  build: {
    outDir: 'dist',
    sourcemap: false, // Disable sourcemaps in production for smaller size

    rollupOptions: {
      output: {
        // Aggressive manual chunking by feature
        manualChunks: (id: string) => {
          // Vendor chunks - separate large dependencies
          if (id.includes('node_modules')) {
            // React core
            if (id.includes('react') || id.includes('react-dom')) {
              return 'vendor-react';
            }

            // State management
            if (id.includes('zustand')) {
              return 'vendor-zustand';
            }

            // Charts
            if (id.includes('recharts') || id.includes('victory') || id.includes('d3-')) {
              return 'vendor-charts';
            }

            // Drag and drop
            if (id.includes('@dnd-kit')) {
              return 'vendor-dnd';
            }

            // Icons
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }

            // Search
            if (id.includes('fuse.js')) {
              return 'vendor-search';
            }

            // Vosk - DO NOT BUNDLE (lazy load on demand)
            if (id.includes('vosk-browser')) {
              return 'vendor-vosk';
            }

            // Other vendor code
            return 'vendor-misc';
          }

          // Application chunks - split by feature/panel
          if (id.includes('/src/')) {
            // Dashboard panel
            if (
              id.includes('Dashboard.tsx') ||
              id.includes('DashboardWidget') ||
              id.includes('PerformanceBenchmark')
            ) {
              return 'panel-dashboard';
            }

            // Kanban/Tasks
            if (
              id.includes('Kanban.tsx') ||
              id.includes('TaskModal') ||
              id.includes('TaskDetail') ||
              id.includes('TaskCard')
            ) {
              return 'panel-kanban';
            }

            // Agents
            if (
              id.includes('AgentPanel') ||
              id.includes('AgentCard') ||
              id.includes('AgentModal')
            ) {
              return 'panel-agents';
            }

            // Chat
            if (id.includes('ChatPanel') || id.includes('ChatMessage')) {
              return 'panel-chat';
            }

            // Voice (excluding Vosk)
            if (
              id.includes('VoicePanel') ||
              id.includes('VoiceControls') ||
              id.includes('VoiceTranscript')
            ) {
              return 'panel-voice';
            }

            // Inbox & Communications
            if (
              id.includes('InboxPanel') ||
              id.includes('ThreePaneInbox') ||
              id.includes('CommsInbox') ||
              id.includes('UnifiedCommsInbox') ||
              id.includes('SessionsFilter')
            ) {
              return 'panel-inbox';
            }

            // X/Twitter
            if (id.includes('XPanel') || id.includes('TweetComposer')) {
              return 'panel-twitter';
            }

            // Calendar & Schedule
            if (
              id.includes('CalendarPanel') ||
              id.includes('EpicCalendar') ||
              id.includes('SchedulePanel') ||
              id.includes('ContentCalendar')
            ) {
              return 'panel-calendar';
            }

            // Settings
            if (id.includes('SettingsPanel') || id.includes('EnhancedSettings')) {
              return 'panel-settings';
            }

            // Analytics & Code Agent
            if (
              id.includes('AnalyticsDashboard') ||
              id.includes('CodeAgentDashboard') ||
              id.includes('ContextControlBoard')
            ) {
              return 'panel-analytics';
            }

            // Shared components
            if (
              id.includes('Modal') ||
              id.includes('Dialog') ||
              id.includes('Toast') ||
              id.includes('Loading')
            ) {
              return 'shared-ui';
            }

            // Store & state
            if (id.includes('store/store') || id.includes('store/')) {
              return 'core-store';
            }

            // API & Gateway
            if (
              id.includes('lib/gateway') ||
              id.includes('lib/api') ||
              id.includes('apiClient')
            ) {
              return 'core-api';
            }
          }
        },

        // Asset filenames
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name || '';
          if (/\.(png|jpe?g|gif|svg|webp|avif)$/i.test(info)) {
            return 'assets/images/[name]-[hash][extname]';
          }
          if (/\.(woff2?|eot|ttf|otf)$/i.test(info)) {
            return 'assets/fonts/[name]-[hash][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },

        // Chunk filenames
        chunkFileNames: 'chunks/[name]-[hash].js',
        entryFileNames: 'entries/[name]-[hash].js',
      },
    },

    // Chunk size warnings
    chunkSizeWarningLimit: 500, // Warn if chunk > 500KB

    // Minification
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.logs in production
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.debug', 'console.trace'],
        passes: 2, // Multiple passes for better compression
      },
      mangle: {
        safari10: true,
      },
      format: {
        comments: false, // Remove all comments
      },
    },

    // Enable CSS code splitting
    cssCodeSplit: true,

    // Target modern browsers for smaller output
    target: 'es2020',

    // Optimize dependencies
    commonjsOptions: {
      include: [/node_modules/],
      extensions: ['.js', '.cjs'],
    },

    // Report compressed size (disable for faster builds)
    reportCompressedSize: true,
  },

  // Performance optimizations
  optimizeDeps: {
    // Pre-bundle these dependencies
    include: [
      'react',
      'react-dom',
      'zustand',
      'lucide-react',
      'fuse.js',
      '@dnd-kit/core',
      '@dnd-kit/sortable',
    ],

    // Don't pre-bundle vosk (load on demand)
    exclude: ['vosk-browser'],

    // Use esbuild for dep optimization
    esbuildOptions: {
      target: 'es2020',
      supported: {
        bigint: true,
      },
    },
  },

  // Server config
  server: {
    port: 5173,
    strictPort: false,
    hmr: {
      overlay: true,
    },
  },

  // Preview config
  preview: {
    port: 4173,
  },

  // Enable JSON imports
  json: {
    stringify: true,
  },
});
