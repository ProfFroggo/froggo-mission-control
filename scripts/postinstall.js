#!/usr/bin/env node
/**
 * scripts/postinstall.js
 * Runs automatically after `npm install -g froggo-mission-control`.
 * Compiles MCP servers and builds the Next.js app.
 * No user interaction — just build steps.
 */

const { execSync, spawnSync } = require('child_process');
const { existsSync, mkdirSync } = require('fs');
const path = require('path');
const os = require('os');

// Skip in CI or when explicitly disabled
if (process.env.CI || process.env.SKIP_MC_POSTINSTALL) process.exit(0);
// Skip when installed as a dev/peer dependency (not a global install)
if (process.env.npm_config_global !== 'true' && !process.env.FORCE_MC_BUILD) process.exit(0);

const ROOT = path.dirname(__dirname); // package root
const isMac = os.platform() === 'darwin';
const isLinux = os.platform() === 'linux';

const BLUE   = '\x1b[34m';
const GREEN  = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED    = '\x1b[31m';
const BOLD   = '\x1b[1m';
const RESET  = '\x1b[0m';

const info    = (msg) => process.stdout.write(`${BLUE}▸${RESET} ${msg}\n`);
const success = (msg) => process.stdout.write(`${GREEN}✓${RESET} ${msg}\n`);
const warn    = (msg) => process.stdout.write(`${YELLOW}⚠${RESET} ${msg}\n`);
const err     = (msg) => { process.stderr.write(`${RED}✗${RESET} ${msg}\n`); process.exit(1); };

function run(cmd, cwd = ROOT, label = cmd) {
  const result = spawnSync(cmd, { shell: true, cwd, stdio: 'pipe', encoding: 'utf-8' });
  if (result.status !== 0) {
    warn(`${label} failed (non-fatal): ${(result.stderr || '').slice(0, 200)}`);
    return false;
  }
  return true;
}

// ── Verify node-gyp is available ──────────────────────────────────────────
(function checkNodeGyp() {
  const result = spawnSync('node', ['-e', "require('node-gyp')"], { stdio: 'pipe' });
  if (result.status !== 0) {
    warn("node-gyp not found — native modules (keychain support) may not compile. On macOS run: xcode-select --install");
  }
})();

console.log(`\n${BOLD}Mission Control${RESET} — setting up... (this takes 1–3 minutes)\n`);

// ── Build MCP servers ──────────────────────────────────────────────────────
const mcpServers = ['mission-control-db-mcp', 'memory-mcp', 'cron-mcp'];
for (const server of mcpServers) {
  const dir = path.join(ROOT, 'tools', server);
  if (!existsSync(dir)) continue;
  info(`Building ${server}...`);
  run('npm ci --prefer-offline 2>/dev/null || npm install --no-audit', dir, `npm install ${server}`);
  run('npm run build', dir, `build ${server}`);
  success(server);
}

// ── Build Next.js app ──────────────────────────────────────────────────────
info('Building dashboard (Next.js)...');
process.env.NEXT_TELEMETRY_DISABLED = '1';

const buildResult = spawnSync('node', ['node_modules/.bin/next', 'build'], {
  cwd: ROOT,
  stdio: 'inherit',
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
});

if (buildResult.status !== 0) {
  warn('Next.js build failed — run `mission-control build` to retry');
} else {
  success('Dashboard built');
}

// ── Done ───────────────────────────────────────────────────────────────────
console.log(`\n${BOLD}${GREEN}✓ Build complete.${RESET}\n`);
console.log(`  Run ${BOLD}mission-control${RESET} to set up and launch.\n`);
