#!/usr/bin/env node
/**
 * bin/cli.js — Mission Control CLI
 *
 * Commands:
 *   mission-control           → setup (first run) or status
 *   mission-control setup     → interactive first-run wizard
 *   mission-control start     → start the server
 *   mission-control stop      → stop the server
 *   mission-control restart   → restart the server
 *   mission-control status    → show health and running state
 *   mission-control logs      → tail the log file
 *   mission-control build     → rebuild app + MCP servers
 *   mission-control update    → npm update -g + rebuild
 *   mission-control open      → open in browser
 *   mission-control config    → show current config
 */

'use strict';

const { execSync, spawnSync, spawn } = require('child_process');
const { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync } = require('fs');
const path   = require('path');
const os     = require('os');
const https  = require('https');
const http   = require('http');
const readline = require('readline');

// ── Colours ──────────────────────────────────────────────────────────────────
const c = {
  red:    s => `\x1b[31m${s}\x1b[0m`,
  green:  s => `\x1b[32m${s}\x1b[0m`,
  yellow: s => `\x1b[33m${s}\x1b[0m`,
  blue:   s => `\x1b[34m${s}\x1b[0m`,
  cyan:   s => `\x1b[36m${s}\x1b[0m`,
  bold:   s => `\x1b[1m${s}\x1b[0m`,
  dim:    s => `\x1b[2m${s}\x1b[0m`,
};

const info    = (msg) => console.log(`${c.blue('▸')} ${msg}`);
const success = (msg) => console.log(`${c.green('✓')} ${msg}`);
const warn    = (msg) => console.log(`${c.yellow('⚠')} ${msg}`);
const fail    = (msg) => { console.error(`${c.red('✗')} ${msg}`); process.exit(1); };
const step    = (msg) => console.log(`\n${c.bold(c.blue(`── ${msg} ──`))}`);
const header  = (msg) => {
  const line = '═'.repeat(msg.length + 4);
  console.log(`\n${c.bold(`╔${line}╗`)}`);
  console.log(`${c.bold(`║  ${msg}  ║`)}`);
  console.log(`${c.bold(`╚${line}╝`)}\n`);
};

// ── Paths ────────────────────────────────────────────────────────────────────
const INSTALL_DIR = path.dirname(__dirname);          // where this package lives
const HOME        = os.homedir();
const MC_HOME     = path.join(HOME, 'mission-control');
const MC_DATA     = path.join(MC_HOME, 'data');
const MC_MEMORY   = path.join(MC_HOME, 'memory');
const MC_LIBRARY  = path.join(MC_HOME, 'library');
const MC_AGENTS   = path.join(MC_HOME, 'agents');
const MC_LOGS     = path.join(MC_HOME, 'logs');
const ENV_FILE    = path.join(INSTALL_DIR, '.env');
const LOG_FILE    = path.join(HOME, 'Library', 'Logs', 'mission-control-app.plist');
const LAUNCHAGENT = path.join(HOME, 'Library', 'LaunchAgents', 'com.mission-control.app.plist');
const SYSTEMD_SVC = path.join(HOME, '.config', 'systemd', 'user', 'mission-control.service');
const IS_MAC      = os.platform() === 'darwin';
const IS_LINUX    = os.platform() === 'linux';

// ── Helpers ──────────────────────────────────────────────────────────────────
function prompt(question, defaultVal = '') {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    const hint = defaultVal ? c.dim(` [${defaultVal}]`) : '';
    rl.question(`  ${question}${hint}: `, answer => {
      rl.close();
      resolve(answer.trim() || defaultVal);
    });
  });
}

function promptSecret(question) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    // Disable echo
    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    rl.question(`  ${question}: `, answer => {
      if (process.stdin.isTTY) process.stdin.setRawMode(false);
      rl.close();
      process.stdout.write('\n');
      resolve(answer.trim());
    });
  });
}

function findClaudeBin() {
  if (process.env.CLAUDE_BIN && existsSync(process.env.CLAUDE_BIN)) return process.env.CLAUDE_BIN;
  try {
    const found = execSync('which claude 2>/dev/null', { encoding: 'utf-8', timeout: 3000 }).trim();
    if (found && existsSync(found)) return found;
  } catch {}
  const candidates = [
    '/usr/local/bin/claude',
    path.join(HOME, '.npm-global', 'bin', 'claude'),
    path.join(HOME, '.local', 'bin', 'claude'),
    '/opt/homebrew/bin/claude',
  ];
  return candidates.find(f => existsSync(f)) || 'claude';
}

function getPort() {
  return parseInt(process.env.PORT || '3000', 10);
}

function isRunning(port) {
  try {
    execSync(`lsof -ti:${port}`, { stdio: 'pipe' });
    return true;
  } catch { return false; }
}

function checkHealth(port) {
  return new Promise(resolve => {
    const req = http.get(`http://localhost:${port}/api/health`, { timeout: 3000 }, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

async function waitForServer(port, maxSecs = 60) {
  for (let i = 0; i < maxSecs; i++) {
    const health = await checkHealth(port);
    if (health) return health;
    await new Promise(r => setTimeout(r, 1000));
    process.stdout.write('.');
  }
  return null;
}

function openBrowser(url) {
  if (IS_MAC) execSync(`open "${url}"`, { stdio: 'ignore' });
  else if (IS_LINUX) execSync(`xdg-open "${url}" 2>/dev/null || true`, { stdio: 'ignore' });
}

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  const lines = readFileSync(filePath, 'utf-8').split('\n');
  const env = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return env;
}

// ── Commands ─────────────────────────────────────────────────────────────────

async function cmdSetup(force = false) {
  const isFirstRun = !existsSync(ENV_FILE);

  if (!isFirstRun && !force) {
    info('Mission Control is already configured.');
    info('Run ' + c.bold('mission-control status') + ' to check it, or');
    info(c.bold('mission-control setup --force') + ' to reconfigure.');
    return;
  }

  header('Mission Control Setup');
  console.log('  This wizard sets up your persistent local AI agent platform.\n');

  // ── Check Claude CLI ────────────────────────────────────────────────────
  step('Prerequisites');
  const claudeBin = findClaudeBin();
  if (claudeBin === 'claude' && !existsSync('/usr/local/bin/claude')) {
    warn('Claude Code CLI not found in PATH.');
    const install = await prompt('Install Claude Code CLI now? (requires npm)', 'y');
    if (install.toLowerCase() === 'y') {
      info('Installing @anthropic-ai/claude-code...');
      const r = spawnSync('npm', ['install', '-g', '@anthropic-ai/claude-code'], { stdio: 'inherit' });
      if (r.status !== 0) fail('Install failed. Run: npm install -g @anthropic-ai/claude-code');
    } else {
      warn('Claude CLI required for agents. Add it later and re-run setup.');
    }
  } else {
    success(`Claude Code CLI: ${claudeBin}`);
  }

  // Node version check
  const nodeMaj = parseInt(process.versions.node.split('.')[0], 10);
  if (nodeMaj < 20) fail(`Node.js 20+ required (found ${process.versions.node}). Upgrade at https://nodejs.org`);
  success(`Node.js ${process.versions.node}`);

  // ── API Keys ────────────────────────────────────────────────────────────
  step('API Keys');
  console.log('  Mission Control needs API keys to unlock all features.');
  console.log('  Press Enter to skip any — add them later in Settings → API Keys.\n');

  const existingEnv = parseEnvFile(ENV_FILE);

  console.log(c.bold('  Gemini API Key') + c.dim(' — required for Voice'));
  console.log(c.dim('  Free at: https://aistudio.google.com/app/apikey'));
  const geminiKey = await prompt('Gemini API Key', existingEnv.GEMINI_API_KEY || '');

  console.log('');
  console.log(c.bold('  Anthropic API Key') + c.dim(' — optional if using Claude Code CLI subscription'));
  console.log(c.dim('  Get at: https://console.anthropic.com/'));
  const anthropicKey = await prompt('Anthropic API Key (press Enter to skip)', existingEnv.ANTHROPIC_API_KEY || '');

  const port = await prompt('Port', existingEnv.PORT || '3000');

  // ── Create directories ──────────────────────────────────────────────────
  step('Creating directory structure');
  const dirs = [
    MC_DATA,
    path.join(MC_MEMORY, 'agents'),
    path.join(MC_MEMORY, 'knowledge'),
    path.join(MC_MEMORY, 'sessions'),
    path.join(MC_MEMORY, 'daily'),
    path.join(MC_MEMORY, 'templates'),
    path.join(MC_LIBRARY, 'code'),
    path.join(MC_LIBRARY, 'design', 'ui'),
    path.join(MC_LIBRARY, 'design', 'images'),
    path.join(MC_LIBRARY, 'design', 'media'),
    path.join(MC_LIBRARY, 'docs', 'research'),
    path.join(MC_LIBRARY, 'docs', 'presentations'),
    path.join(MC_LIBRARY, 'docs', 'strategies'),
    MC_AGENTS,
    MC_LOGS,
    path.join(HOME, 'Library', 'Logs'),
  ];
  for (const d of dirs) {
    try { mkdirSync(d, { recursive: true }); } catch {}
  }
  success('~/mission-control/ directory tree created');

  // ── Obsidian vault skeleton ─────────────────────────────────────────────
  const obsidianDir = path.join(MC_MEMORY, '.obsidian');
  mkdirSync(obsidianDir, { recursive: true });
  if (!existsSync(path.join(obsidianDir, 'app.json'))) {
    writeFileSync(path.join(obsidianDir, 'app.json'), JSON.stringify({
      useMarkdownLinks: false,
      newFileFolderPath: 'daily',
      defaultViewMode: 'source',
    }, null, 2));
  }
  if (!existsSync(path.join(MC_MEMORY, 'Home.md'))) {
    writeFileSync(path.join(MC_MEMORY, 'Home.md'), [
      '# Mission Control Memory Vault',
      '',
      'This is your agent memory vault — agents read and write here across sessions.',
      '',
      '## Structure',
      '- `agents/` — per-agent memory files',
      '- `knowledge/` — knowledge base articles',
      '- `sessions/` — session logs',
      '- `daily/` — daily notes',
      '',
      'Open in Obsidian: **File → Open Vault → Select this folder**',
    ].join('\n'));
  }
  success('Memory vault ready');

  // ── Write .env ──────────────────────────────────────────────────────────
  step('Writing configuration');
  const resolvedClaude = findClaudeBin();
  const envContent = [
    '# Mission Control — generated by mission-control setup',
    `# Edit freely — re-run \`mission-control setup\` to reset`,
    '',
    '# Paths',
    `MC_DB_PATH=${MC_DATA}/mission-control.db`,
    `VAULT_PATH=${MC_MEMORY}`,
    `LIBRARY_PATH=${MC_LIBRARY}`,
    `PROJECT_DIR=${INSTALL_DIR}`,
    `LOG_DIR=${MC_LOGS}`,
    '',
    '# Claude Code CLI',
    `CLAUDE_BIN=${resolvedClaude}`,
    'CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1',
    'CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING=1',
    '',
    '# API Keys',
    `GEMINI_API_KEY=${geminiKey}`,
    `ANTHROPIC_API_KEY=${anthropicKey}`,
    '',
    '# Models',
    'MODEL_LEAD=claude-opus-4-6',
    'MODEL_WORKER=claude-sonnet-4-6',
    'MODEL_TRIVIAL=claude-haiku-4-5-20251001',
    '',
    '# Server',
    `PORT=${port}`,
    'TMUX_SESSION=mission-control',
    'NEXT_TELEMETRY_DISABLED=1',
  ].join('\n');
  writeFileSync(ENV_FILE, envContent);
  success('.env written');

  // ── Generate .claude/settings.json from template ────────────────────────
  const templatePath = path.join(INSTALL_DIR, '.claude', 'settings.json.template');
  const settingsPath = path.join(INSTALL_DIR, '.claude', 'settings.json');
  if (existsSync(templatePath)) {
    const qmdBin = ['/opt/homebrew/bin/qmd', '/usr/local/bin/qmd', path.join(HOME, '.npm-global', 'bin', 'qmd')]
      .find(f => existsSync(f)) || '';
    let content = readFileSync(templatePath, 'utf-8')
      .replace(/\{\{PROJECT_ROOT\}\}/g, INSTALL_DIR)
      .replace(/\{\{HOME\}\}/g, HOME);
    if (qmdBin) {
      content = content.replace(/\{\{QMD_BIN\}\}/g, qmdBin);
    } else {
      // Remove QMD_BIN line entirely if not installed
      content = content.replace(/,?\s*"QMD_BIN":\s*"[^"]*"/g, '');
    }
    writeFileSync(settingsPath, content);
    success('.claude/settings.json generated');
  }

  // ── Generate .mcp.json ──────────────────────────────────────────────────
  const mcpConfig = {
    mcpServers: {
      'mission-control-db': {
        command: 'node',
        args: [path.join(INSTALL_DIR, 'tools', 'mission-control-db-mcp', 'dist', 'index.js')],
        env: { DB_PATH: `${MC_DATA}/mission-control.db` },
      },
      memory: {
        command: 'node',
        args: [path.join(INSTALL_DIR, 'tools', 'memory-mcp', 'dist', 'index.js')],
        env: { VAULT_PATH: MC_MEMORY, LOG_DIR: MC_LOGS },
      },
      cron: {
        command: 'node',
        args: [path.join(INSTALL_DIR, 'tools', 'cron-mcp', 'dist', 'index.js')],
        env: { SCHEDULE_PATH: `${MC_DATA}/schedule.json` },
      },
    },
  };
  writeFileSync(path.join(INSTALL_DIR, '.mcp.json'), JSON.stringify(mcpConfig, null, 2));
  success('.mcp.json generated');

  // ── Install persistent service ──────────────────────────────────────────
  step('Installing persistent service (auto-start at login)');
  const nodeBin = process.execPath;
  const nextBin = path.join(INSTALL_DIR, 'node_modules', '.bin', 'next');
  const logPath  = path.join(HOME, 'Library', 'Logs', 'mission-control-app.log');

  const envVars = {
    HOME,
    CLAUDE_BIN: resolvedClaude,
    MC_DB_PATH: `${MC_DATA}/mission-control.db`,
    VAULT_PATH: MC_MEMORY,
    LIBRARY_PATH: MC_LIBRARY,
    PROJECT_DIR: INSTALL_DIR,
    LOG_DIR: MC_LOGS,
    GEMINI_API_KEY: geminiKey,
    ANTHROPIC_API_KEY: anthropicKey,
    CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: '1',
    CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING: '1',
    MODEL_LEAD: 'claude-opus-4-6',
    MODEL_WORKER: 'claude-sonnet-4-6',
    MODEL_TRIVIAL: 'claude-haiku-4-5-20251001',
    PORT: port,
    NEXT_TELEMETRY_DISABLED: '1',
  };

  if (IS_MAC) {
    mkdirSync(path.join(HOME, 'Library', 'LaunchAgents'), { recursive: true });
    mkdirSync(path.join(HOME, 'Library', 'Logs'), { recursive: true });

    const envDict = Object.entries(envVars)
      .map(([k, v]) => `    <key>${k}</key>\n    <string>${v}</string>`)
      .join('\n');

    const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.mission-control.app</string>
  <key>ProgramArguments</key>
  <array>
    <string>${nodeBin}</string>
    <string>${nextBin}</string>
    <string>start</string>
    <string>--port</string>
    <string>${port}</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${INSTALL_DIR}</string>
  <key>EnvironmentVariables</key>
  <dict>
${envDict}
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${logPath}</string>
  <key>StandardErrorPath</key>
  <string>${logPath}</string>
</dict>
</plist>`;

    writeFileSync(LAUNCHAGENT, plist);
    try { execSync(`launchctl unload "${LAUNCHAGENT}" 2>/dev/null || true`, { stdio: 'pipe' }); } catch {}
    execSync(`launchctl load -w "${LAUNCHAGENT}"`, { stdio: 'pipe' });
    success('LaunchAgent installed — starts automatically at login');
    info(`Logs: ${logPath}`);

  } else if (IS_LINUX) {
    const svcDir = path.dirname(SYSTEMD_SVC);
    mkdirSync(svcDir, { recursive: true });
    const envLines = Object.entries(envVars).map(([k, v]) => `Environment=${k}=${v}`).join('\n');
    const service = `[Unit]
Description=Mission Control Platform
After=network.target

[Service]
Type=simple
WorkingDirectory=${INSTALL_DIR}
ExecStart=${nodeBin} ${nextBin} start --port ${port}
Restart=always
RestartSec=5
${envLines}
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=default.target
`;
    writeFileSync(SYSTEMD_SVC, service);
    spawnSync('systemctl', ['--user', 'daemon-reload'], { stdio: 'pipe' });
    spawnSync('systemctl', ['--user', 'enable', 'mission-control.service'], { stdio: 'pipe' });
    spawnSync('systemctl', ['--user', 'start', 'mission-control.service'], { stdio: 'pipe' });
    success('systemd service installed and started');
  } else {
    warn(`Platform: ${os.platform()} — auto-start not supported. Use \`mission-control start\` manually.`);
  }

  // ── Start and open ──────────────────────────────────────────────────────
  step('Launching Mission Control');
  info(`Waiting for server on port ${port}...`);
  const health = await waitForServer(parseInt(port, 10), 60);
  console.log('');

  if (health) {
    success(`Running at http://localhost:${port}`);
    openBrowser(`http://localhost:${port}`);
  } else {
    warn('Server did not respond — check logs:');
    if (IS_MAC) info(`tail -f ${logPath}`);
  }

  // ── Final summary ───────────────────────────────────────────────────────
  console.log('');
  console.log(c.bold(c.green('╔══════════════════════════════════════╗')));
  console.log(c.bold(c.green('║   Mission Control is ready           ║')));
  console.log(c.bold(c.green('╚══════════════════════════════════════╝')));
  console.log('');
  console.log(`  ${c.bold('Dashboard:')}  http://localhost:${port}`);
  console.log(`  ${c.bold('Data:')}       ~/mission-control/`);
  console.log(`  ${c.bold('Platform:')}   ${INSTALL_DIR}`);
  console.log('');
  console.log(`  ${c.bold('Next steps:')}`);
  console.log(`    1. Connect Google Workspace in the setup wizard`);
  console.log(`    2. Browse the Agents Catalog → hire your team`);
  console.log(`    3. Install modules from the Modules Library`);
  console.log('');
  if (!geminiKey) console.log(`  ${c.yellow('Voice:')} add Gemini API key in Settings → Voice`);
  console.log(`  ${c.dim('mission-control status   — check health')}`);
  console.log(`  ${c.dim('mission-control stop     — stop the server')}`);
  console.log(`  ${c.dim('mission-control logs     — view logs')}`);
  console.log('');
}

async function cmdStart() {
  const port = getPort();
  if (isRunning(port)) {
    const h = await checkHealth(port);
    if (h) { success(`Already running at http://localhost:${port}`); return; }
  }
  if (!existsSync(ENV_FILE)) {
    fail('Not configured yet. Run: mission-control setup');
  }
  info('Starting Mission Control...');
  if (IS_MAC && existsSync(LAUNCHAGENT)) {
    execSync(`launchctl load -w "${LAUNCHAGENT}" 2>/dev/null || launchctl start com.mission-control.app`, { stdio: 'pipe' });
  } else if (IS_LINUX && existsSync(SYSTEMD_SVC)) {
    spawnSync('systemctl', ['--user', 'start', 'mission-control.service'], { stdio: 'inherit' });
  } else {
    // Direct start
    const proc = spawn(process.execPath, [path.join(INSTALL_DIR, 'node_modules', '.bin', 'next'), 'start'], {
      cwd: INSTALL_DIR,
      detached: true,
      stdio: 'ignore',
      env: { ...process.env, ...parseEnvFile(ENV_FILE) },
    });
    proc.unref();
    info(`Started (PID ${proc.pid})`);
  }
  const health = await waitForServer(port, 30);
  console.log('');
  if (health) success(`Running at http://localhost:${port}`);
  else warn('Server slow to start — check: mission-control logs');
}

async function cmdStop() {
  info('Stopping Mission Control...');
  if (IS_MAC && existsSync(LAUNCHAGENT)) {
    try { execSync('launchctl stop com.mission-control.app', { stdio: 'pipe' }); } catch {}
    success('Stopped (LaunchAgent will restart it — to disable: launchctl unload ' + LAUNCHAGENT + ')');
  } else if (IS_LINUX && existsSync(SYSTEMD_SVC)) {
    spawnSync('systemctl', ['--user', 'stop', 'mission-control.service'], { stdio: 'inherit' });
    success('Stopped');
  } else {
    const port = getPort();
    try {
      const pid = execSync(`lsof -ti:${port}`, { encoding: 'utf-8' }).trim();
      if (pid) { execSync(`kill ${pid}`); success(`Killed PID ${pid}`); }
      else warn('No process found on port ' + port);
    } catch { warn('Could not find process'); }
  }
}

async function cmdRestart() {
  await cmdStop();
  await new Promise(r => setTimeout(r, 1500));
  await cmdStart();
}

async function cmdStatus() {
  const port = getPort();
  const running = isRunning(port);
  const health  = running ? await checkHealth(port) : null;

  console.log('');
  console.log(c.bold('Mission Control Status'));
  console.log('─'.repeat(40));
  console.log(`  Server:   ${health ? c.green('running') : (running ? c.yellow('starting') : c.red('stopped'))}`);
  console.log(`  URL:      http://localhost:${port}`);
  if (health) {
    console.log(`  CLI:      ${health.cli ? c.green('ok') : c.red('missing')}`);
    console.log(`  Database: ${health.database ? c.green('ok') : c.red('error')}`);
  }
  console.log(`  Config:   ${existsSync(ENV_FILE) ? c.green('configured') : c.yellow('not set up')}`);
  console.log(`  Data:     ${MC_HOME}`);
  console.log(`  Platform: ${INSTALL_DIR}`);
  if (IS_MAC) {
    const agentRunning = (() => { try { execSync('launchctl list com.mission-control.app', { stdio: 'pipe' }); return true; } catch { return false; } })();
    console.log(`  Service:  ${agentRunning ? c.green('LaunchAgent active') : c.dim('no LaunchAgent')}`);
  }
  console.log('');
  if (!health && !running) {
    console.log(`  Run ${c.bold('mission-control start')} to start the server.`);
    if (!existsSync(ENV_FILE)) console.log(`  Run ${c.bold('mission-control setup')} first to configure.`);
  }
  console.log('');
}

function cmdLogs() {
  const logPath = path.join(HOME, 'Library', 'Logs', 'mission-control-app.log');
  if (IS_MAC && existsSync(logPath)) {
    info(`Tailing ${logPath} (Ctrl+C to exit)`);
    const proc = spawn('tail', ['-f', logPath], { stdio: 'inherit' });
    proc.on('error', () => fail(`Cannot tail ${logPath}`));
  } else if (IS_LINUX) {
    const proc = spawn('journalctl', ['--user', '-fu', 'mission-control'], { stdio: 'inherit' });
    proc.on('error', () => fail('journalctl not available'));
  } else {
    fail('Logs: ' + logPath);
  }
}

async function cmdBuild() {
  info('Rebuilding Mission Control...');
  process.env.NEXT_TELEMETRY_DISABLED = '1';
  const r = spawnSync(process.execPath, ['scripts/postinstall.js'], {
    cwd: INSTALL_DIR,
    stdio: 'inherit',
    env: { ...process.env, npm_config_global: 'true' },
  });
  if (r.status !== 0) fail('Build failed');
  success('Build complete');
}

async function cmdUpdate() {
  info('Updating froggo-mission-control...');
  const r = spawnSync('npm', ['update', '-g', 'froggo-mission-control'], { stdio: 'inherit' });
  if (r.status !== 0) fail('Update failed');
  // Rebuild with new files
  await cmdBuild();
  await cmdRestart();
  success('Updated and restarted');
}

function cmdOpen() {
  const port = getPort();
  openBrowser(`http://localhost:${port}`);
  info(`Opening http://localhost:${port}`);
}

function cmdConfig() {
  console.log('');
  console.log(c.bold('Current Configuration'));
  console.log('─'.repeat(40));
  const env = parseEnvFile(ENV_FILE);
  const show = (k, v) => console.log(`  ${k.padEnd(22)} ${v ? c.green(v) : c.dim('not set')}`);
  show('Install dir:', INSTALL_DIR);
  show('Data dir:', MC_HOME);
  show('Port:', env.PORT || '3000');
  show('Claude CLI:', env.CLAUDE_BIN || 'auto-detect');
  show('Gemini API Key:', env.GEMINI_API_KEY ? '****' + env.GEMINI_API_KEY.slice(-4) : '');
  show('Anthropic Key:', env.ANTHROPIC_API_KEY ? '****' + env.ANTHROPIC_API_KEY.slice(-4) : '');
  show('Model (Lead):', env.MODEL_LEAD || 'claude-opus-4-6');
  show('Model (Worker):', env.MODEL_WORKER || 'claude-sonnet-4-6');
  console.log('');
  console.log(`  Edit: ${c.dim(ENV_FILE)}`);
  console.log('');
}

function cmdHelp() {
  console.log(`
${c.bold('Mission Control')} — self-hosted AI agent platform for Claude Code CLI

${c.bold('USAGE')}
  mission-control [command]

${c.bold('COMMANDS')}
  (no command)     Setup wizard on first run, or show status
  setup            Run the interactive setup wizard
  setup --force    Re-run setup (overwrites existing config)
  start            Start the server
  stop             Stop the server
  restart          Restart the server
  status           Show health and running state
  logs             Tail the log file
  build            Rebuild the app and MCP servers
  update           Update to latest version and restart
  open             Open the dashboard in your browser
  config           Show current configuration
  help             Show this help

${c.bold('EXAMPLES')}
  npm install -g froggo-mission-control   Install
  mission-control                          First-run setup wizard
  mission-control status                   Check if running
  mission-control logs                     View logs
  mission-control update                   Update to latest

${c.bold('REQUIREMENTS')}
  Node.js 20+, Claude Code CLI (claude.ai/code subscription)
  Gemini API key for Voice (free: aistudio.google.com/app/apikey)

${c.bold('DATA')}
  ~/mission-control/     Runtime data (DB, memory vault, library)
  ${INSTALL_DIR}/  App code
`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const cmd  = args[0] || '';
  const flag = args[1] || '';

  switch (cmd) {
    case '':
    case 'setup':     await cmdSetup(flag === '--force'); break;
    case 'start':     await cmdStart(); break;
    case 'stop':      await cmdStop(); break;
    case 'restart':   await cmdRestart(); break;
    case 'status':    await cmdStatus(); break;
    case 'logs':      cmdLogs(); break;
    case 'build':     await cmdBuild(); break;
    case 'update':    await cmdUpdate(); break;
    case 'open':      cmdOpen(); break;
    case 'config':    cmdConfig(); break;
    case 'help':
    case '--help':
    case '-h':        cmdHelp(); break;
    default:
      console.error(c.red(`Unknown command: ${cmd}`));
      console.error(`Run ${c.bold('mission-control help')} for usage.`);
      process.exit(1);
  }
}

main().catch(e => {
  console.error(c.red('Error:'), e.message || e);
  process.exit(1);
});
