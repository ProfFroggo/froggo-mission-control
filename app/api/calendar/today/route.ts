// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuthenticatedClient } from '@/lib/googleAuth';

export async function GET() {
  const client = await getAuthenticatedClient();
  const date = new Date().toISOString().split('T')[0];

  if (!client) {
    return NextResponse.json({ events: [], date });
  }

  try {
    const calendar = google.calendar({ version: 'v3', auth: client });

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const res = await calendar.events.list({
      calendarId: 'primary',
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 20,
    });

    // Return in CalendarEvent format (matches global.d.ts interface)
    const events = (res.data.items ?? []).map(evt => ({
      id: evt.id ?? '',
      summary: evt.summary ?? '(No title)',
      title: evt.summary ?? '(No title)',
      description: evt.description ?? '',
      location: evt.location ?? '',
      source: 'google' as const,
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
      attendees: (evt.attendees ?? []).map(a => ({
        email: a.email ?? '',
        responseStatus: a.responseStatus ?? 'needsAction',
        organizer: a.organizer ?? false,
      })),
      conferenceData: evt.conferenceData ? {
        entryPoints: (evt.conferenceData.entryPoints ?? []).map(ep => ({
          uri: ep.uri ?? '',
          entryPointType: ep.entryPointType ?? '',
        })),
      } : undefined,
      htmlLink: evt.htmlLink,
    }));

    return NextResponse.json({ events, date });
  } catch (err: any) {
    console.error('[calendar/today] Error:', err?.message);
    return NextResponse.json({ events: [], date });
  }
}
