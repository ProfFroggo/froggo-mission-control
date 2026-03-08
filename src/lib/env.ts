// src/lib/env.ts
// Centralized environment configuration for Mission Control platform.
// Import from here instead of using process.env directly.
//
// Copyright (C) 2026 Froggo.Pro (KEVINJMACARTHUR) — https://froggo.pro
// Licensed under the GNU Affero General Public License v3.0 (AGPL-3.0)
// SPDX-License-Identifier: AGPL-3.0-only

import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { existsSync } from 'fs';

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

  // Claude CLI binary
  CLAUDE_BIN: resolveClaudeBin(),

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
} as const;

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
