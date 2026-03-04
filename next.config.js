/** @type {import('next').NextConfig} */
const nextConfig = {
  // better-sqlite3 is server-only — prevents bundling into client chunks
  serverExternalPackages: ['better-sqlite3'],
  // @ path alias is picked up automatically from tsconfig paths
};

module.exports = nextConfig;
