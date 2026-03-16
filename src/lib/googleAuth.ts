// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// src/lib/googleAuth.ts
// Google OAuth2 auth — PKCE flow, no client_secret required.
// Bundled client_id is safe to publish (Desktop app type, PKCE).
// Tokens stored in ~/mission-control/data/google-tokens.json

import { google } from 'googleapis';
import { OAuth2Client, CodeChallengeMethod } from 'google-auth-library';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { randomBytes, createHash } from 'crypto';
import { join } from 'path';
import { homedir } from 'os';

// Trust system CA certs (handles corporate SSL proxies / custom CA chains)
if (!process.env.NODE_EXTRA_CA_CERTS) {
  const bundlePath = join(homedir(), 'mission-control', 'data', 'ca-bundle.pem');
  if (existsSync(bundlePath)) {
    process.env.NODE_EXTRA_CA_CERTS = bundlePath;
  } else if (existsSync('/etc/ssl/cert.pem')) {
    process.env.NODE_EXTRA_CA_CERTS = '/etc/ssl/cert.pem';
  }
}

// Public client ID — safe to bundle, no secret needed with PKCE
const CLIENT_ID = '884467844404-psrpk58igof9r9vd9012casb148fi79a.apps.googleusercontent.com';
const TOKENS_PATH = join(homedir(), 'mission-control', 'data', 'google-tokens.json');
const PKCE_PATH = join(homedir(), 'mission-control', 'data', 'google-pkce.json');
const PORT = process.env.PORT ?? '3000';
const REDIRECT_URI = `http://localhost:${PORT}`;

export const GOOGLE_SCOPES = [
  // Gmail
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
  // Calendar
  'https://www.googleapis.com/auth/calendar',
  // Drive + Docs + Sheets + Slides
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/presentations',
  // User info
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

interface StoredTokens {
  access_token?: string;
  refresh_token?: string;
  expiry_date?: number;
  token_type?: string;
  email?: string;
}

function createClient(): OAuth2Client {
  return new google.auth.OAuth2(CLIENT_ID, '', REDIRECT_URI);
}

// PKCE helpers
function generateCodeVerifier(): string {
  return randomBytes(32).toString('base64url');
}

function deriveCodeChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

function saveCodeVerifier(verifier: string): void {
  const dir = join(homedir(), 'mission-control', 'data');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(PKCE_PATH, JSON.stringify({ verifier, ts: Date.now() }));
}

function loadCodeVerifier(): string | null {
  if (!existsSync(PKCE_PATH)) return null;
  try {
    const { verifier, ts } = JSON.parse(readFileSync(PKCE_PATH, 'utf-8'));
    // Expire after 10 minutes
    if (Date.now() - ts > 10 * 60 * 1000) return null;
    return verifier ?? null;
  } catch {
    return null;
  }
}

export function createOAuth2Client(): OAuth2Client {
  return createClient();
}

export function getAuthUrl(): string {
  const verifier = generateCodeVerifier();
  saveCodeVerifier(verifier);

  const client = createClient();
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: GOOGLE_SCOPES,
    code_challenge: deriveCodeChallenge(verifier),
    code_challenge_method: CodeChallengeMethod.S256,
  });
}

export function loadTokens(): StoredTokens | null {
  if (!existsSync(TOKENS_PATH)) return null;
  try {
    const stored = JSON.parse(readFileSync(TOKENS_PATH, 'utf-8')) as StoredTokens;
    if (stored.refresh_token || stored.access_token) return stored;
  } catch { /* fall through */ }
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
  if (!tokens) return false;
  if (tokens.refresh_token) return true;
  if (tokens.access_token && tokens.expiry_date && tokens.expiry_date > Date.now()) return true;
  return false;
}

export async function getAuthenticatedClient(): Promise<OAuth2Client | null> {
  const tokens = loadTokens();
  if (!tokens?.refresh_token && !tokens?.access_token) return null;

  // Expired access token with no refresh token
  if (!tokens.refresh_token && tokens.expiry_date) {
    if (tokens.expiry_date <= Date.now() + 60_000) return null;
  }

  const client = createClient();
  client.setCredentials(tokens);

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
  const verifier = loadCodeVerifier();
  const client = createClient();

  try {
    return await _doTokenExchange(client, code, verifier ?? undefined);
  } catch (err: unknown) {
    const errCode = (err as NodeJS.ErrnoException)?.code;
    if (errCode === 'SELF_SIGNED_CERT_IN_CHAIN' || errCode === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' || errCode === 'CERT_HAS_EXPIRED') {
      console.warn('[googleAuth] SSL cert issue — retrying with relaxed TLS (corporate network)');
      const prev = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
      try {
        return await _doTokenExchange(createClient(), code, verifier ?? undefined);
      } finally {
        if (prev === undefined) delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
        else process.env.NODE_TLS_REJECT_UNAUTHORIZED = prev;
      }
    }
    console.error('[googleAuth] Failed to exchange code:', err);
    return null;
  }
}

async function _doTokenExchange(client: OAuth2Client, code: string, codeVerifier?: string): Promise<StoredTokens | null> {
  const { tokens } = await client.getToken({ code, codeVerifier });
  client.setCredentials(tokens);

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
