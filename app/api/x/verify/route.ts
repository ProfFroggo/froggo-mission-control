// POST /api/x/verify — Test Twitter credentials and return authenticated user
import { NextResponse } from 'next/server';
import { loadCredentialsServer, verifyCredentials } from '@/lib/twitterApi';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const creds = await loadCredentialsServer();

    if (!creds.bearerToken) {
      return NextResponse.json({
        success: false,
        error: 'No Bearer token configured. Add it in Settings → API Keys.',
        checks: {
          apiKey: !!creds.apiKey,
          apiSecret: !!creds.apiSecret,
          bearerToken: false,
          oauthClientId: !!creds.oauthClientId,
          oauthClientSecret: !!creds.oauthClientSecret,
        },
      }, { status: 400 });
    }

    const result = await verifyCredentials(creds.bearerToken);

    return NextResponse.json({
      ...result,
      checks: {
        apiKey: !!creds.apiKey,
        apiSecret: !!creds.apiSecret,
        bearerToken: !!creds.bearerToken,
        oauthClientId: !!creds.oauthClientId,
        oauthClientSecret: !!creds.oauthClientSecret,
      },
    });
  } catch (e) {
    return NextResponse.json({
      success: false,
      error: e instanceof Error ? e.message : 'Verification failed',
    }, { status: 500 });
  }
}
