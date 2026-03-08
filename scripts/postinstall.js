#!/usr/bin/env node
/**
 * scripts/postinstall.js
 * Runs automatically after `npm install -g froggo-mission-control`.
 * Compiles MCP servers and builds the Next.js app.
 * No user interaction — just build steps.
 */

const { execSync, spawnSync } = require('child_process');
const { existsSync, mkdirSync, realpathSync } = require('fs');
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
// npm can place packages in node_modules/ (as a symlink to .pnpm/) or in .ignored/.
// We resolve BOTH the symlink target (real physical dir) and use require.resolve(),
// then run node-gyp rebuild in the real directory so the .node binary ends up
// where Node.js will actually find it at runtime.
info('Rebuilding native modules for Node.js ' + process.version + '...');

// Find node-gyp — search common locations across npm and pnpm layouts
function findNodeGyp() {
  const candidates = [
    path.join(ROOT, 'node_modules', 'node-gyp', 'bin', 'node-gyp.js'),
    path.join(ROOT, 'node_modules', '.pnpm', 'node-gyp@12.2.0', 'node_modules', 'node-gyp', 'bin', 'node-gyp.js'),
  ];
  // Also search dynamically in .pnpm for any node-gyp version
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

const nodeGypBin = findNodeGyp();

for (const mod of ['better-sqlite3', 'keytar']) {
  // resolve() follows symlinks — gives us the real physical dir in .pnpm/
  let modDir = null;
  try {
    const resolved = require.resolve(`${mod}/package.json`, { paths: [ROOT] });
    modDir = path.dirname(realpathSync(resolved));
  } catch {
    // Fall back to symlink path if realpathSync fails
    try {
      modDir = path.dirname(require.resolve(`${mod}/package.json`, { paths: [ROOT] }));
    } catch {
      warn(`${mod} not found in node_modules — skipping`);
      continue;
    }
  }

  if (!nodeGypBin) {
    warn(`node-gyp not found — skipping ${mod} rebuild. Run: npm rebuild ${mod}`);
    continue;
  }

  info(`Rebuilding ${mod} at ${modDir}...`);
  const result = spawnSync(process.execPath, [nodeGypBin, 'rebuild'], {
    cwd: modDir,
    stdio: 'inherit',
    env: { ...process.env, npm_config_node_gyp: nodeGypBin },
  });

  if (result.status === 0) {
    success(`${mod} compiled`);
  } else {
    // Fallback: npm rebuild (targets all locations)
    const r2 = spawnSync(process.execPath, [
      path.join(ROOT, 'node_modules', 'npm', 'bin', 'npm-cli.js'),
      'rebuild', mod,
    ], { cwd: ROOT, stdio: 'inherit' });
    if (r2.status !== 0) {
      warn(`${mod} rebuild failed — run: cd ${modDir} && node-gyp rebuild`);
    } else {
      success(`${mod} compiled (via npm rebuild)`);
    }
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
