// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens } from '@/lib/googleAuth';

// GET — handles the browser redirect from Google OAuth
// Returns a small HTML page that notifies the opener and closes itself
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code  = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    return new NextResponse(closePageHtml(false, `Google denied access: ${error}`), {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  if (!code) {
    return new NextResponse(closePageHtml(false, 'Missing authorization code'), {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    if (!tokens) {
      return new NextResponse(closePageHtml(false, 'Failed to exchange code for tokens'), {
        headers: { 'Content-Type': 'text/html' },
      });
    }
    return new NextResponse(closePageHtml(true, tokens.email ?? ''), {
      headers: { 'Content-Type': 'text/html' },
    });
  } catch (err) {
    console.error('[google/auth/callback] Error:', err);
    const msg = err instanceof Error ? err.message : 'Internal server error';
    return new NextResponse(closePageHtml(false, msg), {
      headers: { 'Content-Type': 'text/html' },
    });
  }
}

// POST — kept for any legacy callers
export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json();
    if (!code) {
      return NextResponse.json({ error: 'Missing code parameter' }, { status: 400 });
    }
    const tokens = await exchangeCodeForTokens(code);
    if (!tokens) {
      return NextResponse.json({ error: 'Failed to exchange code for tokens' }, { status: 500 });
    }
    return NextResponse.json({ success: true, email: tokens.email ?? null });
  } catch (err) {
    console.error('[google/auth/callback] POST Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function closePageHtml(success: boolean, detail: string): string {
  const msg  = success ? `Connected as ${detail}` : `Error: ${detail}`;
  const color = success ? '#4ade80' : '#f87171';
  return `<!DOCTYPE html>
<html>
<head><title>Google Auth</title>
<style>
  body { font-family: system-ui, sans-serif; background: #0f1117; color: #e2e8f0;
         display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
  .box { text-align: center; }
  .status { font-size: 1.1rem; margin-bottom: 0.5rem; color: ${color}; }
  .sub { font-size: 0.85rem; color: #64748b; }
</style>
</head>
<body>
  <div class="box">
    <div class="status">${success ? '✓ ' : '✗ '}${escHtml(msg)}</div>
    <div class="sub">This window will close automatically…</div>
  </div>
  <script>
    // Notify the opener (wizard popup flow) then close
    try {
      if (window.opener) {
        window.opener.postMessage(
          { type: 'google-auth', success: ${success}, detail: ${JSON.stringify(detail)} },
          window.location.origin
        );
      }
    } catch (_) {}
    setTimeout(() => window.close(), 1500);
  </script>
</body>
</html>`;
}

function escHtml(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
