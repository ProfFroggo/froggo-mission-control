// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuthenticatedClient } from '@/lib/googleAuth';

function decodeBase64(data: string): string {
  return Buffer.from(data, 'base64').toString('utf-8');
}

function extractBody(payload: any): { text: string; html: string } {
  let text = '';
  let html = '';
  function traverse(part: any) {
    if (!part) return;
    const mimeType = part.mimeType ?? '';
    const body = part.body?.data;
    if (mimeType === 'text/plain' && body) text = decodeBase64(body);
    else if (mimeType === 'text/html' && body) html = decodeBase64(body);
    if (part.parts) part.parts.forEach(traverse);
  }
  traverse(payload);
  return { text, html };
}

function headerVal(headers: Array<{ name?: string | null; value?: string | null }>, name: string): string {
  return headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value ?? '';
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const client = await getAuthenticatedClient();
  if (!client) {
    return NextResponse.json({ error: 'Not authenticated', needsAuth: true }, { status: 401 });
  }

  try {
    const gmail = google.gmail({ version: 'v1', auth: client });
    const thread = await gmail.users.threads.get({ userId: 'me', id, format: 'full' });
    const messages = (thread.data.messages ?? []).map(msg => {
      const headers = msg.payload?.headers ?? [];
      const { text, html } = extractBody(msg.payload);
      const from = headerVal(headers, 'from');
      const ts = msg.internalDate ? new Date(parseInt(msg.internalDate)) : new Date();

      return {
        id: msg.id,
        threadId: msg.threadId,
        from,
        fromName: from.replace(/<[^>]+>/, '').trim(),
        to: headerVal(headers, 'to'),
        subject: headerVal(headers, 'subject'),
        date: headerVal(headers, 'date'),
        messageId: headerVal(headers, 'message-id'),
        body_text: text,
        body_html: html,
        timestamp: ts.toISOString(),
        is_read: !msg.labelIds?.includes('UNREAD'),
        labelIds: msg.labelIds ?? [],
        snippet: msg.snippet,
      };
    });

    return NextResponse.json({ threadId: id, messages });
  } catch (err: any) {
    console.error('[gmail/threads/id] Error:', err?.message);
    return NextResponse.json({ error: err?.message ?? 'Gmail API error' }, { status: 500 });
  }
}
