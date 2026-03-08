import { NextResponse } from 'next/server';
import { isAuthenticated, loadTokens, getAuthenticatedClient, createOAuth2Client } from '@/lib/googleAuth';

export async function GET() {
  const hasTokens = isAuthenticated();
  const tokens = loadTokens();

  // Check if we have OAuth client credentials (gogcli or client_secret.json)
  const hasClientCredentials = createOAuth2Client() !== null;

  if (!hasTokens) {
    if (!hasClientCredentials) {
      // No OAuth app credentials at all — user must set up Google Cloud Console
      return NextResponse.json({
        authenticated: false,
        hasCredentials: false,
        needsSetup: true,
        setupInstructions: 'Install gogcli (brew install gogcli) or create a Google OAuth app at console.cloud.google.com',
      });
    }
    // Have credentials but no tokens — show Connect button
    return NextResponse.json({
      authenticated: false,
      hasCredentials: true,
    });
  }

  // Try to verify the token is actually valid by checking if we can build a client
  try {
    const client = await getAuthenticatedClient();
    if (!client) {
      return NextResponse.json({ authenticated: false, hasCredentials: hasClientCredentials });
    }

    return NextResponse.json({
      authenticated: true,
      hasCredentials: true,
      email: tokens?.email ?? null,
    });
  } catch {
    return NextResponse.json({
      authenticated: false,
      hasCredentials: true,
      error: 'OAuth credentials may be invalid or expired',
    });
  }
}
