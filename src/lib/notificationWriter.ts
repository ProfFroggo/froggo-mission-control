// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// Server-side notification writer — writes to DB and emits SSE.
// Import this only from API routes (server context), never from client components.

import { getDb } from './database';
import { emitSSEEvent } from './sseEmitter';

export interface CreateNotificationInput {
  type: string;
  title: string;
  body?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

export async function createNotification(data: CreateNotificationInput): Promise<void> {
  try {
    const db = getDb();
    const id = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO notifications (id, type, title, body, userId, metadata, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      data.type,
      data.title,
      data.body ?? null,
      data.userId ?? null,
      data.metadata ? JSON.stringify(data.metadata) : null,
      now
    );
    emitSSEEvent('notification.new', {
      id,
      type: data.type,
      title: data.title,
      body: data.body ?? null,
      userId: data.userId ?? null,
      createdAt: now,
    });
  } catch (err) {
    console.error('[notifications] createNotification error:', err);
  }
}
