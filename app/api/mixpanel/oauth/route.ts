// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// Mixpanel OAuth flow — handles authorization from MC UI.
// Writes tokens to mcp-remote cache so agents can use the real Mixpanel MCP.
// No CLI required — user clicks "Connect Mixpanel" in Settings.

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/apiAuth';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export const dynamic = 'force-dynamic';

// ── Constants ─────────────────────────────────────────────────────────────────

const MIXPANEL_SERVER_URL = 'https://mcp-eu.mixpanel.com/mcp';
const AUTHORIZATION_ENDPOINT = 'https://eu.mixpanel.com/oauth/authorize';
const TOKEN_ENDPOINT = 'https://eu.mixpanel.com/oauth/token/';
const REGISTRATION_ENDPOINT = 'https://eu.mixpanel.com/oauth/mcp/register/';

const SCOPES = [
  'projects', 'analysis', 'events', 'insights', 'segmentation',
  'retention', 'data:read', 'funnels', 'flows', 'data_definitions',
  'dashboard_reports', 'experiments', 'feature_flags', 'metrics',
  'bookmarks', 'user_details',
].join(' ');

// mcp-remote stores tokens keyed by version — write to all known versions so
// whichever npx resolves to at startup finds valid tokens.
const MCP_REMOTE_VERSIONS = ['0.1.37', '0.1.38'];

// Both known hash variants (mcp-remote may use either depending on version/args)
function getServerUrlHashes(): string[] {
  const primary = crypto.createHash('md5').update(MIXPANEL_SERVER_URL).digest('hex');
  // Legacy hash that some mcp-remote versions used
  return [primary, 'a7a748c525355285bfc4d1a25362b3c3'];
}

function getMcpAuthDirs(): string[] {
  return MCP_REMOTE_VERSIONS.map(v =>
    path.join(os.homedir(), '.mcp-auth', `mcp-remote-${v}`)
  );
}

// Primary dir for reading (prefer newest version)
function getMcpAuthDir(): string {
  return path.join(os.homedir(), '.mcp-auth', `mcp-remote-${MCP_REMOTE_VERSIONS[MCP_REMOTE_VERSIONS.length - 1]}`);
}

// ── PKCE helpers ──────────────────────────────────────────────────────────────

function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url');
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const hash = crypto.createHash('sha256').update(verifier).digest();
  return hash.toString('base64url');
}

// ── Token file I/O ────────────────────────────────────────────────────────────

async function ensureAuthDirs(): Promise<string[]> {
  const dirs = getMcpAuthDirs();
  for (const dir of dirs) {
    await fs.mkdir(dir, { recursive: true });
  }
  return dirs;
}

async function writeTokenFiles(
  tokens: Record<string, unknown>,
  clientInfo: Record<string, unknown>,
  codeVerifier: string,
): Promise<void> {
  const dirs = await ensureAuthDirs();
  const hashes = getServerUrlHashes();

  for (const dir of dirs) {
    for (const hash of hashes) {
      await fs.writeFile(
        path.join(dir, `${hash}_tokens.json`),
        JSON.stringify(tokens),
        { mode: 0o600 },
      );
      await fs.writeFile(
        path.join(dir, `${hash}_client_info.json`),
        JSON.stringify(clientInfo),
        { mode: 0o600 },
      );
      await fs.writeFile(
        path.join(dir, `${hash}_code_verifier.txt`),
        codeVerifier,
        { mode: 0o600 },
      );
    }
  }
}

async function readTokens(): Promise<Record<string, unknown> | null> {
  const dir = getMcpAuthDir();
  const hashes = getServerUrlHashes();

  for (const hash of hashes) {
    try {
      const raw = await fs.readFile(path.join(dir, `${hash}_tokens.json`), 'utf-8');
      return JSON.parse(raw);
    } catch (err) { console.warn('[mixpanel/oauth] Non-critical: try next hash:', err); }
  }
  return null;
}

async function readClientInfo(): Promise<Record<string, unknown> | null> {
  const dir = getMcpAuthDir();
  const hashes = getServerUrlHashes();

  for (const hash of hashes) {
    try {
      const raw = await fs.readFile(path.join(dir, `${hash}_client_info.json`), 'utf-8');
      return JSON.parse(raw);
    } catch (err) { console.warn('[mixpanel/oauth] Non-critical: try next hash:', err); }
  }
  return null;
}

// ── Pending OAuth state (file-backed to survive HMR / module reloads) ─────────

interface PendingOAuth {
  codeVerifier: string;
  clientId: string;
  clientInfo: Record<string, unknown>;
  state: string;
  redirectUri: string;
  ts: number;
}

const PENDING_FILE = path.join(os.tmpdir(), 'mc-mixpanel-pending-oauth.json');
const PENDING_MAX_AGE = 5 * 60 * 1000; // 5 min — stale flows are invalid

async function savePendingOAuth(data: Omit<PendingOAuth, 'ts'>): Promise<void> {
  await fs.writeFile(PENDING_FILE, JSON.stringify({ ...data, ts: Date.now() }), { mode: 0o600 });
}

async function loadPendingOAuth(): Promise<PendingOAuth | null> {
  try {
    const raw = await fs.readFile(PENDING_FILE, 'utf-8');
    const data: PendingOAuth = JSON.parse(raw);
    if (Date.now() - data.ts > PENDING_MAX_AGE) return null; // expired
    return data;
  } catch { return null; }
}

async function clearPendingOAuth(): Promise<void> {
  try { await fs.unlink(PENDING_FILE); } catch { /* already gone */ }
}

// ── Route handlers ────────────────────────────────────────────────────────────

/**
 * GET /api/mixpanel/oauth?action=start    — begin OAuth flow (returns redirect URL)
 * GET /api/mixpanel/oauth?action=callback — handle OAuth callback
 * GET /api/mixpanel/oauth?action=status   — check token status
 */
export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get('action');

  // Callback is hit by browser redirect from Mixpanel — no auth token available.
  // Protected by PKCE + state parameter instead.
  if (action === 'callback') {
    return handleCallback(req);
  }

  // All other actions require auth
  const authError = requireAuth(req);
  if (authError) return authError;

  switch (action) {
    case 'start':
      return handleStart(req);
    case 'status':
      return handleStatus();
    default:
      return NextResponse.json({ error: 'Invalid action. Use: start, callback, status' }, { status: 400 });
  }
}

/**
 * POST /api/mixpanel/oauth?action=refresh — force-refresh tokens
 */
export async function POST(req: NextRequest) {
  const authError = requireAuth(req);
  if (authError) return authError;

  const action = req.nextUrl.searchParams.get('action');

  if (action === 'refresh') {
    return handleRefresh();
  }
  return NextResponse.json({ error: 'Invalid action. Use: refresh' }, { status: 400 });
}

// ── Action handlers ───────────────────────────────────────────────────────────

async function handleStart(req: NextRequest): Promise<NextResponse> {
  try {
    // Determine our callback URL
    const origin = req.nextUrl.origin || process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${process.env.PORT || 3000}`;
    const redirectUri = `${origin}/api/mixpanel/oauth?action=callback`;

    // Register dynamic client with Mixpanel
    const regResponse = await fetch(REGISTRATION_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        redirect_uris: [redirectUri],
        token_endpoint_auth_method: 'none',
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        client_name: 'Mission Control',
        scope: SCOPES,
      }),
    });

    if (!regResponse.ok) {
      const err = await regResponse.text();
      console.error('[mixpanel/oauth] Registration failed:', regResponse.status, err);
      return NextResponse.json(
        { error: `Failed to register OAuth client: ${regResponse.status}` },
        { status: 502 },
      );
    }

    const clientInfo = await regResponse.json();

    // Generate PKCE
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const state = crypto.randomUUID();

    // Persist pending OAuth state to disk (survives HMR)
    await savePendingOAuth({
      codeVerifier,
      clientId: clientInfo.client_id,
      clientInfo,
      state,
      redirectUri,
    });

    // Build authorization URL
    const authUrl = new URL(AUTHORIZATION_ENDPOINT);
    authUrl.searchParams.set('client_id', clientInfo.client_id);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', SCOPES);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');

    // Return the URL — frontend will redirect the user
    return NextResponse.json({ authUrl: authUrl.toString(), state });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[mixpanel/oauth] Start error:', msg);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function handleCallback(req: NextRequest): Promise<NextResponse> {
  try {
    const code = req.nextUrl.searchParams.get('code');
    const state = req.nextUrl.searchParams.get('state');
    const error = req.nextUrl.searchParams.get('error');

    if (error) {
      const desc = req.nextUrl.searchParams.get('error_description') || error;
      return htmlResponse(`
        <h2>Mixpanel Connection Failed</h2>
        <p>${escapeHtml(desc)}</p>
        <p>Close this window and try again from Settings.</p>
        <script>
          window.opener?.postMessage({ type: 'mixpanel-oauth-error', error: ${JSON.stringify(desc)} }, '*');
        </script>
      `, 400);
    }

    if (!code) {
      return htmlResponse('<h2>Missing authorization code</h2>', 400);
    }

    const pendingOAuth = await loadPendingOAuth();
    if (!pendingOAuth) {
      return htmlResponse('<h2>No pending OAuth flow — start again from Settings</h2>', 400);
    }

    if (state && pendingOAuth.state !== state) {
      return htmlResponse('<h2>State mismatch — possible CSRF. Try again.</h2>', 400);
    }

    // Exchange code for tokens
    const tokenResponse = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: pendingOAuth.redirectUri,
        client_id: pendingOAuth.clientId,
        code_verifier: pendingOAuth.codeVerifier,
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const err = await tokenResponse.text();
      console.error('[mixpanel/oauth] Token exchange failed:', tokenResponse.status, err);
      return htmlResponse(`
        <h2>Token Exchange Failed</h2>
        <p>Mixpanel returned ${tokenResponse.status}. Try again.</p>
        <script>
          window.opener?.postMessage({ type: 'mixpanel-oauth-error', error: 'Token exchange failed' }, '*');
        </script>
      `, 502);
    }

    const tokens = await tokenResponse.json();

    // Write to mcp-remote cache directory
    await writeTokenFiles(tokens, pendingOAuth.clientInfo, pendingOAuth.codeVerifier);

    // Clear pending state
    await clearPendingOAuth();

    console.error('[mixpanel/oauth] Successfully connected! Tokens cached for mcp-remote.');

    return htmlResponse(`
      <h2>Mixpanel Connected</h2>
      <p>You can close this window. Agents now have access to Mixpanel MCP.</p>
      <script>
        window.opener?.postMessage({ type: 'mixpanel-oauth-success' }, '*');
        setTimeout(() => window.close(), 2000);
      </script>
    `);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[mixpanel/oauth] Callback error:', msg);
    return htmlResponse(`<h2>Error</h2><p>${escapeHtml(msg)}</p>`, 500);
  }
}

async function handleStatus(): Promise<NextResponse> {
  const tokens = await readTokens();
  if (!tokens) {
    return NextResponse.json({ connected: false, reason: 'No tokens found' });
  }

  const accessToken = tokens.access_token as string | undefined;
  const refreshToken = tokens.refresh_token as string | undefined;

  if (!accessToken) {
    return NextResponse.json({ connected: false, reason: 'No access token' });
  }

  // Try a lightweight Mixpanel API call to verify token validity.
  // Use the Mixpanel REST API rather than the MCP endpoint (which requires specific scopes).
  try {
    const res = await fetch('https://eu.mixpanel.com/api/app/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10_000),
    });

    if (res.ok || res.status === 200) {
      return NextResponse.json({ connected: true, hasRefreshToken: !!refreshToken });
    }

    if (res.status === 401) {
      // Token expired
      if (refreshToken) {
        return NextResponse.json({ connected: false, reason: 'Token expired', canRefresh: true });
      }
      return NextResponse.json({ connected: false, reason: 'Token expired, no refresh token' });
    }

    if (res.status === 403) {
      // Scope issue — token works but needs re-auth with more scopes
      return NextResponse.json({
        connected: false,
        reason: 'Insufficient scopes — reconnect to grant all permissions',
        needsReconnect: true,
      });
    }

    // Other status — token might still work for MCP
    return NextResponse.json({ connected: true, warning: `Unexpected status: ${res.status}` });
  } catch (err) {
    console.warn('[mixpanel/oauth] Non-critical:', err);
    // Network error doesn't mean disconnected — Mixpanel might be down.
    // If we have tokens, assume connected.
    return NextResponse.json({ connected: true, warning: 'Could not verify — Mixpanel unreachable' });
  }
}

async function handleRefresh(): Promise<NextResponse> {
  const tokens = await readTokens();
  const clientInfo = await readClientInfo();

  if (!tokens?.refresh_token) {
    return NextResponse.json({ error: 'No refresh token available. Reconnect from Settings.' }, { status: 400 });
  }

  if (!clientInfo?.client_id) {
    return NextResponse.json({ error: 'No client info. Reconnect from Settings.' }, { status: 400 });
  }

  try {
    const res = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: tokens.refresh_token as string,
        client_id: clientInfo.client_id as string,
      }).toString(),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[mixpanel/oauth] Refresh failed:', res.status, err);
      return NextResponse.json(
        { error: `Refresh failed (${res.status}). Reconnect from Settings.`, needsReconnect: true },
        { status: 502 },
      );
    }

    const newTokens = await res.json();
    const codeVerifier = generateCodeVerifier(); // Not critical for refresh but keep file consistent
    await writeTokenFiles(newTokens, clientInfo as Record<string, unknown>, codeVerifier);

    console.error('[mixpanel/oauth] Tokens refreshed successfully.');
    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ── HTML helpers ──────────────────────────────────────────────────────────────

function htmlResponse(body: string, status = 200): NextResponse {
  return new NextResponse(
    `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Mixpanel OAuth</title>
<style>
  body { font-family: system-ui; background: #0a0a0a; color: #e5e5e5; display: flex;
         align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
  div { text-align: center; max-width: 400px; }
  h2 { color: #22c55e; }
  p { color: #a3a3a3; }
</style></head>
<body><div>${body}</div></body></html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
