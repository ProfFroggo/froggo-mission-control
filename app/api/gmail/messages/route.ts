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

    if (mimeType === 'text/plain' && body) {
      text = decodeBase64(body);
    } else if (mimeType === 'text/html' && body) {
      html = decodeBase64(body);
    }
    if (part.parts) {
      part.parts.forEach(traverse);
    }
  }

  traverse(payload);
  return { text, html };
}

function headerVal(headers: Array<{ name?: string | null; value?: string | null }>, name: string): string {
  return headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value ?? '';
}

function buildConversationItem(msg: any) {
  const headers = msg.payload?.headers ?? [];
  const subject = headerVal(headers, 'subject');
  const from = headerVal(headers, 'from');
  const date = headerVal(headers, 'date');
  const { text, html } = extractBody(msg.payload);
  const preview = text.slice(0, 200).replace(/\n+/g, ' ').trim() || subject;
  const hasAttachment = (msg.payload?.parts ?? []).some((p: any) => p.filename && p.filename.length > 0);

  const ts = msg.internalDate ? new Date(parseInt(msg.internalDate)) : new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - ts.getTime();
  const diffH = Math.floor(diffMs / 3600000);
  const diffD = Math.floor(diffMs / 86400000);
  let relativeTime = diffH < 1 ? 'just now' : diffH < 24 ? `${diffH}h ago` : diffD < 7 ? `${diffD}d ago` : ts.toLocaleDateString();

  return {
    id: msg.id,
    platform: 'email',
    thread_id: msg.threadId,
    from,
    name: from.replace(/<[^>]+>/, '').trim(),
    subject,
    preview,
    timestamp: ts.toISOString(),
    relativeTime,
    is_read: !msg.labelIds?.includes('UNREAD'),
    is_starred: msg.labelIds?.includes('STARRED'),
    has_attachment: hasAttachment,
    _body_text: text,
    _body_html: html,
    labelIds: msg.labelIds ?? [],
  };
}

export async function GET(request: NextRequest) {
  const client = await getAuthenticatedClient();
  if (!client) {
    return NextResponse.json({ error: 'Not authenticated', needsAuth: true }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') ?? 'in:inbox';
  const maxResults = parseInt(searchParams.get('maxResults') ?? '50');
  const pageToken = searchParams.get('pageToken') ?? undefined;
  const labelIds = searchParams.get('labelIds')?.split(',') ?? ['INBOX'];

  try {
    const gmail = google.gmail({ version: 'v1', auth: client });

    // List message IDs
    const listRes = await gmail.users.messages.list({
      userId: 'me',
      q,
      maxResults,
      pageToken,
      labelIds,
    });

    const messageIds = listRes.data.messages ?? [];
    if (messageIds.length === 0) {
      return NextResponse.json({ messages: [], nextPageToken: null });
    }

    // Batch fetch full message details
    const messages = await Promise.all(
      messageIds.map(({ id }) =>
        gmail.users.messages.get({ userId: 'me', id: id!, format: 'full' })
          .then(r => r.data)
          .catch(() => null)
      )
    );

    const items = messages
      .filter(Boolean)
      .map(buildConversationItem);

    return NextResponse.json({
      messages: items,
      nextPageToken: listRes.data.nextPageToken ?? null,
    });
  } catch (err: any) {
    const msg: string = err?.message ?? String(err) ?? 'Gmail API error';
    console.error('[gmail/messages] Error:', msg);
    // Signal auth-level errors so the client can show setup UI
    const isAuthError = msg.includes('deleted_client') || msg.includes('invalid_client') || msg.includes('invalid_grant') || msg.includes('unauthorized');
    if (isAuthError) {
      return NextResponse.json({ error: msg, needsAuth: true }, { status: 401 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
