// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// Bitso Onchain Mixpanel metrics — EU project 3762248
// Key events: trade_transaction (fromAmountUSD), swap_confirmed_onchain,
//             users_created, auth_success, auth_failed, transfer_transaction (amountUSD)
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MP = 'https://eu.mixpanel.com/api/2.0';

interface SettingRow { value: string }

function getSetting(db: ReturnType<typeof getDb>, key: string): string | null {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as SettingRow | undefined;
  if (!row) return null;
  try { return JSON.parse(row.value) as string; } catch { return row.value; }
}

function auth(user: string, pass: string) {
  return 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
}

async function mpGet(path: string, authHeader: string, params: Record<string, string>) {
  const url = new URL(`${MP}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), {
    headers: { Authorization: authHeader, Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json();
}

function dateStr(d: Date) { return d.toISOString().slice(0, 10); }

function sumEventValues(data: { data?: { values?: Record<string, Record<string, number>> } }): number {
  const values = data?.data?.values ?? {};
  return Object.values(values).flatMap(Object.values).reduce((s, v) => s + v, 0);
}

function getSparkSeries(
  data: { data?: { series?: string[]; values?: Record<string, Record<string, number>> } },
  days: number,
): number[] {
  const series: string[] = data?.data?.series ?? [];
  const values = data?.data?.values ?? {};
  return series.slice(-days).map((date) =>
    Object.values(values).reduce((s, ev) => s + (ev[date] ?? 0), 0),
  );
}

// GET /api/mixpanel/metrics?days=1|2
export async function GET(request: NextRequest) {
  const db = getDb();
  const projectId = getSetting(db, 'mixpanel_project_id');
  const user      = getSetting(db, 'mixpanel_service_account_username');
  const pass      = getSetting(db, 'mixpanel_service_account_password');

  if (!projectId || !user || !pass) {
    return NextResponse.json({ configured: false });
  }

  const days = Math.max(1, Math.min(7, Number(new URL(request.url).searchParams.get('days') ?? '1')));
  const authHdr = auth(user, pass);
  const today = new Date();
  const from = dateStr(new Date(today.getTime() - (days - 1) * 86_400_000));
  const to = dateStr(today);
  const interval = String(days + 1);

  try {
    const results = await Promise.allSettled([
      // 0: Confirmed swaps (count + sparkline)
      mpGet('events', authHdr, {
        project_id: projectId,
        event: JSON.stringify(['swap_confirmed_onchain']),
        type: 'general', unit: 'day', interval,
      }),
      // 1: New users
      mpGet('events', authHdr, {
        project_id: projectId,
        event: JSON.stringify(['users_created']),
        type: 'general', unit: 'day', interval,
      }),
      // 2: Auth success
      mpGet('events', authHdr, {
        project_id: projectId,
        event: JSON.stringify(['auth_success']),
        type: 'general', unit: 'day', interval,
      }),
      // 3: Auth failed
      mpGet('events', authHdr, {
        project_id: projectId,
        event: JSON.stringify(['auth_failed']),
        type: 'general', unit: 'day', interval,
      }),
      // 4: Swap volume USD (trade_transaction.fromAmountUSD)
      mpGet('segmentation/sum', authHdr, {
        project_id: projectId,
        event: 'trade_transaction',
        on: 'properties["fromAmountUSD"]',
        from_date: from, to_date: to, unit: 'day',
      }),
      // 5: Transfer volume USD (transfer_transaction.amountUSD)
      mpGet('segmentation/sum', authHdr, {
        project_id: projectId,
        event: 'transfer_transaction',
        on: 'properties["amountUSD"]',
        from_date: from, to_date: to, unit: 'day',
      }),
    ]);

    const val = <T>(i: number): T | null =>
      results[i].status === 'fulfilled' ? (results[i] as PromiseFulfilledResult<T>).value : null;

    const swapsData     = val<{ data?: { series?: string[]; values?: Record<string, Record<string, number>> } }>(0);
    const newUsersData  = val<{ data?: { values?: Record<string, Record<string, number>> } }>(1);
    const authOkData    = val<{ data?: { values?: Record<string, Record<string, number>> } }>(2);
    const authFailData  = val<{ data?: { values?: Record<string, Record<string, number>> } }>(3);
    const volData       = val<{ results?: Record<string, number> }>(4);
    const xferData      = val<{ results?: Record<string, number> }>(5);

    const confirmedSwaps  = swapsData  ? sumEventValues(swapsData)  : 0;
    const newUsers        = newUsersData  ? sumEventValues(newUsersData)  : 0;
    const authSuccess     = authOkData   ? sumEventValues(authOkData)   : 0;
    const authFailed      = authFailData ? sumEventValues(authFailData) : 0;
    const swapVolumeUsd   = volData  ? Object.values(volData.results ?? {}).reduce((s, v) => s + v, 0) : 0;
    const xferVolumeUsd   = xferData ? Object.values(xferData.results ?? {}).reduce((s, v) => s + v, 0) : 0;
    const swapSparkData   = swapsData ? getSparkSeries(swapsData, days) : [];

    return NextResponse.json({
      configured: true,
      days,
      confirmedSwaps,
      newUsers,
      authSuccess,
      authFailed,
      swapVolumeUsd,
      xferVolumeUsd,
      swapSparkData,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[mixpanel/metrics]', msg);
    return NextResponse.json({ configured: true, error: msg }, { status: 500 });
  }
}
