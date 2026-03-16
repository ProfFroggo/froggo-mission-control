// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Native Node addons must not be bundled by Turbopack — loaded at runtime
  serverExternalPackages: ['better-sqlite3', 'keytar'],
  // @ path alias is picked up automatically from tsconfig paths
  turbopack: {
    root: __dirname,
  },

  async headers() {
    return [
      {
        // Artifact preview files — no CSP so CDN scripts work in iframe
        source: '/api/projects/:id/file',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options',       value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy',        value: 'strict-origin-when-cross-origin' },
          { key: 'X-XSS-Protection',       value: '1; mode=block' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdn.tailwindcss.com https://unpkg.com https://cdnjs.cloudflare.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.tailwindcss.com",
              "font-src 'self' https://fonts.gstatic.com",
              "connect-src 'self' https://generativelanguage.googleapis.com wss://generativelanguage.googleapis.com ws://127.0.0.1:*",
              "img-src 'self' data: blob: https:",
              "media-src 'self' blob:",
              "worker-src 'self' blob:",
              "frame-ancestors 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
