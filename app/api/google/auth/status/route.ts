// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextResponse } from 'next/server';
import { isAuthenticated, loadTokens, getAuthenticatedClient, createOAuth2Client } from '@/lib/googleAuth';

export async function GET() {
  const hasTokens = isAuthenticated();
  const tokens = loadTokens();

  // Check if we have OAuth client credentials (client_secret.json or tokens file)
  const hasClientCredentials = createOAuth2Client() !== null;

  if (!hasTokens) {
    if (!hasClientCredentials) {
      // No OAuth app credentials at all — user must set up Google Cloud Console
      return NextResponse.json({
        authenticated: false,
        hasCredentials: false,
        needsSetup: true,
        setupInstructions: 'Create a Web application OAuth 2.0 Client ID at console.cloud.google.com, add http://localhost:3000 as an authorized redirect URI, and save the downloaded JSON to ~/.config/google-workspace-mcp/client_secret.json',
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
