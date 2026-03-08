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

// ── Install QMD memory search tool ────────────────────────────────────────
function installQmd() {
  const qmdPaths = ['/opt/homebrew/bin/qmd', '/usr/local/bin/qmd'];
  const alreadyInstalled = qmdPaths.some(p => existsSync(p)) ||
    spawnSync('which qmd', { shell: true, stdio: 'pipe' }).status === 0;

  if (alreadyInstalled) {
    success('qmd already installed');
    return;
  }

  const brewCheck = spawnSync('which brew', { shell: true, stdio: 'pipe' });
  if (brewCheck.status !== 0) {
    warn('Homebrew not found — install qmd manually for full memory search: brew install profroggo/tap/qmd');
    return;
  }

  info('Installing qmd memory search tool...');
  const brewResult = spawnSync('brew install profroggo/tap/qmd', { shell: true, stdio: 'pipe', encoding: 'utf-8' });
  if (brewResult.status === 0) {
    success('qmd installed');
  } else {
    warn('qmd install failed — memory search will use ripgrep fallback. Install manually: brew install profroggo/tap/qmd');
  }
}

installQmd();

// ── Install Obsidian ──────────────────────────────────────────────────────
function installObsidian() {
  if (isMac) {
    const alreadyInstalled = existsSync('/Applications/Obsidian.app');
    if (alreadyInstalled) {
      success('Obsidian already installed');
      return;
    }

    const brewCheck = spawnSync('which brew', { shell: true, stdio: 'pipe' });
    if (brewCheck.status !== 0) {
      warn('Could not auto-install Obsidian. Download from https://obsidian.md and open ~/mission-control/memory as a vault.');
      return;
    }

    info('Installing Obsidian...');
    const result = spawnSync('brew install --cask obsidian', { shell: true, stdio: 'pipe', encoding: 'utf-8' });
    if (result.status === 0) {
      success('Obsidian installed');
      spawnSync(`open -a Obsidian "${os.homedir()}/mission-control/memory"`, { shell: true, stdio: 'pipe' });
    } else {
      warn('Could not auto-install Obsidian. Download from https://obsidian.md and open ~/mission-control/memory as a vault.');
    }
  } else if (isLinux) {
    const alreadyInstalled = spawnSync('which obsidian', { shell: true, stdio: 'pipe' }).status === 0 ||
      existsSync('/snap/bin/obsidian');
    if (alreadyInstalled) {
      success('Obsidian already installed');
      return;
    }

    info('Installing Obsidian via snap...');
    const result = spawnSync('snap install obsidian --classic', { shell: true, stdio: 'pipe', encoding: 'utf-8' });
    if (result.status === 0) {
      success('Obsidian installed');
    } else {
      warn('Could not auto-install Obsidian. Download from https://obsidian.md');
    }
  }
}

installObsidian();

// ── Rebuild native addons for current Node.js version ──────────────────────
info('Rebuilding native modules for Node.js ' + process.version + '...');
// Use 'inherit' so failures are visible; npm rebuild finds nested .pnpm packages automatically
for (const mod of ['better-sqlite3', 'keytar']) {
  const result = spawnSync('npm', ['rebuild', mod], {
    cwd: ROOT, shell: true, stdio: 'inherit',
  });
  if (result.status === 0) {
    success(`${mod} compiled`);
  } else {
    warn(`${mod} rebuild failed — the app may not start correctly. Try: npm rebuild ${mod} in the install directory`);
  }
}

// ── Build Next.js app ──────────────────────────────────────────────────────
info('Building dashboard (Next.js)...');
process.env.NEXT_TELEMETRY_DISABLED = '1';

// Use the actual Next.js JS entry point — avoids the shell wrapper which
// may fail if node isn't on PATH in the spawn context
const nextScript = path.join(ROOT, 'node_modules', 'next', 'dist', 'bin', 'next');
const buildResult = spawnSync(process.execPath, [nextScript, 'build'], {
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
