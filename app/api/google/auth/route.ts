// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// Google OAuth using Gemini CLI Workspace Extension's public OAuth client
// Works for any user — no GCP project setup needed
import { NextRequest, NextResponse } from 'next/server';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { randomBytes, createHash } from 'crypto';

const CLIENT_ID = '338689075775-o75k922vn5fdl18qergr96rp8g63e4d7.apps.googleusercontent.com';
const REDIRECT_URI = 'https://google-workspace-extension.geminicli.com';
const REFRESH_PROXY = 'https://google-workspace-extension.geminicli.com/refreshToken';

const SCOPES = [
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/chat.spaces',
  'https://www.googleapis.com/auth/chat.messages',
  'https://www.googleapis.com/auth/chat.memberships',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/directory.readonly',
  'https://www.googleapis.com/auth/presentations.readonly',
  'https://www.googleapis.com/auth/spreadsheets.readonly',
];

const TOKENS_PATH = join(homedir(), 'mission-control', 'data', 'google-tokens.json');

function saveTokens(tokens: Record<string, unknown>) {
  const dir = join(homedir(), 'mission-control', 'data');
  mkdirSync(dir, { recursive: true });
  writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2), 'utf-8');

  // Also sync to Google Workspace MCP server
  try {
    const mcpTokenDir = join(homedir(), '.google-mcp', 'tokens');
    mkdirSync(mcpTokenDir, { recursive: true });
    writeFileSync(join(mcpTokenDir, 'kevin.json'), JSON.stringify(tokens, null, 2), 'utf-8');
    const accountsPath = join(homedir(), '.google-mcp', 'accounts.json');
    writeFileSync(accountsPath, JSON.stringify({
      accounts: { kevin: { email: 'authorized' } },
      credentialsPath: join(homedir(), '.google-mcp', 'credentials.json'),
    }, null, 2), 'utf-8');
  } catch { /* non-critical */ }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const code = searchParams.get('code');

  // Check auth status
  if (action === 'status') {
    try {
      if (existsSync(TOKENS_PATH)) {
        const tokens = JSON.parse(readFileSync(TOKENS_PATH, 'utf-8'));
        if (tokens.access_token) {
          const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
          });
          if (res.ok) {
            const user = await res.json();
            return NextResponse.json({ authenticated: true, email: user.email, name: user.name, picture: user.picture });
          }
          // Try refresh
          if (tokens.refresh_token) {
            const refreshed = await refreshAccessToken(tokens.refresh_token);
            if (refreshed) {
              const res2 = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: { Authorization: `Bearer ${refreshed.access_token}` },
              });
              if (res2.ok) {
                const user = await res2.json();
                return NextResponse.json({ authenticated: true, email: user.email, name: user.name, picture: user.picture });
              }
            }
          }
        }
      }
    } catch { /* fall through */ }
    return NextResponse.json({ authenticated: false });
  }

  // Disconnect
  if (action === 'disconnect') {
    try {
      if (existsSync(TOKENS_PATH)) writeFileSync(TOKENS_PATH, '{}', 'utf-8');
    } catch { /* ignore */ }
    return NextResponse.json({ success: true });
  }

  // Handle callback — tokens directly from geminicli.com redirect proxy
  const accessToken = searchParams.get('access_token');
  const refreshToken = searchParams.get('refresh_token');
  if (accessToken) {
    const tokens: Record<string, unknown> = {
      access_token: accessToken,
      refresh_token: refreshToken || undefined,
      token_type: searchParams.get('token_type') || 'Bearer',
      expires_in: searchParams.get('expires_in') || 3600,
      scope: searchParams.get('scope') || SCOPES.join(' '),
    };

    // Fetch email from Gmail profile
    try {
      const profileRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (profileRes.ok) {
        const profile = await profileRes.json();
        if (profile.emailAddress) tokens.email = profile.emailAddress;
      }
    } catch { /* non-critical */ }

    saveTokens(tokens);
    return new NextResponse(successHtml(`Google connected as ${tokens.email || 'authorized'}`), { headers: { 'Content-Type': 'text/html' } });
  }

  // Handle callback — auth code from proxy (exchange for tokens)
  if (code) {
    try {
      // The geminicli.com proxy already exchanged the code — we receive tokens directly
      // But if it's a raw code, exchange it ourselves
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: CLIENT_ID,
          redirect_uri: REDIRECT_URI,
          grant_type: 'authorization_code',
        }),
      });

      if (tokenRes.ok) {
        const tokens = await tokenRes.json();
        saveTokens(tokens);
        return new NextResponse(successHtml('Google connected successfully'), { headers: { 'Content-Type': 'text/html' } });
      }

      const err = await tokenRes.text();
      return new NextResponse(successHtml(`Auth failed: ${err.slice(0, 100)}`), { headers: { 'Content-Type': 'text/html' } });
    } catch (err) {
      return new NextResponse(successHtml(`Error: ${err}`), { headers: { 'Content-Type': 'text/html' } });
    }
  }

  // Save tokens directly (POST from client after manual flow)
  if (action === 'save-tokens') {
    // handled by POST below
  }

  // Start OAuth flow — redirect to Google via geminicli.com proxy
  const state = Buffer.from(JSON.stringify({
    uri: `http://localhost:3000/api/google/auth`,
    manual: false,
    csrf: randomBytes(16).toString('hex'),
  })).toString('base64');

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state,
  });

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}

// POST — save tokens from manual flow or refresh
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.refresh_token) {
      // Save tokens directly
      saveTokens(body);
      return NextResponse.json({ success: true });
    }

    if (body.code) {
      // Exchange code for tokens
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: body.code,
          client_id: CLIENT_ID,
          redirect_uri: REDIRECT_URI,
          grant_type: 'authorization_code',
        }),
      });

      if (tokenRes.ok) {
        const tokens = await tokenRes.json();
        saveTokens(tokens);
        return NextResponse.json({ success: true });
      }

      return NextResponse.json({ error: 'Token exchange failed' }, { status: 400 });
    }

    return NextResponse.json({ error: 'Missing code or refresh_token' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string } | null> {
  try {
    // Try the geminicli.com refresh proxy first (handles client_secret)
    const res = await fetch(REFRESH_PROXY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (res.ok) {
      const tokens = await res.json();
      const existing = existsSync(TOKENS_PATH) ? JSON.parse(readFileSync(TOKENS_PATH, 'utf-8')) : {};
      saveTokens({ ...existing, ...tokens });
      return tokens;
    }
  } catch { /* fall through */ }
  return null;
}

function successHtml(msg: string): string {
  const isSuccess = !msg.toLowerCase().includes('fail') && !msg.toLowerCase().includes('error');
  return `<!DOCTYPE html><html><body style="background:#111;color:#fff;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column">
    <h2 style="color:${isSuccess ? '#22c55e' : '#ef4444'}">${isSuccess ? 'Connected' : 'Error'}</h2>
    <p>${msg}</p>
    <p style="color:#666;font-size:0.85rem">You can close this tab and return to Mission Control.</p>
    <script>setTimeout(()=>window.close(),2000)</script>
  </body></html>`;
}
