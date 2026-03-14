// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import type { CatalogModuleRow } from '@/types/catalog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export type ModuleHealthStatus = 'healthy' | 'warning' | 'error';

export type ModuleHealth = {
  moduleId: string;
  status: ModuleHealthStatus;
  lastActivityAt: number | null;
  errorCount24h: number;
};

// GET /api/modules/health — health check for all installed modules
export async function GET() {
  try {
    const db = getDb();
    const now = Date.now();
    const windowMs = 24 * 60 * 60 * 1000;
    const cutoff = now - windowMs;

    const installedModules = db.prepare(
      "SELECT id, name, lastActivityAt, errorCount FROM catalog_modules WHERE installed = 1"
    ).all() as (Pick<CatalogModuleRow, 'id' | 'name'> & { lastActivityAt: number | null; errorCount: number | null })[];

    const health: ModuleHealth[] = installedModules.map(mod => {
      // Count errors from task_activity in last 24h where source matches module name
      let errorCount24h = 0;
      try {
        const errorRow = db.prepare(
          `SELECT COUNT(*) as c FROM task_activity
           WHERE source = ? AND timestamp >= ? AND (action = 'error' OR message LIKE '%error%' OR message LIKE '%failed%')`
        ).get(mod.id, cutoff) as { c: number } | undefined;
        errorCount24h = errorRow?.c ?? 0;
      } catch {
        // task_activity.source column may not exist — fallback to errorCount field
        errorCount24h = mod.errorCount ?? 0;
      }

      const lastActivityAt = mod.lastActivityAt ?? null;
      const hoursSinceActivity = lastActivityAt
        ? (now - lastActivityAt) / (1000 * 60 * 60)
        : null;

      let status: ModuleHealthStatus;
      if (errorCount24h >= 5) {
        status = 'error';
      } else if (errorCount24h >= 1 || (hoursSinceActivity !== null && hoursSinceActivity > 48)) {
        status = 'warning';
      } else {
        status = 'healthy';
      }

      return {
        moduleId: mod.id,
        status,
        lastActivityAt,
        errorCount24h,
      };
    });

    const summary = {
      healthy: health.filter(h => h.status === 'healthy').length,
      warning: health.filter(h => h.status === 'warning').length,
      error: health.filter(h => h.status === 'error').length,
      total: health.length,
    };

    return NextResponse.json({ health, summary });
  } catch (error) {
    console.error('GET /api/modules/health error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
