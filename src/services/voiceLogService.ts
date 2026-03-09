// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * Voice logging service for Mission Control Dashboard
 * Logs voice actions to mission-control.db via the gateway API
 */

import type { AgentType } from '../lib/multiAgentVoice';

const API_BASE = '/api';

export async function logVoiceAction(
  agent: AgentType,
  actionType: string,
  metadata: Record<string, any> = {}
): Promise<void> {
  try {
    await fetch(`${API_BASE}/voice/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent,
        action_type: actionType,
        metadata: JSON.stringify(metadata),
        timestamp: Date.now()
      })
    });
  } catch (error) {
    // Non-blocking - don't fail voice on logging errors

  }
}

export async function startVoiceSession(agent: AgentType): Promise<number | null> {
  try {
    const res = await fetch(`${API_BASE}/voice/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent, started_at: Date.now() })
    });
    const data = await res.json();
    return data.id ?? null;
  } catch {
    return null;
  }
}

export async function endVoiceSession(sessionId: number): Promise<void> {
  try {
    await fetch(`${API_BASE}/voice/session/${sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ended_at: Date.now() })
    });
  } catch {
    // Session end log failure is non-blocking
  }
}
