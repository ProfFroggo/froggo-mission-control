// POST /api/x/verify — Test Twitter credentials and return authenticated user
import { NextResponse } from 'next/server';
import { loadCredentialsServer, verifyCredentials } from '@/lib/twitterApi';
import { getDb } from '@/lib/database';

export const dynamic = 'force-dynamic';

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

    // 1. Try user access token first (from OAuth 2.0 PKCE flow)
    const userToken = (db.prepare("SELECT value FROM settings WHERE key = 'twitter_user_access_token'").get() as { value: string } | undefined)?.value;
    if (userToken) {
      const meRes = await fetch('https://api.twitter.com/2/users/me?user.fields=profile_image_url,public_metrics,description,verified', {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      if (meRes.ok) {
        const meData = await meRes.json();
        if (meData.data) {
          // Cache user ID for other endpoints
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
