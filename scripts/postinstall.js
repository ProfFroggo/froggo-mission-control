#!/usr/bin/env node
// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
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
// Skip when installed as a local dev/peer dependency (not a global install).
// npm_config_global is unreliable across npm versions — use install path as
// the authoritative signal: global installs always live under .../lib/node_modules/
const ROOT_CHECK = path.dirname(__dirname);
const isGlobalInstall = process.env.npm_config_global === 'true'
  || ROOT_CHECK.includes(path.join('lib', 'node_modules'));
if (!isGlobalInstall && !process.env.FORCE_MC_BUILD) process.exit(0);

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
  run('npm install --no-audit --prefer-offline', dir, `npm install ${server}`);
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

// ── Fix native addon locations ──────────────────────────────────────────────
// npm with pnpm layout places packages in node_modules/.pnpm/<pkg>/node_modules/<pkg>/
// but prebuild-install downloads prebuilt binaries into node_modules/.ignored/<pkg>/
// The .pnpm/ path is what require() uses at runtime, so binaries must live there.
// Strategy: copy from .ignored/ if available (same ABI), else rebuild with node-gyp.
info('Setting up native modules for Node.js ' + process.version + '...');

// Find node-gyp — search common locations across npm and pnpm layouts
function findNodeGyp() {
  const candidates = [
    path.join(ROOT, 'node_modules', 'node-gyp', 'bin', 'node-gyp.js'),
  ];
  const pnpmDir = path.join(ROOT, 'node_modules', '.pnpm');
  if (existsSync(pnpmDir)) {
    try {
      const entries = require('fs').readdirSync(pnpmDir).filter(e => e.startsWith('node-gyp@'));
      for (const e of entries) {
        candidates.push(path.join(pnpmDir, e, 'node_modules', 'node-gyp', 'bin', 'node-gyp.js'));
      }
    } catch { /* ignore */ }
  }
  return candidates.find(c => existsSync(c)) ?? null;
}

// Check if a .node file is loadable for the current Node ABI
function nodeFileLoads(nodePath) {
  try {
    process.dlopen({ exports: {} }, nodePath);
    return true;
  } catch { return false; }
}

// Find the .node binding file in a package dir by searching build/Release/, build/Debug/, etc.
function findNodeFile(dir) {
  const candidates = [
    path.join(dir, 'build', 'Release'),
    path.join(dir, 'build', 'Debug'),
    path.join(dir, 'build'),
    path.join(dir, 'out', 'Release'),
    path.join(dir, 'Release'),
  ];
  for (const d of candidates) {
    if (!existsSync(d)) continue;
    try {
      const files = require('fs').readdirSync(d).filter(f => f.endsWith('.node'));
      if (files.length) return path.join(d, files[0]);
    } catch { /* ignore */ }
  }
  return null;
}

const nodeGypBin = findNodeGyp();
const { copyFileSync } = require('fs');

for (const mod of ['better-sqlite3', 'keytar']) {
  // Find the target dir — where require() looks at runtime (node_modules/.pnpm/...)
  let targetDir = null;
  try {
    targetDir = path.dirname(require.resolve(`${mod}/package.json`, { paths: [ROOT] }));
  } catch {
    warn(`${mod} not found in node_modules — skipping`);
    continue;
  }

  // Where the binding should live (where bindings package will find it)
  const targetBinding = path.join(targetDir, 'build', 'Release', `${mod.replace(/-/g, '_')}.node`);

  // Already in the right place?
  if (existsSync(targetBinding) && nodeFileLoads(targetBinding)) {
    success(`${mod} ready`);
    continue;
  }

  info(`Setting up ${mod}...`);

  // Strategy 1: copy prebuilt binary from .ignored/ (placed there by prebuild-install)
  const ignoredDir = path.join(ROOT, 'node_modules', '.ignored', mod);
  const ignoredBinding = findNodeFile(ignoredDir);
  if (ignoredBinding && nodeFileLoads(ignoredBinding)) {
    try {
      mkdirSync(path.dirname(targetBinding), { recursive: true });
      copyFileSync(ignoredBinding, targetBinding);
      if (existsSync(targetBinding) && nodeFileLoads(targetBinding)) {
        success(`${mod} ready (prebuilt)`);
        continue;
      }
    } catch { /* fall through to rebuild */ }
  }

  // Strategy 2: rebuild with node-gyp
  if (!nodeGypBin) {
    warn(`node-gyp not found — ${mod} may not work. Run: cd "${targetDir}" && node-gyp rebuild`);
    continue;
  }

  const result = spawnSync(process.execPath, [nodeGypBin, 'rebuild'], {
    cwd: targetDir,
    stdio: 'pipe',
    env: { ...process.env, npm_config_node_gyp: nodeGypBin },
  });

  if (result.status === 0 && existsSync(targetBinding) && nodeFileLoads(targetBinding)) {
    success(`${mod} compiled`);
  } else {
    warn(`${mod} setup failed — run manually: cd "${targetDir}" && node-gyp rebuild`);
  }
}

// ── Build Next.js app ──────────────────────────────────────────────────────
// Always wipe any stale .next/ before building — prevents old CI-built or
// partial builds from a previous version surviving an npm upgrade
const nextBuildDir = path.join(ROOT, '.next');
if (existsSync(nextBuildDir)) {
  require('fs').rmSync(nextBuildDir, { recursive: true, force: true });
}

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
