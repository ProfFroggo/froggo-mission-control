// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// POST /api/sessions/chat — unified chat endpoint for all surfaces
// Replaces /api/chat/generate-reply for new integrations.

import { NextRequest, NextResponse } from 'next/server';
import {
  createOrGetSession,
  saveMessage,
  buildSessionContext,
  invokeAgent,
  extractAndSaveMemory,
} from '@/lib/sessionService';
import type { SessionConfig } from '@/lib/sessionService';

export const runtime = 'nodejs';

const VALID_SURFACES = new Set(['chat', 'task', 'social', 'room', 'library']);
const MEMORY_EXTRACT_EVERY_N = 5;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, sessionKey, agentId, surface, contextId, metadata } = body;

    // ── Validate required fields ──────────────────────────────────────────
    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json(
        { success: false, error: 'message is required' },
        { status: 400 }
      );
    }
    if (!sessionKey || typeof sessionKey !== 'string') {
      return NextResponse.json(
        { success: false, error: 'sessionKey is required' },
        { status: 400 }
      );
    }
    if (!agentId || typeof agentId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'agentId is required' },
        { status: 400 }
      );
    }
    if (!surface || !VALID_SURFACES.has(surface)) {
      return NextResponse.json(
        { success: false, error: `surface must be one of: ${[...VALID_SURFACES].join(', ')}` },
        { status: 400 }
      );
    }

    // ── Build session config ──────────────────────────────────────────────
    const config: SessionConfig = {
      sessionKey,
      agentId,
      surface,
      contextId: contextId || undefined,
      metadata: metadata || undefined,
    };

    // ── Ensure session exists ─────────────────────────────────────────────
    createOrGetSession(config);

    // ── Persist user message ──────────────────────────────────────────────
    saveMessage(sessionKey, 'user', message.trim());

    // ── Invoke agent ──────────────────────────────────────────────────────
    const { reply, tokenEstimate } = invokeAgent(config, message.trim());

    // ── Persist agent response ────────────────────────────────────────────
    saveMessage(sessionKey, 'assistant', reply);

    // ── Memory extraction (fire-and-forget, every 5th message) ──────────
    const session = createOrGetSession(config);
    if (session.messageCount > 0 && session.messageCount % MEMORY_EXTRACT_EVERY_N === 0) {
      extractAndSaveMemory(sessionKey, agentId).catch(err =>
        console.error('[sessions/chat] memory extraction failed:', err)
      );
    }

    return NextResponse.json({
      success: true,
      reply,
      sessionKey,
      tokenEstimate,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error('POST /api/sessions/chat error:', detail);

    // Agent not found (no SOUL.md, no DB record)
    if (detail.includes('not found')) {
      return NextResponse.json(
        { success: false, error: detail },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to generate reply', detail },
      { status: 500 }
    );
  }
}
