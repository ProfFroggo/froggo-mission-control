import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuthenticatedClient } from '@/lib/googleAuth';

export async function GET() {
  const client = await getAuthenticatedClient();
  if (!client) {
    return NextResponse.json([]);
  }

  try {
    const calendar = google.calendar({ version: 'v3', auth: client });
    const res = await calendar.calendarList.list();

    const calendars = (res.data.items ?? []).map(cal => ({
      id: cal.id,
      summary: cal.summary,
      description: cal.description,
      primary: cal.primary ?? false,
      backgroundColor: cal.backgroundColor,
      foregroundColor: cal.foregroundColor,
      accessRole: cal.accessRole,
      selected: cal.selected ?? true,
    }));

    return NextResponse.json(calendars);
  } catch (err: any) {
    console.error('[calendar/calendars] Error:', err?.message);
    return NextResponse.json([]);
  }
}
