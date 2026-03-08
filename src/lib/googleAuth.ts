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

// Primary credentials — gogcli (https://github.com/googleworkspace/cli) — valid OAuth client
const GOGCLI_CREDENTIALS_PATH = join(homedir(), 'Library', 'Application Support', 'gogcli', 'credentials.json');
// Fallback: google-workspace-mcp client_secret.json (may reference deleted project)
const CLIENT_SECRET_PATH = join(homedir(), '.config', 'google-workspace-mcp', 'client_secret.json');
// Alternative: ~/.google_oauth_token.json — contains refresh_token + client creds in double-quoted JSON
const GOOGLE_OAUTH_TOKEN_PATH = join(homedir(), '.google_oauth_token.json');
const TOKENS_PATH = join(homedir(), 'mission-control', 'data', 'google-tokens.json');
const REDIRECT_URI = 'http://localhost:3000';

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
    const normalized = readFileSync(path, 'utf-8').replace(/""/g, '"');
    return JSON.parse(normalized);
  } catch {
    return null;
  }
}

function getClientCredentials(): { clientId: string; clientSecret: string } | null {
  // 1. gogcli credentials (https://github.com/googleworkspace/cli) — most reliable
  if (existsSync(GOGCLI_CREDENTIALS_PATH)) {
    try {
      const raw = JSON.parse(readFileSync(GOGCLI_CREDENTIALS_PATH, 'utf-8'));
      if (raw?.client_id && raw?.client_secret) {
        return { clientId: raw.client_id, clientSecret: raw.client_secret };
      }
    } catch {
      // fall through
    }
  }

  // 2. ~/.google_oauth_token.json — contains client_id + client_secret inline (double-quoted JSON)
  const altToken = readDoubleQuotedJson(GOOGLE_OAUTH_TOKEN_PATH);
  if (altToken?.client_id && altToken?.client_secret) {
    return { clientId: altToken.client_id, clientSecret: altToken.client_secret };
  }

  // 3. client_secret.json (google-workspace-mcp — may reference deleted project)
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

  // Fallback: ~/.google_oauth_token.json — ONLY use if gogcli credentials are not available,
  // because that file's refresh_token was issued for the old deleted OAuth client.
  // If gogcli credentials are present, those tokens are incompatible and would cause 401s.
  if (!existsSync(GOGCLI_CREDENTIALS_PATH)) {
    const alt = readDoubleQuotedJson(GOOGLE_OAUTH_TOKEN_PATH);
    if (alt?.refresh_token) {
      return {
        access_token: alt.token ?? undefined,
        refresh_token: alt.refresh_token,
        token_type: 'Bearer',
      };
    }
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

  try {
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    // Get user email
    let email: string | undefined;
    try {
      const oauth2 = google.oauth2({ version: 'v2', auth: client });
      const info = await oauth2.userinfo.get();
      email = info.data.email ?? undefined;
    } catch {
      // non-critical
    }

    const toStore: StoredTokens = {
      access_token: tokens.access_token ?? undefined,
      refresh_token: tokens.refresh_token ?? undefined,
      expiry_date: tokens.expiry_date ?? undefined,
      token_type: tokens.token_type ?? undefined,
      email,
    };
    saveTokens(toStore);
    return toStore;
  } catch (err) {
    console.error('[googleAuth] Failed to exchange code:', err);
    return null;
  }
}

export function revokeTokens(): void {
  if (existsSync(TOKENS_PATH)) {
    writeFileSync(TOKENS_PATH, JSON.stringify({}));
  }
}
