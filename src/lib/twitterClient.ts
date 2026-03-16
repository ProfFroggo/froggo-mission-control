// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// Shared Twitter API client — loads credentials from keychain → DB → env
import { TwitterApi } from 'twitter-api-v2';
import { loadCredentialsServer } from './twitterApi';

let _cachedClient: TwitterApi | null = null;
let _cachedAt = 0;
const CACHE_TTL = 60_000; // Re-check credentials every 60s

/**
 * Get an authenticated TwitterApi client.
 * Tries OAuth 1.0a (user context — can read AND write) first,
 * falls back to bearer token (app-only — read only).
 */
export async function getTwitterClient(): Promise<TwitterApi | null> {
  // Return cached client if fresh
  if (_cachedClient && Date.now() - _cachedAt < CACHE_TTL) {
    return _cachedClient;
  }

  const creds = await loadCredentialsServer();

  // Also check for access tokens in keychain/DB
  let accessToken = '';
  let accessSecret = '';
  try {
    const { keychainGet } = await import('./keychain');
    accessToken = await keychainGet('twitter_access_token') ?? '';
    accessSecret = await keychainGet('twitter_access_token_secret') ?? '';
  } catch {}

  // Fallback to DB
  if (!accessToken || !accessSecret) {
    try {
      const { getDb } = await import('./database');
      const db = getDb();
      const getVal = (key: string) => (db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined)?.value || '';
      if (!accessToken) accessToken = getVal('twitter_access_token');
      if (!accessSecret) accessSecret = getVal('twitter_access_token_secret');
    } catch {}
  }

  // Fallback to env
  if (!accessToken) accessToken = process.env.TWITTER_ACCESS_TOKEN || '';
  if (!accessSecret) accessSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET || '';

  // Try OAuth 1.0a (user context — full access)
  if (creds.apiKey && creds.apiSecret && accessToken && accessSecret) {
    _cachedClient = new TwitterApi({
      appKey: creds.apiKey,
      appSecret: creds.apiSecret,
      accessToken,
      accessSecret,
    });
    _cachedAt = Date.now();
    return _cachedClient;
  }

  // Fall back to bearer (app-only — read only)
  if (creds.bearerToken) {
    _cachedClient = new TwitterApi(creds.bearerToken);
    _cachedAt = Date.now();
    return _cachedClient;
  }

  return null;
}

/** Invalidate cached client (call after credential changes) */
export function invalidateTwitterClient() {
  _cachedClient = null;
  _cachedAt = 0;
}
