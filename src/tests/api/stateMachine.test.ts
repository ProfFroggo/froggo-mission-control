// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * Unit tests for the task pipeline state machine.
 *
 * Tests the pure evaluateTransition function and the TRANSITIONS table.
 * No DB, no HTTP, no I/O — the state machine is fully isolated.
 *
 * Coverage:
 *  - Every defined transition (valid paths) passes guards when context is correct
 *  - Every defined transition fails guards when context is wrong
 *  - Undefined transitions are blocked with error='InvalidTransition'
 *  - Critical acceptance-criteria paths:
 *      todo → done  (must be blocked)
 *      todo → in-progress  (must be blocked)
 *  - Wildcard *→human-review is always reachable
 *  - Self-transitions (same status) are always allowed
 *  - Structured error shape: allowed, error, from, to, reason, guardsFailed
 *  - TRANSITIONS table has no duplicate (from, to) pairs
 */

import { describe, it, expect } from 'vitest';
import {
  evaluateTransition,
  TRANSITIONS,
  WILDCARD_TO_HUMAN_REVIEW,
  type TransitionContext,
  type TaskStatus,
} from '../../../tools/mission-control-db-mcp/src/stateMachine';

// ── Test helpers ─────────────────────────────────────────────────────────────

/** Build a minimal TransitionContext with sensible defaults. */
function ctx(overrides: Partial<TransitionContext> & { from: TaskStatus; to: TaskStatus }): TransitionContext {
  return {
    from: overrides.from,
    to: overrides.to,
    args: {
      reviewStatus: undefined,
      agentId: 'test-agent',
      ...overrides.args,
    },
    task: {
      incompleteSubtaskCount: 0,
      totalSubtaskCount: 3,
      ...overrides.task,
    },
  };
}

// ── Valid transitions ─────────────────────────────────────────────────────────

describe('evaluateTransition — valid transitions allowed', () => {
  it('self-transition: same status is allowed for ALL statuses including internal-review', () => {
    // No-op transitions (from === to) are always permitted — they represent field-only
    // updates (e.g. progress, lastAgentUpdate) with no actual status change.
    // The internal-review guard only blocks transitions TO internal-review from a
    // different state; it does not apply when the status is unchanged.
    const statuses: TaskStatus[] = ['todo', 'internal-review', 'in-progress', 'review', 'human-review', 'done'];
    for (const s of statuses) {
      const result = evaluateTransition(ctx({ from: s, to: s }));
      expect(result.allowed, `self-transition ${s}→${s} should be allowed`).toBe(true);
      expect(result.guardsPassed).toEqual([]);
    }
  });

  it('in-progress → review: allowed when all subtasks complete', () => {
    const result = evaluateTransition(ctx({
      from: 'in-progress',
      to: 'review',
      task: { totalSubtaskCount: 3, incompleteSubtaskCount: 0 },
    }));
    expect(result.allowed).toBe(true);
    expect(result.guardsPassed).toContain('allSubtasksComplete');
  });

  it('in-progress → review: allowed when there are no subtasks (totalSubtaskCount=0)', () => {
    const result = evaluateTransition(ctx({
      from: 'in-progress',
      to: 'review',
      task: { totalSubtaskCount: 0, incompleteSubtaskCount: 0 },
    }));
    expect(result.allowed).toBe(true);
    expect(result.guardsPassed).toContain('allSubtasksComplete');
  });

  it('review → done: allowed when Clara sets reviewStatus="approved"', () => {
    const result = evaluateTransition(ctx({
      from: 'review',
      to: 'done',
      args: { reviewStatus: 'approved' },
    }));
    expect(result.allowed).toBe(true);
    expect(result.guardsPassed).toContain('claraApproved');
  });

  it('review → in-progress: allowed (Clara rejects — no guards)', () => {
    const result = evaluateTransition(ctx({ from: 'review', to: 'in-progress' }));
    expect(result.allowed).toBe(true);
    expect(result.guardsPassed).toEqual([]);
  });

  it('internal-review → in-progress: allowed when Clara sets reviewStatus="approved"', () => {
    const result = evaluateTransition(ctx({
      from: 'internal-review',
      to: 'in-progress',
      args: { reviewStatus: 'approved' },
    }));
    expect(result.allowed).toBe(true);
    expect(result.guardsPassed).toContain('claraApproved');
  });

  it('internal-review → todo: allowed (Clara pre-rejects — no guards)', () => {
    const result = evaluateTransition(ctx({ from: 'internal-review', to: 'todo' }));
    expect(result.allowed).toBe(true);
    expect(result.guardsPassed).toEqual([]);
  });

  it('human-review → in-progress: allowed (human unblocks)', () => {
    const result = evaluateTransition(ctx({ from: 'human-review', to: 'in-progress' }));
    expect(result.allowed).toBe(true);
    expect(result.guardsPassed).toEqual([]);
  });

  it('human-review → review: allowed', () => {
    const result = evaluateTransition(ctx({ from: 'human-review', to: 'review' }));
    expect(result.allowed).toBe(true);
  });

  it('human-review → todo: allowed (human resets to planning)', () => {
    const result = evaluateTransition(ctx({ from: 'human-review', to: 'todo' }));
    expect(result.allowed).toBe(true);
  });

  it('human-review → done: allowed when Clara sets reviewStatus="approved"', () => {
    const result = evaluateTransition(ctx({
      from: 'human-review',
      to: 'done',
      args: { reviewStatus: 'approved' },
    }));
    expect(result.allowed).toBe(true);
    expect(result.guardsPassed).toContain('claraApproved');
  });

  describe('wildcard: *→human-review is always reachable from any status', () => {
    const sources: TaskStatus[] = ['todo', 'internal-review', 'in-progress', 'review', 'done'];
    for (const from of sources) {
      it(`${from} → human-review is allowed`, () => {
        const result = evaluateTransition(ctx({ from, to: 'human-review' }));
        expect(result.allowed).toBe(true);
        expect(result.guardsPassed).toEqual([]);
      });
    }
  });
});

// ── Invalid transitions — must be blocked ────────────────────────────────────

describe('evaluateTransition — invalid transitions blocked (acceptance criteria)', () => {
  it('todo → done: BLOCKED — must return InvalidTransition', () => {
    const result = evaluateTransition(ctx({
      from: 'todo',
      to: 'done',
      args: { reviewStatus: 'approved' }, // Even with "approved", no path exists
    }));
    expect(result.allowed).toBe(false);
    expect(result.error).toBe('InvalidTransition');
    expect(result.from).toBe('todo');
    expect(result.to).toBe('done');
    expect(result.reason).toBeTruthy();
  });

  it('todo → in-progress: BLOCKED — must return InvalidTransition', () => {
    const result = evaluateTransition(ctx({ from: 'todo', to: 'in-progress' }));
    expect(result.allowed).toBe(false);
    expect(result.error).toBe('InvalidTransition');
    expect(result.from).toBe('todo');
    expect(result.to).toBe('in-progress');
    expect(result.reason).toBeTruthy();
  });

  it('in-progress → done: BLOCKED — agents cannot skip review', () => {
    const result = evaluateTransition(ctx({
      from: 'in-progress',
      to: 'done',
      args: { reviewStatus: 'approved' },
    }));
    expect(result.allowed).toBe(false);
    expect(result.error).toBe('InvalidTransition');
    expect(result.from).toBe('in-progress');
    expect(result.to).toBe('done');
  });

  it('todo → review: BLOCKED — cannot skip internal-review and in-progress', () => {
    const result = evaluateTransition(ctx({ from: 'todo', to: 'review' }));
    expect(result.allowed).toBe(false);
    expect(result.error).toBe('InvalidTransition');
  });

  it('done → in-progress: BLOCKED — done is terminal for agent transitions', () => {
    const result = evaluateTransition(ctx({ from: 'done', to: 'in-progress' }));
    expect(result.allowed).toBe(false);
    expect(result.error).toBe('InvalidTransition');
  });

  it('done → review: BLOCKED — done is terminal for agent transitions', () => {
    const result = evaluateTransition(ctx({ from: 'done', to: 'review' }));
    expect(result.allowed).toBe(false);
    expect(result.error).toBe('InvalidTransition');
  });

  it('done → todo: BLOCKED — done is terminal for agent transitions', () => {
    const result = evaluateTransition(ctx({ from: 'done', to: 'todo' }));
    expect(result.allowed).toBe(false);
    expect(result.error).toBe('InvalidTransition');
  });

  it('*→internal-review: BLOCKED — system-managed, agents cannot set this', () => {
    const sources: TaskStatus[] = ['todo', 'in-progress', 'review', 'human-review'];
    for (const from of sources) {
      const result = evaluateTransition(ctx({ from, to: 'internal-review' }));
      expect(result.allowed, `${from}→internal-review should be blocked`).toBe(false);
      expect(result.error).toBe('InvalidTransition');
    }
  });

  it('in-progress → todo: BLOCKED — no backwards skip', () => {
    const result = evaluateTransition(ctx({ from: 'in-progress', to: 'todo' }));
    expect(result.allowed).toBe(false);
    expect(result.error).toBe('InvalidTransition');
  });
});

// ── Guard failures ────────────────────────────────────────────────────────────

describe('evaluateTransition — guard failures', () => {
  it('review → done: BLOCKED when reviewStatus is not "approved"', () => {
    const statuses = [undefined, 'pending', 'rejected', 'needs-changes', ''];
    for (const reviewStatus of statuses) {
      const result = evaluateTransition(ctx({
        from: 'review',
        to: 'done',
        args: { reviewStatus },
      }));
      expect(result.allowed, `review→done should be blocked with reviewStatus=${JSON.stringify(reviewStatus)}`).toBe(false);
      expect(result.error).toBe('InvalidTransition');
      expect(result.guardsFailed).toContain('claraApproved');
      expect(result.reason).toMatch(/Clara approval required/i);
    }
  });

  it('internal-review → in-progress: BLOCKED when reviewStatus is not "approved"', () => {
    const result = evaluateTransition(ctx({
      from: 'internal-review',
      to: 'in-progress',
      args: { reviewStatus: 'rejected' },
    }));
    expect(result.allowed).toBe(false);
    expect(result.error).toBe('InvalidTransition');
    expect(result.guardsFailed).toContain('claraApproved');
  });

  it('in-progress → review: BLOCKED when subtasks are incomplete', () => {
    const result = evaluateTransition(ctx({
      from: 'in-progress',
      to: 'review',
      task: { totalSubtaskCount: 3, incompleteSubtaskCount: 2 },
    }));
    expect(result.allowed).toBe(false);
    expect(result.error).toBe('InvalidTransition');
    expect(result.guardsFailed).toContain('allSubtasksComplete');
    expect(result.reason).toMatch(/subtask/i);
  });

  it('human-review → done: BLOCKED when reviewStatus is not "approved"', () => {
    const result = evaluateTransition(ctx({
      from: 'human-review',
      to: 'done',
      args: { reviewStatus: undefined },
    }));
    expect(result.allowed).toBe(false);
    expect(result.error).toBe('InvalidTransition');
    expect(result.guardsFailed).toContain('claraApproved');
  });
});

// ── Result shape ─────────────────────────────────────────────────────────────

describe('evaluateTransition — result shape', () => {
  it('allowed=true result has guardsPassed array (may be empty)', () => {
    const result = evaluateTransition(ctx({ from: 'human-review', to: 'in-progress' }));
    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(Array.isArray(result.guardsPassed)).toBe(true);
      expect(result.guardsPassed).toEqual([]);
    }
  });

  it('allowed=true result has guardsPassed with guard names when guards ran', () => {
    const result = evaluateTransition(ctx({
      from: 'review',
      to: 'done',
      args: { reviewStatus: 'approved' },
    }));
    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.guardsPassed).toEqual(['claraApproved']);
    }
  });

  it('allowed=false result has error="InvalidTransition"', () => {
    const result = evaluateTransition(ctx({ from: 'todo', to: 'done' }));
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.error).toBe('InvalidTransition');
      expect(typeof result.from).toBe('string');
      expect(typeof result.to).toBe('string');
      expect(typeof result.reason).toBe('string');
      expect(Array.isArray(result.guardsFailed)).toBe(true);
    }
  });

  it('blocked-transition hints are populated for known paths (todo→in-progress)', () => {
    const result = evaluateTransition(ctx({ from: 'todo', to: 'in-progress' }));
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.hint).toBeTruthy();
      expect(result.recovery).toBeTruthy();
    }
  });

  it('blocked-transition hints are populated for todo→done', () => {
    const result = evaluateTransition(ctx({ from: 'todo', to: 'done' }));
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.hint).toBeTruthy();
    }
  });
});

// ── TRANSITIONS table integrity ───────────────────────────────────────────────

describe('TRANSITIONS table integrity', () => {
  it('WILDCARD_TO_HUMAN_REVIEW sentinel is defined with from="*"', () => {
    expect(WILDCARD_TO_HUMAN_REVIEW.from).toBe('*');
    expect(WILDCARD_TO_HUMAN_REVIEW.to).toBe('human-review');
    expect(Array.isArray(WILDCARD_TO_HUMAN_REVIEW.guards)).toBe(true);
  });

  it('every transition has a non-empty description', () => {
    for (const t of TRANSITIONS) {
      expect(t.description, `Transition ${t.from}→${t.to} must have a description`).toBeTruthy();
    }
  });

  it('no duplicate specific (from, to) pairs', () => {
    const specific = TRANSITIONS.filter((t) => t.from !== '*');
    const pairs = specific.map((t) => `${t.from}→${t.to}`);
    const unique = new Set(pairs);
    expect(pairs.length).toBe(unique.size);
  });

  it('all guards in TRANSITIONS have name and check and failReason', () => {
    for (const t of TRANSITIONS) {
      for (const g of t.guards) {
        expect(g.name, `Guard in ${t.from}→${t.to} must have name`).toBeTruthy();
        expect(typeof g.check).toBe('function');
        expect(g.failReason, `Guard '${g.name}' must have failReason`).toBeTruthy();
      }
    }
  });
});
