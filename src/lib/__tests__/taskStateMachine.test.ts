// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * Unit tests for src/lib/taskStateMachine.ts
 *
 * taskStateMachine.ts is the frontend / store-facing state machine. It uses a
 * simple VALID_TRANSITIONS map (no guard context) and includes two extra terminal
 * statuses — `failed` and `cancelled` — that the guard-based MCP state machine
 * does not have.
 *
 * These tests are distinct from src/lib/__tests__/stateMachine.test.ts, which
 * covers the guard-based evaluateTransition() in src/lib/stateMachine.ts.
 *
 * Coverage goals:
 *   ✅ validateTransition returns null for every defined valid transition
 *   ✅ validateTransition returns an error string for blocked transitions
 *   ✅ Same-status no-ops always return null
 *   ✅ Key access-control rules enforced (todo→in-progress, *→done for agents)
 *   ✅ failed and cancelled lifecycle paths
 *   ✅ done→in-progress reopen path
 *   ✅ Unknown status handling
 *   ✅ VALID_STATUSES shape
 *   ✅ VALID_TRANSITIONS structure completeness
 */

import { describe, it, expect } from 'vitest';
import {
  validateTransition,
  VALID_TRANSITIONS,
  VALID_STATUSES,
  type TaskStatus,
} from '@/lib/taskStateMachine';

// ── Helpers ───────────────────────────────────────────────────────────────────

function valid(from: string, to: string) {
  return validateTransition(from, to);
}

// ── VALID_STATUSES shape ──────────────────────────────────────────────────────

describe('VALID_STATUSES', () => {
  it('includes all six pipeline statuses', () => {
    const expected = ['todo', 'internal-review', 'in-progress', 'review', 'human-review', 'done'];
    for (const status of expected) {
      expect(VALID_STATUSES).toContain(status);
    }
  });

  it('includes failed and cancelled (not present in guard-based machine)', () => {
    expect(VALID_STATUSES).toContain('failed');
    expect(VALID_STATUSES).toContain('cancelled');
  });

  it('has exactly 8 statuses', () => {
    expect(VALID_STATUSES).toHaveLength(8);
  });
});

// ── VALID_TRANSITIONS structure ───────────────────────────────────────────────

describe('VALID_TRANSITIONS map', () => {
  it('has an entry for every status in VALID_STATUSES', () => {
    for (const status of VALID_STATUSES) {
      expect(VALID_TRANSITIONS).toHaveProperty(status);
    }
  });

  it('every value is a non-null array', () => {
    for (const [status, targets] of Object.entries(VALID_TRANSITIONS)) {
      expect(Array.isArray(targets)).toBe(true);
      // Even terminal states with limited transitions should have an array
      expect(targets).not.toBeNull();
    }
  });

  it('every target status referenced in VALID_TRANSITIONS is a known status', () => {
    const knownStatuses = new Set(VALID_STATUSES);
    for (const [, targets] of Object.entries(VALID_TRANSITIONS)) {
      for (const target of targets as string[]) {
        expect(knownStatuses.has(target)).toBe(true);
      }
    }
  });
});

// ── Same-status no-ops ────────────────────────────────────────────────────────

describe('same-status transitions are always no-ops (null)', () => {
  const allStatuses: string[] = [
    'todo', 'internal-review', 'in-progress', 'review', 'human-review',
    'done', 'failed', 'cancelled',
  ];

  for (const status of allStatuses) {
    it(`${status} → ${status} returns null`, () => {
      expect(validateTransition(status, status)).toBeNull();
    });
  }
});

// ── Valid transitions (null return) ──────────────────────────────────────────

describe('valid transitions return null', () => {
  it('todo → internal-review (system auto-advances on agent assign)', () => {
    expect(valid('todo', 'internal-review')).toBeNull();
  });

  it('todo → human-review (escalation before work starts)', () => {
    expect(valid('todo', 'human-review')).toBeNull();
  });

  it('todo → cancelled', () => {
    expect(valid('todo', 'cancelled')).toBeNull();
  });

  it('internal-review → in-progress (Clara approves pre-review)', () => {
    expect(valid('internal-review', 'in-progress')).toBeNull();
  });

  it('internal-review → todo (Clara rejects pre-review)', () => {
    expect(valid('internal-review', 'todo')).toBeNull();
  });

  it('internal-review → human-review', () => {
    expect(valid('internal-review', 'human-review')).toBeNull();
  });

  it('in-progress → review (agent submits for review)', () => {
    expect(valid('in-progress', 'review')).toBeNull();
  });

  it('in-progress → human-review (agent escalates blocker)', () => {
    expect(valid('in-progress', 'human-review')).toBeNull();
  });

  it('in-progress → todo (agent resets to planning)', () => {
    expect(valid('in-progress', 'todo')).toBeNull();
  });

  it('in-progress → internal-review', () => {
    expect(valid('in-progress', 'internal-review')).toBeNull();
  });

  it('in-progress → failed', () => {
    expect(valid('in-progress', 'failed')).toBeNull();
  });

  it('in-progress → cancelled', () => {
    expect(valid('in-progress', 'cancelled')).toBeNull();
  });

  it('review → done (Clara approves)', () => {
    expect(valid('review', 'done')).toBeNull();
  });

  it('review → in-progress (Clara sends back for rework)', () => {
    expect(valid('review', 'in-progress')).toBeNull();
  });

  it('review → human-review', () => {
    expect(valid('review', 'human-review')).toBeNull();
  });

  it('human-review → in-progress (human unblocks)', () => {
    expect(valid('human-review', 'in-progress')).toBeNull();
  });

  it('human-review → todo (human resets to planning)', () => {
    expect(valid('human-review', 'todo')).toBeNull();
  });

  it('human-review → review', () => {
    expect(valid('human-review', 'review')).toBeNull();
  });

  it('human-review → done', () => {
    expect(valid('human-review', 'done')).toBeNull();
  });

  it('human-review → cancelled', () => {
    expect(valid('human-review', 'cancelled')).toBeNull();
  });

  it('done → in-progress (reopen — critical path)', () => {
    // done is not fully terminal in this machine; humans can reopen via the UI
    expect(valid('done', 'in-progress')).toBeNull();
  });

  it('failed → todo (retry from planning)', () => {
    expect(valid('failed', 'todo')).toBeNull();
  });

  it('failed → in-progress (resume failed task)', () => {
    expect(valid('failed', 'in-progress')).toBeNull();
  });

  it('cancelled → todo (reinstate cancelled task)', () => {
    expect(valid('cancelled', 'todo')).toBeNull();
  });
});

// ── Blocked transitions (string return) ──────────────────────────────────────

describe('blocked transitions return a non-empty error string', () => {
  /**
   * CRITICAL: todo → in-progress must be blocked.
   * Tasks must pass Clara's pre-review gate (internal-review) before work begins.
   */
  it('todo → in-progress is blocked (pre-review gate bypassed)', () => {
    const result = valid('todo', 'in-progress');
    expect(result).not.toBeNull();
    expect(typeof result).toBe('string');
    expect(result!.length).toBeGreaterThan(0);
  });

  /**
   * CRITICAL: todo → done is blocked.
   * Agents cannot skip the entire pipeline.
   */
  it('todo → done is blocked (pipeline bypass)', () => {
    const result = valid('todo', 'done');
    expect(result).not.toBeNull();
    expect(typeof result).toBe('string');
  });

  /**
   * CRITICAL: todo → review is blocked.
   */
  it('todo → review is blocked (skips in-progress)', () => {
    const result = valid('todo', 'review');
    expect(result).not.toBeNull();
    expect(typeof result).toBe('string');
  });

  /**
   * in-progress → done is blocked (must go through review).
   */
  it('in-progress → done is blocked (must submit for review first)', () => {
    const result = valid('in-progress', 'done');
    expect(result).not.toBeNull();
    expect(typeof result).toBe('string');
  });

  /**
   * done → review is blocked (terminal for direct re-entry without reopen).
   */
  it('done → review is blocked', () => {
    const result = valid('done', 'review');
    expect(result).not.toBeNull();
    expect(typeof result).toBe('string');
  });

  it('done → todo is blocked (done is near-terminal)', () => {
    const result = valid('done', 'todo');
    expect(result).not.toBeNull();
    expect(typeof result).toBe('string');
  });

  it('done → human-review is blocked', () => {
    const result = valid('done', 'human-review');
    expect(result).not.toBeNull();
    expect(typeof result).toBe('string');
  });

  it('cancelled → in-progress is blocked (must reinstate via todo first)', () => {
    const result = valid('cancelled', 'in-progress');
    expect(result).not.toBeNull();
    expect(typeof result).toBe('string');
  });

  it('cancelled → done is blocked', () => {
    const result = valid('cancelled', 'done');
    expect(result).not.toBeNull();
    expect(typeof result).toBe('string');
  });
});

// ── Error message format ──────────────────────────────────────────────────────

describe('error message format', () => {
  it('blocked transition error includes the from and to statuses', () => {
    const result = valid('todo', 'in-progress');
    expect(result).not.toBeNull();
    // The error should reference the statuses to aid debugging
    expect(result).toMatch(/todo/i);
    expect(result).toMatch(/in-progress/i);
  });

  it('unknown from-status returns an error string', () => {
    const result = validateTransition('nonexistent-status', 'in-progress');
    expect(result).not.toBeNull();
    expect(typeof result).toBe('string');
    expect(result!.length).toBeGreaterThan(0);
  });

  it('unknown to-status from a known from-status returns an error string', () => {
    const result = validateTransition('todo', 'flying-saucer');
    expect(result).not.toBeNull();
    expect(typeof result).toBe('string');
  });

  it('both statuses unknown returns an error string', () => {
    const result = validateTransition('ghost', 'void');
    expect(result).not.toBeNull();
    expect(typeof result).toBe('string');
  });
});

// ── VALID_TRANSITIONS exhaustive spot-checks ──────────────────────────────────

describe('VALID_TRANSITIONS spot-checks', () => {
  it('todo cannot reach in-progress directly (only via internal-review)', () => {
    expect(VALID_TRANSITIONS['todo']).not.toContain('in-progress');
  });

  it('todo cannot reach done directly', () => {
    expect(VALID_TRANSITIONS['todo']).not.toContain('done');
  });

  it('in-progress cannot jump to done directly', () => {
    expect(VALID_TRANSITIONS['in-progress']).not.toContain('done');
  });

  it('done can only reach in-progress (reopen is the only outbound)', () => {
    expect(VALID_TRANSITIONS['done']).toEqual(['in-progress']);
  });

  it('failed can reach todo and in-progress for recovery', () => {
    expect(VALID_TRANSITIONS['failed']).toContain('todo');
    expect(VALID_TRANSITIONS['failed']).toContain('in-progress');
  });

  it('cancelled can only reach todo', () => {
    expect(VALID_TRANSITIONS['cancelled']).toEqual(['todo']);
  });
});

// ── TaskStatus type coverage ──────────────────────────────────────────────────

describe('TaskStatus type includes failed and cancelled', () => {
  it('failed and cancelled are assignable to TaskStatus without type error', () => {
    // If the type is wrong, TypeScript will error at compile time.
    // At runtime we verify the VALID_STATUSES array reflects these.
    const failedStatus: TaskStatus = 'failed';
    const cancelledStatus: TaskStatus = 'cancelled';
    expect(VALID_STATUSES).toContain(failedStatus);
    expect(VALID_STATUSES).toContain(cancelledStatus);
  });
});
