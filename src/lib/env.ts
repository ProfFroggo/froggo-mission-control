// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// src/lib/env.ts
// Centralized environment configuration for Mission Control platform.
// Import from here instead of using process.env directly.
//
// Copyright (C) 2026 Froggo.Pro (KEVINJMACARTHUR) — https://froggo.pro
// SPDX-License-Identifier: Apache-2.0

import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { existsSync, realpathSync, readFileSync } from 'fs';

// Load .env from ~/mission-control/ (survives npm updates) before Next.js reads process.env.
// This runs once at module init so all ENV values below see the correct vars.
(function loadUserEnv() {
  const candidates = [
    path.join(os.homedir(), 'mission-control', '.env'),
    path.join(process.cwd(), '.env'),
  ];
  for (const p of candidates) {
    if (!existsSync(p)) continue;
    try {
      const lines = readFileSync(p, 'utf-8').split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq === -1) continue;
        const key = trimmed.slice(0, eq).trim();
        const val = trimmed.slice(eq + 1).trim();
        if (!(key in process.env)) process.env[key] = val; // don't override LaunchAgent-injected vars
      }
    } catch { /* non-fatal */ }
    break; // use first file found
  }
})();

// ── Search backend detection ────────────────────────────────────────────────
// Resolved once at startup. Order of preference: qmd > ripgrep > none.
function resolveSearchBackend(qmdBin: string): 'qmd' | 'ripgrep' | 'none' {
  if (existsSync(qmdBin)) return 'qmd';

  // Check for ripgrep on PATH or common locations
  try {
    const found = execSync('which rg 2>/dev/null', { encoding: 'utf-8', timeout: 2000 }).trim();
    if (found) return 'ripgrep';
  } catch { /* not on PATH */ }

  const rgCandidates = [
    '/opt/homebrew/bin/rg',
    '/usr/local/bin/rg',
    '/usr/bin/rg',
  ];
  for (const c of rgCandidates) {
    if (existsSync(c)) return 'ripgrep';
  }

  console.warn(`[env] QMD not found at ${qmdBin} and ripgrep (rg) not found. Memory search will be unavailable. Install qmd: brew install profroggo/tap/qmd`);
  return 'none';
}

function resolveHome(p: string): string {
  return p.replace(/^~/, os.homedir());
}

function resolveClaudeBin(): string {
  if (process.env.CLAUDE_BIN) return process.env.CLAUDE_BIN;
  try {
    const found = execSync('which claude 2>/dev/null', { encoding: 'utf-8', timeout: 2000 }).trim();
    if (found) return found;
  } catch { /* not on PATH */ }
  const candidates = [
    '/usr/local/bin/claude',
    path.join(os.homedir(), '.npm-global', 'bin', 'claude'),
    path.join(os.homedir(), '.local', 'bin', 'claude'),
    '/opt/homebrew/bin/claude',
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return 'claude';
}

// Resolve the real JS file behind the claude symlink so we can spawn it with
// process.execPath (node) directly — avoids #!/usr/bin/env node shebang failure
// in LaunchAgent / systemd contexts where 'node' is not on PATH.
function resolveClaudeScript(): string {
  const bin = resolveClaudeBin();
  try {
    const real = realpathSync(bin);
    if (real.endsWith('.js')) return real;
  } catch { /* fallback */ }
  return bin;
}

export const ENV = {
  // Database
  DB_PATH: resolveHome(
    process.env.MC_DB_PATH ||
    path.join(os.homedir(), 'mission-control', 'data', 'mission-control.db')
  ),

  // Library (agent output files, docs, assets)
  LIBRARY_PATH: resolveHome(
    process.env.LIBRARY_PATH ||
    path.join(os.homedir(), 'mission-control', 'library')
  ),

  // Memory vault
  VAULT_PATH: resolveHome(
    process.env.VAULT_PATH ||
    path.join(os.homedir(), 'mission-control', 'memory')
  ),

  // Project root
  PROJECT_DIR: resolveHome(
    process.env.PROJECT_DIR ||
    path.join(os.homedir(), 'git', 'mission-control-nextjs')
  ),

  // Logs
  LOG_DIR: resolveHome(
    process.env.LOG_DIR ||
    path.join(os.homedir(), 'mission-control', 'logs')
  ),

  // Claude CLI binary (symlink path, e.g. ~/.npm-global/bin/claude)
  CLAUDE_BIN: resolveClaudeBin(),
  // Real .js file behind the claude symlink — spawn this with process.execPath
  // to avoid #!/usr/bin/env node shebang failures in LaunchAgent/systemd contexts
  CLAUDE_SCRIPT: resolveClaudeScript(),

  // QMD binary (optional — memory search)
  QMD_BIN: resolveHome(
    process.env.QMD_BIN || '/opt/homebrew/bin/qmd'
  ),

  // Tmux session name
  TMUX_SESSION: process.env.TMUX_SESSION || 'mission-control',

  // Model tiers
  MODEL_LEAD:    process.env.MODEL_LEAD    || 'claude-opus-4-6',
  MODEL_WORKER:  process.env.MODEL_WORKER  || 'claude-sonnet-4-6',
  MODEL_TRIVIAL: process.env.MODEL_TRIVIAL || 'claude-haiku-4-5-20251001',

  // API auth — bearer token required on all /api/* routes (empty = disabled, local dev only)
  INTERNAL_API_TOKEN: process.env.INTERNAL_API_TOKEN || '',
} as const;

// ── Search backend ───────────────────────────────────────────────────────────
// Determined once at startup. Consumers import this to decide which search
// path to use without re-checking the filesystem on every request.
export const searchBackend: 'qmd' | 'ripgrep' | 'none' = resolveSearchBackend(ENV.QMD_BIN);

// Model pricing (USD per million tokens) — update when Anthropic changes pricing
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-opus-4-6':           { input: 15.00, output: 75.00 },
  'claude-sonnet-4-6':         { input: 3.00,  output: 15.00 },
  'claude-haiku-4-5-20251001': { input: 0.80,  output: 4.00  },
  // Fallback for unknown models
  'default':                   { input: 3.00,  output: 15.00 },
};

export function calcCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_PRICING[model] ?? MODEL_PRICING['default'];
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
}
