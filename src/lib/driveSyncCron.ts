// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * Drive Sync Cron — checks the configured Google Drive folder every hour
 * and auto-imports any new meeting transcript files found there.
 * Files receive the same full processing as manual uploads:
 * Gemini summary + task proposal extraction + smart meeting date detection.
 */

import { getDb } from './database';
import { getAuthenticatedClient } from './googleAuth';
import { google } from 'googleapis';
import { ENV } from './env';
import fs from 'fs';
import path from 'path';
import {
  getGeminiKey,
  extractiveSummary,
  generateGeminiSummary,
  extractTaskProposals,
} from './meetingProcessing';

const INTERVAL_MS = 60 * 60_000; // 1 hour

// ── Core sync logic ───────────────────────────────────────────────────────────

export async function runDriveSync(): Promise<{ imported: number; skipped: number; error?: string }> {
  const db = getDb();

  // Read saved folder ID from settings
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('meetings.driveFolder.id') as
    | { value: string }
    | undefined;

  const folderId = row?.value ? (JSON.parse(row.value) as string) : null;
  if (!folderId) return { imported: 0, skipped: 0 };

  const client = await getAuthenticatedClient();
  if (!client) {
    console.warn('[DriveSyncCron] Google not authenticated — skipping');
    return { imported: 0, skipped: 0, error: 'Google not authenticated' };
  }

  let files: Array<{ id: string; name: string; mimeType: string }> = [];
  try {
    const drive = google.drive({ version: 'v3', auth: client });
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false and (mimeType = 'application/vnd.google-apps.document' or mimeType = 'text/plain' or mimeType = 'text/markdown')`,
      fields: 'files(id, name, mimeType)',
      orderBy: 'modifiedTime desc',
      pageSize: 50,
    });
    files = (res.data.files ?? []) as Array<{ id: string; name: string; mimeType: string }>;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[DriveSyncCron] Failed to list files:', msg);
    return { imported: 0, skipped: 0, error: msg };
  }

  if (files.length === 0) return { imported: 0, skipped: 0 };

  // Find already-imported file IDs
  const importedRows = db.prepare(
    `SELECT metadata FROM scheduled_items WHERE type = 'meeting' AND metadata LIKE '%driveFileId%'`
  ).all() as Array<{ metadata: string }>;

  const importedIds = new Set<string>();
  for (const r of importedRows) {
    try {
      const meta = JSON.parse(r.metadata);
      if (meta.driveFileId) importedIds.add(meta.driveFileId);
    } catch (err) {
      console.warn('[driveSyncCron] Failed to parse imported meeting metadata:', err);
    }
  }

  const toImport = files.filter(f => !importedIds.has(f.id));
  if (toImport.length === 0) return { imported: 0, skipped: files.length };

  const drive = google.drive({ version: 'v3', auth: client });
  const apiKey = await getGeminiKey();
  let imported = 0;

  for (const file of toImport) {
    try {
      // Download / export content
      let content: string;
      if (file.mimeType === 'application/vnd.google-apps.document') {
        const exportRes = await drive.files.export({ fileId: file.id, mimeType: 'text/plain' }, { responseType: 'text' });
        content = exportRes.data as string;
      } else {
        const dlRes = await drive.files.get({ fileId: file.id, alt: 'media' }, { responseType: 'text' });
        content = dlRes.data as string;
      }

      if (!content?.trim()) continue;

      // ── Save to library ────────────────────────────────────────────────────
      const meetingsDir = path.join(ENV.LIBRARY_PATH, 'docs', 'meetings');
      fs.mkdirSync(meetingsDir, { recursive: true });

      const today = new Date().toISOString().slice(0, 10);
      const safeName = file.name
        .replace(/\.[^/.]+$/, '')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .slice(0, 80);
      const savedFilename = `${today}_${safeName}.md`;
      const savedPath = path.join(meetingsDir, savedFilename);

      fs.writeFileSync(savedPath, [
        `# Meeting Transcript: ${safeName.replace(/_/g, ' ')}`,
        ``,
        `**Source**: Google Drive (auto-sync)`,
        ``,
        `---`,
        ``,
        content.trim(),
      ].join('\n'), 'utf-8');

      // ── Generate summary ───────────────────────────────────────────────────
      let summary = '';
      let oneLiner = '';
      let meetingTitle = safeName.replace(/_/g, ' ');
      let summarySource: 'gemini' | 'extractive' = 'extractive';
      let meetingDate: string | null = null;

      if (apiKey) {
        try {
          const result = await generateGeminiSummary(content, apiKey);
          summary = result.summary;
          oneLiner = result.oneLiner;
          meetingDate = result.meetingDate;
          if (result.title) meetingTitle = result.title;
          summarySource = 'gemini';
        } catch (err) {
          console.warn('[driveSyncCron] Gemini summary failed, falling back to extractive:', err);
        }
      }

      if (!summary) {
        summary = extractiveSummary(content);
        summarySource = 'extractive';
      }
      if (!oneLiner) {
        oneLiner = summary.replace(/[#*_]/g, '').split(/[.!?\n]/)[0]?.trim().slice(0, 120)
          || 'Meeting transcript auto-imported from Google Drive';
      }

      // ── Extract task proposals ─────────────────────────────────────────────
      let taskProposals: Awaited<ReturnType<typeof extractTaskProposals>> = [];
      if (apiKey) {
        try {
          taskProposals = await extractTaskProposals(content, apiKey);
        } catch (err) {
          console.warn('[driveSyncCron] Non-critical: task proposal extraction failed:', err);
        }
      }

      // ── Save meeting record ────────────────────────────────────────────────
      const meetingId = `meeting-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const now = Date.now();
      const scheduledFor = meetingDate ?? today;

      db.prepare(`
        INSERT INTO scheduled_items (id, title, description, type, content, scheduledFor, scheduledAt, status, metadata, createdAt, updatedAt)
        VALUES (?, ?, ?, 'meeting', ?, ?, ?, 'completed', ?, ?, ?)
      `).run(
        meetingId,
        meetingTitle,
        oneLiner,
        content.slice(0, 5000),
        scheduledFor,
        now,
        JSON.stringify({
          filePath: savedPath,
          summarySource,
          summary,
          driveFileId: file.id,
          driveName: file.name,
          autoImported: true,
          taskProposals: taskProposals.slice(0, 10),
        }),
        now, now
      );

      // Store sync activity log
      try {
        db.prepare(
          `INSERT INTO activity (type, message, agentId, timestamp) VALUES ('system', ?, 'system', ?)`
        ).run(`Drive sync: imported "${meetingTitle}" from Google Drive`, now);
      } catch (err) {
        console.warn('[driveSyncCron] Non-critical: failed to log drive sync activity:', err);
      }

      imported++;
      console.log(`[DriveSyncCron] Imported: ${file.name} (date: ${scheduledFor}, tasks: ${taskProposals.length})`);
    } catch (err) {
      console.error(`[DriveSyncCron] Failed to import ${file.name}:`, err instanceof Error ? err.message : err);
    }
  }

  if (imported > 0) {
    console.log(`[DriveSyncCron] Sync complete — ${imported} imported, ${files.length - toImport.length} already present`);
  }

  return { imported, skipped: files.length - toImport.length };
}

// ── Cron timer ────────────────────────────────────────────────────────────────

type G = typeof globalThis & { _driveSyncCron?: ReturnType<typeof setInterval> | true };

export function startDriveSyncCron(): void {
  const g = globalThis as G;
  if (g._driveSyncCron) return;
  g._driveSyncCron = true;

  // Run immediately on start, then every hour
  runDriveSync().catch(err => console.error('[DriveSyncCron] Initial run error:', err));

  const interval = setInterval(() => {
    runDriveSync().catch(err => console.error('[DriveSyncCron] Error:', err));
  }, INTERVAL_MS);
  interval.unref?.();
  g._driveSyncCron = interval;

  console.log('[DriveSyncCron] Started — syncs Google Drive folder every hour');
}
