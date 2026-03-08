import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuthenticatedClient } from '@/lib/googleAuth';

function mapEvent(evt: any, calendarId: string) {
  return {
    id: evt.id ?? '',
    summary: evt.summary ?? '(No title)',
    title: evt.summary ?? '(No title)',
    description: evt.description ?? '',
    location: evt.location ?? '',
    source: 'google' as const,
    calendarId,
    start: {
      dateTime: evt.start?.dateTime ?? undefined,
      date: evt.start?.date ?? undefined,
      timeZone: evt.start?.timeZone ?? undefined,
    },
    end: {
      dateTime: evt.end?.dateTime ?? undefined,
      date: evt.end?.date ?? undefined,
      timeZone: evt.end?.timeZone ?? undefined,
    },
    status: evt.status,
    organizer: evt.organizer?.email,
    attendees: (evt.attendees ?? []).map((a: any) => ({
      email: a.email ?? '',
      responseStatus: a.responseStatus ?? 'needsAction',
      organizer: a.organizer ?? false,
    })),
    conferenceData: evt.conferenceData ? {
      entryPoints: (evt.conferenceData.entryPoints ?? []).map((ep: any) => ({
        uri: ep.uri ?? '',
        entryPointType: ep.entryPointType ?? '',
      })),
    } : undefined,
    htmlLink: evt.htmlLink,
  };
}

export async function GET(request: NextRequest) {
  const client = await getAuthenticatedClient();
  if (!client) {
    return NextResponse.json({ events: [], errors: [] }); // Graceful empty if not authed
  }

  const { searchParams } = new URL(request.url);
  const calendarId = searchParams.get('calendarId') ?? 'primary';

  // Support both ?days=N and explicit ?timeMin/timeMax
  const days = parseInt(searchParams.get('days') ?? '0');
  const now = new Date();
  const timeMin = searchParams.get('timeMin') ?? now.toISOString();
  const timeMax = searchParams.get('timeMax') ?? (() => {
    const d = new Date(now);
    d.setDate(d.getDate() + (days > 0 ? days : 30));
    return d.toISOString();
  })();
  const maxResults = parseInt(searchParams.get('maxResults') ?? '100');

  try {
    const calendar = google.calendar({ version: 'v3', auth: client });
    const res = await calendar.events.list({
      calendarId,
      timeMin,
      timeMax,
      maxResults,
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = (res.data.items ?? []).map(evt => mapEvent(evt, calendarId));
    return NextResponse.json({ events, errors: [] });
  } catch (err: any) {
    console.error('[calendar/events] Error:', err?.message);
    return NextResponse.json({ events: [], errors: [err?.message ?? 'Calendar API error'] });
  }
}

export async function POST(request: NextRequest) {
  const client = await getAuthenticatedClient();
  if (!client) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const calendar = google.calendar({ version: 'v3', auth: client });

    const res = await calendar.events.insert({
      calendarId: body.calendarId ?? 'primary',
      requestBody: {
        summary: body.title ?? body.summary,
        description: body.description,
        location: body.location,
        start: body.allDay ? { date: body.start } : { dateTime: body.start },
        end: body.allDay ? { date: body.end } : { dateTime: body.end },
        attendees: body.attendees?.map((email: string) => ({ email })),
      },
    });

    return NextResponse.json(mapEvent(res.data, body.calendarId ?? 'primary'), { status: 201 });
  } catch (err: any) {
    console.error('[calendar/events POST] Error:', err?.message);
    return NextResponse.json({ error: err?.message ?? 'Calendar API error' }, { status: 500 });
  }
}
