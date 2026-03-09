// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextResponse } from 'next/server';

export const AGENT_ID_PATTERN = /^[a-z0-9][a-z0-9-_]*$/;

/**
 * Validates an agent ID from URL params or request body.
 * Returns a 400 NextResponse if invalid, null if valid.
 *
 * Usage:
 *   const guard = validateAgentId(id);
 *   if (guard) return guard;
 */
export function validateAgentId(id: unknown): NextResponse | null {
  if (
    typeof id !== 'string' ||
    id.length === 0 ||
    id.length > 64 ||
    !AGENT_ID_PATTERN.test(id)
  ) {
    return NextResponse.json({ error: 'Invalid agent ID' }, { status: 400 });
  }
  return null;
}
