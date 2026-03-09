// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// src/lib/keychain.ts
// Secure OS keychain storage for sensitive API keys via keytar.
// Falls back gracefully when keytar native module is unavailable.
//
// Copyright (C) 2026 Froggo.Pro (KEVINJMACARTHUR) — https://froggo.pro
// Licensed under the GNU Affero General Public License v3.0 (AGPL-3.0)
// SPDX-License-Identifier: AGPL-3.0-only

// Keys that should be stored in the OS keychain instead of SQLite
export const KEYCHAIN_KEYS = new Set([
  'gemini_api_key',
  'anthropic_api_key',
]);

const SERVICE = 'froggo-mission-control';

// Lazy-load keytar to handle environments where native module isn't available
let keytar: typeof import('keytar') | null = null;
async function getKeytar() {
  if (keytar) return keytar;
  try {
    keytar = await import('keytar');
    return keytar;
  } catch {
    return null;
  }
}

export async function keychainGet(key: string): Promise<string | null> {
  const kt = await getKeytar();
  if (!kt) return null;
  try {
    return await kt.getPassword(SERVICE, key);
  } catch {
    return null;
  }
}

export async function keychainSet(key: string, value: string): Promise<boolean> {
  const kt = await getKeytar();
  if (!kt) return false;
  try {
    await kt.setPassword(SERVICE, key, value);
    return true;
  } catch {
    return false;
  }
}

export async function keychainDelete(key: string): Promise<boolean> {
  const kt = await getKeytar();
  if (!kt) return false;
  try {
    await kt.deletePassword(SERVICE, key);
    return true;
  } catch {
    return false;
  }
}
