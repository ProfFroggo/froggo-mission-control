import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuthenticatedClient } from '@/lib/googleAuth';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// Build virtual calendar events from cron schedule jobs
function cronJobsAsEvents(timeMin: string, timeMax: string) {
  const schedulePath = join(homedir(), 'mission-control/data/schedule.json');
  if (!existsSync(schedulePath)) return [];
  let jobs: any[] = [];
  try {
    const parsed = JSON.parse(readFileSync(schedulePath, 'utf-8'));
    jobs = Array.isArray(parsed) ? parsed : [];
  } catch { return []; }

  const min = new Date(timeMin).getTime();
  const max = new Date(timeMax).getTime();
  const events: any[] = [];

  for (const job of jobs) {
    if (!job.enabled || job.schedule?.kind !== 'cron' || !job.schedule?.expr) continue;
    // Simple: project the next occurrences within the window based on common patterns
    const expr: string = job.schedule.expr;
    const occurrences = expandCronInWindow(expr, min, max);
    for (const ts of occurrences) {
      const start = new Date(ts);
      const end = new Date(ts + 30 * 60 * 1000); // 30-min placeholder duration
      events.push({
        id: `cron-${job.id}-${ts}`,
        summary: job.name,
        title: job.name,
        description: job.description ?? '',
        location: '',
        source: 'cron' as const,
        calendarId: 'cron',
        start: { dateTime: start.toISOString(), timeZone: 'UTC' },
        end: { dateTime: end.toISOString(), timeZone: 'UTC' },
        status: 'confirmed',
        organizer: 'hr',
        attendees: [],
      });
    }
  }
  return events;
}

// Expand a cron expression into UTC timestamps within [min, max]
// Only handles the patterns actually used in schedule.json
function expandCronInWindow(expr: string, minMs: number, maxMs: number): number[] {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return [];
  const [minute, hour, dom, , dow] = parts;
  const results: number[] = [];
  const cursor = new Date(minMs);
  cursor.setUTCSeconds(0, 0);
  // Advance to next minute boundary
  cursor.setUTCMinutes(cursor.getUTCMinutes() + 1);

  const end = new Date(maxMs);
  while (cursor <= end) {
    const m = cursor.getUTCMinutes();
    const h = cursor.getUTCHours();
    const d = cursor.getUTCDay(); // 0=Sun
    const dom_ = cursor.getUTCDate();

    const matchMin = minute === '*' || minute.startsWith('*/') ? (minute === '*' || m % parseInt(minute.slice(2)) === 0) : parseInt(minute) === m;
    const matchHour = hour === '*' || parseInt(hour) === h;
    const matchDom = dom === '*' || parseInt(dom) === dom_;
    const matchDow = dow === '*' || dow.split(',').map(Number).includes(d);

    if (matchMin && matchHour && matchDom && matchDow) {
      results.push(cursor.getTime());
    }
    cursor.setUTCMinutes(cursor.getUTCMinutes() + 1);
    // Safety: cap at 10k iterations per job
    if (results.length > 50) break;
  }
  return results;
}

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

  const client = await getAuthenticatedClient();
  if (!client) {
    // Not authenticated — return cron events only
    return NextResponse.json({ events: cronJobsAsEvents(timeMin, timeMax), errors: [] });
  }
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
    const cronEvents = cronJobsAsEvents(timeMin, timeMax);
    return NextResponse.json({ events: [...events, ...cronEvents], errors: [] });
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
