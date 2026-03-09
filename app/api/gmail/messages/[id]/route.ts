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
    const msg = await gmail.users.messages.get({ userId: 'me', id, format: 'full' });
    const data = msg.data;
    const headers = data.payload?.headers ?? [];
    const { text, html } = extractBody(data.payload);

    return NextResponse.json({
      id: data.id,
      threadId: data.threadId,
      labelIds: data.labelIds ?? [],
      subject: headerVal(headers, 'subject'),
      from: headerVal(headers, 'from'),
      to: headerVal(headers, 'to'),
      cc: headerVal(headers, 'cc'),
      date: headerVal(headers, 'date'),
      messageId: headerVal(headers, 'message-id'),
      body_text: text,
      body_html: html,
      is_read: !data.labelIds?.includes('UNREAD'),
      is_starred: data.labelIds?.includes('STARRED'),
      snippet: data.snippet,
    });
  } catch (err: any) {
    console.error('[gmail/messages/id] Error:', err?.message);
    return NextResponse.json({ error: err?.message ?? 'Gmail API error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const client = await getAuthenticatedClient();
  if (!client) {
    return NextResponse.json({ error: 'Not authenticated', needsAuth: true }, { status: 401 });
  }

  try {
    const body = await request.json();
    const gmail = google.gmail({ version: 'v1', auth: client });

    const addLabelIds: string[] = [];
    const removeLabelIds: string[] = [];

    if (body.read === true) removeLabelIds.push('UNREAD');
    if (body.read === false) addLabelIds.push('UNREAD');
    if (body.starred === true) addLabelIds.push('STARRED');
    if (body.starred === false) removeLabelIds.push('STARRED');
    if (body.archived === true) removeLabelIds.push('INBOX');

    if (addLabelIds.length > 0 || removeLabelIds.length > 0) {
      await gmail.users.messages.modify({
        userId: 'me',
        id,
        requestBody: { addLabelIds, removeLabelIds },
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[gmail/messages/id PATCH] Error:', err?.message);
    return NextResponse.json({ error: err?.message ?? 'Gmail API error' }, { status: 500 });
  }
}
