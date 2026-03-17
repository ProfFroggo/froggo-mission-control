// POST /api/x/verify — Test Twitter credentials and return authenticated user
import { NextResponse } from 'next/server';
import { loadCredentialsServer, verifyCredentials } from '@/lib/twitterApi';
import { getDb } from '@/lib/database';

export const dynamic = 'force-dynamic';

async function getSetting(key: string): Promise<string> {
  try {
    const { keychainGet } = await import('@/lib/keychain');
    const val = await keychainGet(key);
    if (val) return val;
  } catch {}
  try {
    const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
    return row?.value || '';
  } catch { return ''; }
}

export async function POST() {
  try {
    const creds = await loadCredentialsServer();
    const db = getDb();

    const checks = {
      apiKey: !!creds.apiKey,
      apiSecret: !!creds.apiSecret,
      bearerToken: !!creds.bearerToken,
      oauthClientId: !!creds.oauthClientId,
      oauthClientSecret: !!creds.oauthClientSecret,
    };

    // 1. Try OAuth 1.0a user tokens (API Key + Secret + Access Token + Access Secret)
    const accessToken = await getSetting('twitter_access_token');
    const accessSecret = await getSetting('twitter_access_token_secret');
    if (creds.apiKey && creds.apiSecret && accessToken && accessSecret) {
      try {
        const { TwitterApi } = await import('twitter-api-v2');
        const client = new TwitterApi({
          appKey: creds.apiKey,
          appSecret: creds.apiSecret,
          accessToken,
          accessSecret,
        });
        const me = await client.v2.me({ 'user.fields': 'profile_image_url,public_metrics,description,verified' });
        if (me.data) {
          db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`).run('twitter_user_id', me.data.id);
          db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`).run('twitter_username', me.data.username);
          db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`).run('twitter_user_profile', JSON.stringify(me.data));
          return NextResponse.json({ success: true, user: me.data, checks });
        }
      } catch (e) {
        console.error('[x/verify] OAuth 1.0a failed:', e instanceof Error ? e.message : e);
        // Fall through to other methods
      }
    }

    // 2. Try OAuth 2.0 user access token (from PKCE flow)
    const userToken = (db.prepare("SELECT value FROM settings WHERE key = 'twitter_user_access_token'").get() as { value: string } | undefined)?.value;
    if (userToken) {
      const meRes = await fetch('https://api.twitter.com/2/users/me?user.fields=profile_image_url,public_metrics,description,verified', {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      if (meRes.ok) {
        const meData = await meRes.json();
        if (meData.data) {
          db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`).run('twitter_user_id', meData.data.id);
          return NextResponse.json({ success: true, user: meData.data, checks });
        }
      }
    }

    // 2. Try cached user profile (from previous OAuth)
    const cached = (db.prepare("SELECT value FROM settings WHERE key = 'twitter_user_profile'").get() as { value: string } | undefined)?.value;
    if (cached) {
      try {
        const profile = JSON.parse(cached);
        if (profile.id && profile.username) {
          return NextResponse.json({ success: true, user: profile, checks });
        }
      } catch { /* invalid cache */ }
    }

    // 3. Try bearer token with username lookup (if we know the username)
    if (creds.bearerToken) {
      const username = (db.prepare("SELECT value FROM settings WHERE key = 'twitter_username'").get() as { value: string } | undefined)?.value;
      if (username) {
        const lookupRes = await fetch(
          `https://api.twitter.com/2/users/by/username/${username}?user.fields=profile_image_url,public_metrics,description,verified`,
          { headers: { Authorization: `Bearer ${creds.bearerToken}` } }
        );
        if (lookupRes.ok) {
          const data = await lookupRes.json();
          if (data.data) {
            return NextResponse.json({ success: true, user: data.data, checks });
          }
        }
      }

      // 4. Fall back to basic bearer verification
      const result = await verifyCredentials(creds.bearerToken);
      return NextResponse.json({ ...result, checks });
    }

    return NextResponse.json({
      success: false,
      error: 'No tokens configured. Click "Connect with X" to authorize.',
      checks,
    }, { status: 400 });
  } catch (e) {
    return NextResponse.json({
      success: false,
      error: e instanceof Error ? e.message : 'Verification failed',
    }, { status: 500 });
  }
}
