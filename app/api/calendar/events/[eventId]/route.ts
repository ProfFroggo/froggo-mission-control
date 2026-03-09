// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuthenticatedClient } from '@/lib/googleAuth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  const client = await getAuthenticatedClient();
  if (!client) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  try {
    const calendar = google.calendar({ version: 'v3', auth: client });
    const { searchParams } = new URL(request.url);
    const calendarId = searchParams.get('calendarId') ?? 'primary';
    const res = await calendar.events.get({ calendarId, eventId });
    const evt = res.data;

    return NextResponse.json({
      id: evt.id ?? '',
      summary: evt.summary ?? '(No title)',
      title: evt.summary ?? '(No title)',
      description: evt.description ?? '',
      location: evt.location ?? '',
      source: 'google',
      start: { dateTime: evt.start?.dateTime ?? undefined, date: evt.start?.date ?? undefined },
      end: { dateTime: evt.end?.dateTime ?? undefined, date: evt.end?.date ?? undefined },
      status: evt.status,
      attendees: (evt.attendees ?? []).map(a => ({ email: a.email ?? '', responseStatus: a.responseStatus ?? 'needsAction' })),
      htmlLink: evt.htmlLink,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  const client = await getAuthenticatedClient();
  if (!client) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  try {
    const body = await request.json();
    const calendar = google.calendar({ version: 'v3', auth: client });
    const calendarId = body.calendarId ?? 'primary';

    const res = await calendar.events.patch({
      calendarId,
      eventId,
      requestBody: {
        summary: body.summary ?? body.title,
        description: body.description,
        location: body.location,
        start: body.start ? (body.isAllDay ? { date: body.start } : { dateTime: body.start }) : undefined,
        end: body.end ? (body.isAllDay ? { date: body.end } : { dateTime: body.end }) : undefined,
      },
    });

    return NextResponse.json({ success: true, id: res.data.id });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  const client = await getAuthenticatedClient();
  if (!client) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const calendarId = searchParams.get('calendarId') ?? 'primary';
    const calendar = google.calendar({ version: 'v3', auth: client });
    await calendar.events.delete({ calendarId, eventId });
    return NextResponse.json({ success: true, id: eventId });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
