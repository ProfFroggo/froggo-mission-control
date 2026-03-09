// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// src/lib/googleAuth.ts
// Google OAuth2 auth service — reads credentials from ~/.config/google-workspace-mcp/
// Stores tokens in ~/mission-control/data/google-tokens.json

import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// Trust system CA certs (handles corporate SSL proxies / custom CA chains)
// Must be set before any HTTPS requests — googleapis uses node-fetch/undici internally
if (!process.env.NODE_EXTRA_CA_CERTS) {
  const bundlePath = join(homedir(), 'mission-control', 'data', 'ca-bundle.pem');
  if (existsSync(bundlePath)) {
    process.env.NODE_EXTRA_CA_CERTS = bundlePath;
  } else if (existsSync('/etc/ssl/cert.pem')) {
    process.env.NODE_EXTRA_CA_CERTS = '/etc/ssl/cert.pem';
  }
}

// google-workspace-mcp client_secret.json
const CLIENT_SECRET_PATH = join(homedir(), '.config', 'google-workspace-mcp', 'client_secret.json');
// ~/.google_oauth_token.json — contains refresh_token + client creds in double-quoted JSON
const GOOGLE_OAUTH_TOKEN_PATH = join(homedir(), '.google_oauth_token.json');
const TOKENS_PATH = join(homedir(), 'mission-control', 'data', 'google-tokens.json');
const PORT = process.env.PORT ?? '3000';
const REDIRECT_URI = `http://localhost:${PORT}`;

export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

interface ClientSecret {
  web?: {
    client_id: string;
    client_secret: string;
    redirect_uris: string[];
    auth_uri: string;
    token_uri: string;
  };
  installed?: {
    client_id: string;
    client_secret: string;
    redirect_uris: string[];
    auth_uri: string;
    token_uri: string;
  };
}

interface StoredTokens {
  access_token?: string;
  refresh_token?: string;
  expiry_date?: number;
  token_type?: string;
  email?: string;
}

// Read double-quoted JSON format (Python repr-style: ""key"": ""value"")
function readDoubleQuotedJson(path: string): Record<string, any> | null {
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, 'utf-8');
    // Strategy 1: simple replace "" → "
    try { return JSON.parse(raw.replace(/""/g, '"')); } catch { /* next */ }
    // Strategy 2: regex replace ""word"" → "word" (handles partial double-quoting)
    try { return JSON.parse(raw.replace(/""([^"]+)""/g, '"$1"')); } catch { /* next */ }
    // Strategy 3: plain JSON (already well-formed)
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function getClientCredentials(): { clientId: string; clientSecret: string } | null {
  // 1. tokens file — client_id/client_secret stored alongside the refresh_token (highest priority:
  //    ensures the OAuth2Client always uses the exact credentials that issued the stored refresh_token)
  if (existsSync(TOKENS_PATH)) {
    try {
      const stored = JSON.parse(readFileSync(TOKENS_PATH, 'utf-8'));
      if (stored?.client_id && stored?.client_secret) {
        return { clientId: stored.client_id, clientSecret: stored.client_secret };
      }
    } catch { /* fall through */ }
  }

  // 2. ~/.google_oauth_token.json — contains client_id + client_secret inline (double-quoted JSON)
  const altToken = readDoubleQuotedJson(GOOGLE_OAUTH_TOKEN_PATH);
  if (altToken?.client_id && altToken?.client_secret) {
    return { clientId: altToken.client_id, clientSecret: altToken.client_secret };
  }

  // 3. client_secret.json (google-workspace-mcp)
  if (!existsSync(CLIENT_SECRET_PATH)) return null;
  try {
    const raw = JSON.parse(readFileSync(CLIENT_SECRET_PATH, 'utf-8')) as ClientSecret;
    const creds = raw.web ?? raw.installed;
    if (!creds?.client_id || !creds?.client_secret) return null;
    return { clientId: creds.client_id, clientSecret: creds.client_secret };
  } catch {
    return null;
  }
}

export function createOAuth2Client(): OAuth2Client | null {
  const creds = getClientCredentials();
  if (!creds) return null;
  return new google.auth.OAuth2(creds.clientId, creds.clientSecret, REDIRECT_URI);
}

export function getAuthUrl(): string | null {
  const client = createOAuth2Client();
  if (!client) return null;
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: GOOGLE_SCOPES,
  });
}

export function loadTokens(): StoredTokens | null {
  // Primary: our own token store (tokens exchanged via this app's OAuth flow)
  if (existsSync(TOKENS_PATH)) {
    try {
      const stored = JSON.parse(readFileSync(TOKENS_PATH, 'utf-8')) as StoredTokens;
      if (stored.refresh_token || stored.access_token) return stored;
    } catch {
      // fall through
    }
  }

  // Fallback: ~/.google_oauth_token.json — double-quoted JSON with refresh_token + client creds
  const alt = readDoubleQuotedJson(GOOGLE_OAUTH_TOKEN_PATH);
  if (alt?.refresh_token) {
    return {
      access_token: alt.token ?? undefined,
      refresh_token: alt.refresh_token,
      token_type: 'Bearer',
    };
  }

  return null;
}

export function saveTokens(tokens: StoredTokens): void {
  const dir = join(homedir(), 'mission-control', 'data');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const existing = loadTokens() ?? {};
  writeFileSync(TOKENS_PATH, JSON.stringify({ ...existing, ...tokens }, null, 2));
}

export function isAuthenticated(): boolean {
  const tokens = loadTokens();
  if (!tokens?.access_token && !tokens?.refresh_token) return false;
  // If we have a refresh token we can always re-authenticate
  if (tokens.refresh_token) return true;
  // If access token exists and not expired
  if (tokens.access_token && tokens.expiry_date && tokens.expiry_date > Date.now()) return true;
  return false;
}

export async function getAuthenticatedClient(): Promise<OAuth2Client | null> {
  const client = createOAuth2Client();
  if (!client) return null;

  const tokens = loadTokens();
  if (!tokens?.refresh_token && !tokens?.access_token) return null;

  // If we only have an access token (no refresh token) and it has expired or is
  // within 60 s of expiry, return null rather than letting googleapis throw
  // "No refresh token is set" mid-request.
  if (!tokens.refresh_token && tokens.expiry_date) {
    if (tokens.expiry_date <= Date.now() + 60_000) return null;
  }

  client.setCredentials(tokens);

  // Auto-refresh if needed
  client.on('tokens', (newTokens) => {
    saveTokens({
      access_token: newTokens.access_token ?? undefined,
      refresh_token: newTokens.refresh_token ?? undefined,
      expiry_date: newTokens.expiry_date ?? undefined,
      token_type: newTokens.token_type ?? undefined,
    });
  });

  return client;
}

export async function exchangeCodeForTokens(code: string): Promise<StoredTokens | null> {
  const client = createOAuth2Client();
  if (!client) return null;

  // On corporate networks with SSL inspection, googleapis may fail with SELF_SIGNED_CERT_IN_CHAIN.
  // If that happens, retry once with TLS verification disabled for this specific call.
  try {
    return await _doTokenExchange(client, code);
  } catch (err: unknown) {
    const code_ = (err as NodeJS.ErrnoException)?.code;
    if (code_ === 'SELF_SIGNED_CERT_IN_CHAIN' || code_ === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' || code_ === 'CERT_HAS_EXPIRED') {
      console.warn('[googleAuth] SSL cert issue — retrying with system CA bundle relaxed (corporate network detected)');
      const prev = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
      try {
        return await _doTokenExchange(createOAuth2Client()!, code);
      } finally {
        if (prev === undefined) delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
        else process.env.NODE_TLS_REJECT_UNAUTHORIZED = prev;
      }
    }
    console.error('[googleAuth] Failed to exchange code:', err);
    return null;
  }
}

async function _doTokenExchange(client: OAuth2Client, code: string): Promise<StoredTokens | null> {
  // Throws on SSL/network errors so the caller can retry with fallback
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  // Get user email (non-critical)
  let email: string | undefined;
  try {
    const oauth2 = google.oauth2({ version: 'v2', auth: client });
    const info = await oauth2.userinfo.get();
    email = info.data.email ?? undefined;
  } catch { /* non-critical */ }

  const toStore: StoredTokens = {
    access_token: tokens.access_token ?? undefined,
    refresh_token: tokens.refresh_token ?? undefined,
    expiry_date: tokens.expiry_date ?? undefined,
    token_type: tokens.token_type ?? undefined,
    email,
  };
  saveTokens(toStore);
  return toStore;
}

export function revokeTokens(): void {
  if (existsSync(TOKENS_PATH)) {
    writeFileSync(TOKENS_PATH, JSON.stringify({}));
  }
}
