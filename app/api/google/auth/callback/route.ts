import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens } from '@/lib/googleAuth';

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

    return NextResponse.json({
      success: true,
      email: tokens.email ?? null,
    });
  } catch (err) {
    console.error('[google/auth/callback] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
