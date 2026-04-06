// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// POST /api/meetings/transcript — Upload transcript text, save to library, generate summary + extract action items
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/apiAuth';
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

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_EXTENSIONS = ['.txt', '.md'];

export async function POST(req: NextRequest) {
  const authError = requireAuth(req);
  if (authError) return authError;

  try {
    const body = await req.json();
    const { content, filename } = body as { content?: string; filename?: string };

    // ── Validation ──────────────────────────────────────────────────────────
    if (!content || typeof content !== 'string' || !content.trim()) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 });
    }

    if (!filename || typeof filename !== 'string') {
      return NextResponse.json({ error: 'filename is required' }, { status: 400 });
    }

    // Size check (content as UTF-8 bytes)
    const byteSize = new TextEncoder().encode(content).length;
    if (byteSize > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large (${(byteSize / 1024 / 1024).toFixed(1)}MB). Maximum size is 5MB.` },
        { status: 413 }
      );
    }

    // Extension check
    const ext = path.extname(filename).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${ext}. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}` },
        { status: 400 }
      );
    }

    // ── Save transcript to library ──────────────────────────────────────────
    const meetingsDir = path.join(ENV.LIBRARY_PATH, 'docs', 'meetings');
    fs.mkdirSync(meetingsDir, { recursive: true });

    const date = new Date().toISOString().slice(0, 10);
    const safeName = filename
      .replace(/\.[^/.]+$/, '') // strip extension
      .replace(/[^a-zA-Z0-9_-]/g, '_') // sanitize
      .slice(0, 80);
    const savedFilename = `${date}_${safeName}.md`;
    const savedPath = path.join(meetingsDir, savedFilename);

    // Wrap in markdown with metadata header
    const mdContent = [
      `# Meeting Transcript: ${safeName.replace(/_/g, ' ')}`,
      ``,
      `**Date**: ${date}`,
      `**Source**: Uploaded transcript`,
      ``,
      `---`,
      ``,
      content.trim(),
    ].join('\n');

    fs.writeFileSync(savedPath, mdContent, 'utf-8');

    // ── Generate summary ────────────────────────────────────────────────────
    let summary: string;
    let oneLiner: string = '';
    let meetingTitle = safeName.replace(/_/g, ' ');
    let summarySource: 'gemini' | 'extractive';
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
        console.error('[meetings/transcript] Gemini summary failed, using extractive fallback:', err);
        summary = extractiveSummary(content);
        summarySource = 'extractive';
      }
    } else {
      summary = extractiveSummary(content);
      summarySource = 'extractive';
    }
    // Fallback one-liner from first sentence of summary
    if (!oneLiner) {
      oneLiner = summary.replace(/[#*_]/g, '').split(/[.!?\n]/)[0]?.trim().slice(0, 120) || 'Meeting transcript processed';
    }

    // ── Extract structured task proposals via Gemini ──────────────────────
    let taskProposals: Array<{
      title: string; description: string; planningNotes: string;
      priority: string; assignedTo: string; subtasks: string[];
    }> = [];
    if (apiKey) {
      try {
        taskProposals = await extractTaskProposals(content, apiKey);
      } catch (e) {
        console.error('[meetings/transcript] Task proposal extraction failed:', e);
      }
    }

    // ── Create meeting record in scheduled_items ──────────────────────────
    // So the transcript shows up in Past Meetings tab
    const { getDb: getMcDb } = await import('@/lib/database');
    const meetingId = `meeting-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const now = Date.now();
    // Use extracted meeting date if available; fall back to today
    const scheduledFor = meetingDate ?? date;
    try {
      const db = getMcDb();
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
          taskProposals: taskProposals.slice(0, 10),
        }),
        now, now
      );
    } catch (e) {
      console.error('[meetings/transcript] Failed to create meeting record:', e);
    }

    return NextResponse.json({
      success: true,
      meetingId,
      savedPath,
      savedFilename,
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
    console.error('[meetings/transcript] Error:', msg);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
