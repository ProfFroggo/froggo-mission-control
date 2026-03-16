// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// GET /api/x/oauth — Start X OAuth 2.0 PKCE flow or handle callback
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { randomBytes, createHash } from 'crypto';

const SCOPES = ['tweet.read', 'tweet.write', 'users.read', 'offline.access', 'like.read', 'follows.read'];

function getSetting(key: string): string {
  try {
    const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
    return row?.value || '';
  } catch { return ''; }
}

function getKeychainSetting(key: string): string {
  // Settings API stores sensitive keys in keychain, but we read from keychain here
  return getSetting(key); // loadCredentialsServer handles the layered lookup
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  const clientId = getSetting('twitter_oauth_client_id');

  // Callback — exchange code for tokens
  if (code) {
    try {
      // Load PKCE verifier
      const verifier = getSetting('twitter_pkce_verifier');

      const tokenRes = await fetch('https://api.twitter.com/2/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          grant_type: 'authorization_code',
          client_id: clientId,
          redirect_uri: `http://localhost:${process.env.PORT || 3000}/api/x/oauth`,
          code_verifier: verifier,
        }),
      });

      if (!tokenRes.ok) {
        const err = await tokenRes.text();
        return new NextResponse(`<html><body style="background:#111;color:#fff;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh">
          <div style="text-align:center"><h2 style="color:#ef4444">X Auth Failed</h2><pre style="font-size:12px;max-width:600px;overflow:auto">${err.slice(0, 300)}</pre></div>
        </body></html>`, { headers: { 'Content-Type': 'text/html' } });
      }

      const tokens = await tokenRes.json();

      // Save user access token
      const db = getDb();
      db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`).run('twitter_user_access_token', tokens.access_token);
      if (tokens.refresh_token) {
        db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`).run('twitter_refresh_token', tokens.refresh_token);
      }

      // Fetch user profile with the new user token
      const meRes = await fetch('https://api.twitter.com/2/users/me?user.fields=profile_image_url,public_metrics,description,verified', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });

      if (meRes.ok) {
        const meData = await meRes.json();
        if (meData.data) {
          db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`).run('twitter_user_id', meData.data.id);
          db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`).run('twitter_username', meData.data.username);
          db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`).run('twitter_user_profile', JSON.stringify(meData.data));
        }
      }

      return new NextResponse(`<html><body style="background:#111;color:#fff;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column">
        <h2 style="color:#22c55e">X Connected</h2>
        <p>You can close this tab and return to Mission Control.</p>
        <script>setTimeout(()=>window.close(),2000)</script>
      </body></html>`, { headers: { 'Content-Type': 'text/html' } });
    } catch (err) {
      return new NextResponse(`<html><body style="background:#111;color:#fff;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh">
        <div><h2 style="color:#ef4444">Error</h2><p>${err}</p></div>
      </body></html>`, { headers: { 'Content-Type': 'text/html' } });
    }
  }

  // Start OAuth flow
  if (!clientId) {
    return NextResponse.json({ error: 'OAuth Client ID not configured' }, { status: 400 });
  }

  // Generate PKCE
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');

  // Store verifier for callback
  const db = getDb();
  db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`).run('twitter_pkce_verifier', verifier);

  const stateToken = randomBytes(16).toString('hex');
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: `http://localhost:${process.env.PORT || 3000}/api/x/oauth`,
    scope: SCOPES.join(' '),
    state: stateToken,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });

  return NextResponse.redirect(`https://twitter.com/i/oauth2/authorize?${params}`);
}
