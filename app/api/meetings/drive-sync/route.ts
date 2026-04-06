// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * Google Drive sync for meeting transcripts.
 *
 * GET  /api/meetings/drive-sync?folderId=xxx   — list files in folder
 * GET  /api/meetings/drive-sync?action=sync-now — trigger manual cron run
 * POST /api/meetings/drive-sync                — import one file
 *   body: { fileId, fileName }
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/apiAuth';
import { getAuthenticatedClient } from '@/lib/googleAuth';
import { google } from 'googleapis';
import { ENV } from '@/lib/env';
import fs from 'fs';
import path from 'path';
import {
  getGeminiKey,
  extractiveSummary,
  generateGeminiSummary,
  extractTaskProposals,
} from '@/lib/meetingProcessing';

export const dynamic = 'force-dynamic';

// ── GET — list files in folder OR trigger manual sync ─────────────────────────
export async function GET(req: NextRequest) {
  const authError = requireAuth(req);
  if (authError) return authError;

  const { searchParams } = new URL(req.url);

  // Manual sync trigger — runs the cron logic immediately
  if (searchParams.get('action') === 'sync-now') {
    try {
      const { runDriveSync } = await import('@/lib/driveSyncCron');
      const result = await runDriveSync();
      return NextResponse.json(result);
    } catch (err) {
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }

  // List files in a specific folder
  const folderId = searchParams.get('folderId')?.trim();
  if (!folderId) {
    return NextResponse.json({ error: 'folderId is required' }, { status: 400 });
  }

  const client = await getAuthenticatedClient();
  if (!client) {
    return NextResponse.json(
      { error: 'Google not connected. Connect Google in Settings → Integrations.' },
      { status: 401 }
    );
  }

  try {
    const drive = google.drive({ version: 'v3', auth: client });

    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false and (mimeType = 'application/vnd.google-apps.document' or mimeType = 'text/plain' or mimeType = 'text/markdown')`,
      fields: 'files(id, name, mimeType, modifiedTime, size)',
      orderBy: 'modifiedTime desc',
      pageSize: 50,
    });

    const files = res.data.files ?? [];

    // Mark already-imported files
    const { getDb } = await import('@/lib/database');
    const db = getDb();
    const importedRows = db.prepare(
      `SELECT metadata FROM scheduled_items WHERE type = 'meeting' AND metadata LIKE '%driveFileId%'`
    ).all() as Array<{ metadata: string }>;

    const importedIds = new Set<string>();
    for (const row of importedRows) {
      try {
        const meta = JSON.parse(row.metadata);
        if (meta.driveFileId) importedIds.add(meta.driveFileId);
      } catch (err) { console.warn('[meetings/drive-sync] Non-critical: skip:', err); }
    }

    return NextResponse.json({
      files: files.map(f => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        modifiedTime: f.modifiedTime,
        alreadyImported: importedIds.has(f.id!),
      })),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[meetings/drive-sync] List error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ── POST — import one file ────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const authError = requireAuth(req);
  if (authError) return authError;

  let fileId: string, fileName: string;
  try {
    const body = await req.json();
    fileId = body.fileId;
    fileName = body.fileName;
  } catch (err) {
    console.warn('[meetings/drive-sync] Non-critical:', err);
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!fileId || !fileName) {
    return NextResponse.json({ error: 'fileId and fileName are required' }, { status: 400 });
  }

  const client = await getAuthenticatedClient();
  if (!client) {
    return NextResponse.json({ error: 'Google not connected' }, { status: 401 });
  }

  try {
    const drive = google.drive({ version: 'v3', auth: client });

    // Get file metadata to determine type
    const meta = await drive.files.get({ fileId, fields: 'id, name, mimeType' });
    const mimeType = meta.data.mimeType ?? '';

    // Download / export content
    let content: string;
    if (mimeType === 'application/vnd.google-apps.document') {
      const exportRes = await drive.files.export({ fileId, mimeType: 'text/plain' }, { responseType: 'text' });
      content = exportRes.data as string;
    } else {
      const dlRes = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'text' });
      content = dlRes.data as string;
    }

    if (!content?.trim()) {
      return NextResponse.json({ error: 'File is empty' }, { status: 422 });
    }

    // ── Save to library ───────────────────────────────────────────────────────
    const meetingsDir = path.join(ENV.LIBRARY_PATH, 'docs', 'meetings');
    fs.mkdirSync(meetingsDir, { recursive: true });

    const today = new Date().toISOString().slice(0, 10);
    const safeName = fileName
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 80);
    const savedFilename = `${today}_${safeName}.md`;
    const savedPath = path.join(meetingsDir, savedFilename);

    const mdContent = [
      `# Meeting Transcript: ${safeName.replace(/_/g, ' ')}`,
      ``,
      `**Source**: Google Drive`,
      ``,
      `---`,
      ``,
      content.trim(),
    ].join('\n');

    fs.writeFileSync(savedPath, mdContent, 'utf-8');

    // ── Generate summary ──────────────────────────────────────────────────────
    let summary: string;
    let oneLiner = '';
    let meetingTitle = safeName.replace(/_/g, ' ');
    let summarySource: 'gemini' | 'extractive' = 'extractive';
    let meetingDate: string | null = null;

    const apiKey = await getGeminiKey();
    if (apiKey) {
      try {
        const result = await generateGeminiSummary(content, apiKey);
        summary = result.summary;
        oneLiner = result.oneLiner;
        meetingDate = result.meetingDate;
        if (result.title) meetingTitle = result.title;
        summarySource = 'gemini';
      } catch (err) {
        console.warn('[meetings/drive-sync] Non-critical:', err);
        summary = extractiveSummary(content);
      }
    } else {
      summary = extractiveSummary(content);
    }

    if (!oneLiner) {
      oneLiner = summary.replace(/[#*_]/g, '').split(/[.!?\n]/)[0]?.trim().slice(0, 120) || 'Meeting transcript imported from Google Drive';
    }

    // ── Extract task proposals ────────────────────────────────────────────────
    let taskProposals: Awaited<ReturnType<typeof extractTaskProposals>> = [];
    if (apiKey) {
      try {
        taskProposals = await extractTaskProposals(content, apiKey);
      } catch (err) { console.warn('[meetings/drive-sync] Non-critical:', err); }
    }

    // ── Save meeting record ───────────────────────────────────────────────────
    const { getDb } = await import('@/lib/database');
    const db = getDb();
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
        driveFileId: fileId,
        driveName: fileName,
        taskProposals: taskProposals.slice(0, 10),
      }),
      now, now
    );

    return NextResponse.json({
      success: true,
      meetingId,
      savedPath,
      summary,
      summarySource,
      taskProposals: taskProposals.map((tp, i) => ({
        id: `proposal-${Date.now()}-${i}`,
        ...tp,
        status: 'pending' as const,
      })),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[meetings/drive-sync] Import error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
