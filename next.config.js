/** @type {import('next').NextConfig} */
const nextConfig = {
  // better-sqlite3 is server-only — prevents bundling into client chunks
  serverExternalPackages: ['better-sqlite3'],
  // @ path alias is picked up automatically from tsconfig paths

  async headers() {
    return [
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
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "connect-src 'self' https://generativelanguage.googleapis.com wss://generativelanguage.googleapis.com ws://127.0.0.1:*",
              "img-src 'self' data: blob:",
              "media-src 'self' blob:",
              "worker-src 'self' blob:",
              "font-src 'self'",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
