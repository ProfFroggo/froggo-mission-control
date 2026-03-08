import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuthenticatedClient } from '@/lib/googleAuth';

export async function POST(request: NextRequest) {
  const client = await getAuthenticatedClient();
  if (!client) {
    return NextResponse.json({ error: 'Not authenticated', needsAuth: true }, { status: 401 });
  }

  try {
    const { to, subject, body, html, inReplyTo, threadId } = await request.json();

    if (!to || !subject || (!body && !html)) {
      return NextResponse.json({ error: 'Missing required fields: to, subject, body' }, { status: 400 });
    }

    const gmail = google.gmail({ version: 'v1', auth: client });

    // Get sender email
    const profile = await gmail.users.getProfile({ userId: 'me' });
    const from = profile.data.emailAddress ?? 'me';

    // Build MIME message
    const mimeLines: string[] = [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${subject}`,
    ];

    if (inReplyTo) {
      mimeLines.push(`In-Reply-To: ${inReplyTo}`);
      mimeLines.push(`References: ${inReplyTo}`);
    }

    if (html) {
      mimeLines.push('MIME-Version: 1.0');
      mimeLines.push('Content-Type: text/html; charset=UTF-8');
      mimeLines.push('');
      mimeLines.push(html);
    } else {
      mimeLines.push('Content-Type: text/plain; charset=UTF-8');
      mimeLines.push('');
      mimeLines.push(body);
    }

    const raw = Buffer.from(mimeLines.join('\r\n')).toString('base64url');

    const sendRes = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw, threadId: threadId ?? undefined },
    });

    return NextResponse.json({ success: true, id: sendRes.data.id });
  } catch (err: any) {
    console.error('[gmail/send] Error:', err?.message);
    return NextResponse.json({ error: err?.message ?? 'Send failed' }, { status: 500 });
  }
}
