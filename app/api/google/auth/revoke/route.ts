// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextResponse } from 'next/server';
import { revokeTokens, getAuthenticatedClient } from '@/lib/googleAuth';

export async function POST() {
  try {
    // Revoke token with Google if possible
    try {
      const client = await getAuthenticatedClient();
      if (client) {
        const creds = client.credentials;
        if (creds.access_token) {
          await client.revokeToken(creds.access_token);
        }
      }
    } catch {
      // Best-effort revocation
    }

    revokeTokens();
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[google/auth/revoke] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
