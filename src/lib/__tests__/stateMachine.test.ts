// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * State machine unit + integration tests
 *
 * Covers:
 *   - Every defined valid transition passes (happy path)
 *   - Every undefined/blocked transition returns InvalidTransition
 *   - Guard-specific cases: allSubtasksComplete, claraApproved
 *   - Key acceptance criteria: todo→done blocked, todo→in-progress blocked,
 *     in-progress→review succeeds when subtasks are complete
 */
import { describe, it, expect } from 'vitest';
import {
  evaluateTransition,
  TRANSITIONS,
  WILDCARD_TO_HUMAN_REVIEW,
  type TransitionContext,
  type TaskStatus,
} from '@/lib/stateMachine';

// ── Context factory ────────────────────────────────────────────────────────────

function makeCtx(
  from: TaskStatus,
  to: TaskStatus,
  overrides: Partial<TransitionContext> = {}
): TransitionContext {
  return {
    from,
    to,
    args: {},
    task: { incompleteSubtaskCount: 0, totalSubtaskCount: 0 },
    ...overrides,
  };
}

function withSubtasks(
  ctx: TransitionContext,
  total: number,
  incomplete: number
): TransitionContext {
  return { ...ctx, task: { totalSubtaskCount: total, incompleteSubtaskCount: incomplete } };
}

function withClaraApproval(ctx: TransitionContext): TransitionContext {
  return { ...ctx, args: { ...ctx.args, reviewStatus: 'approved' } };
}

// ── UNIT TESTS: every defined transition in TRANSITIONS table ─────────────────

describe('TRANSITIONS table — all defined transitions pass when guards are satisfied', () => {
  it('internal-review → in-progress passes with claraApproved', () => {
    const ctx = withClaraApproval(makeCtx('internal-review', 'in-progress'));
    const result = evaluateTransition(ctx);
    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.guardsPassed).toContain('claraApproved');
    }
  });

  it('internal-review → todo passes unconditionally', () => {
    const ctx = makeCtx('internal-review', 'todo');
    const result = evaluateTransition(ctx);
    expect(result.allowed).toBe(true);
  });

  it('in-progress → review passes when all subtasks are complete', () => {
    const ctx = withSubtasks(makeCtx('in-progress', 'review'), 3, 0);
    const result = evaluateTransition(ctx);
    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.guardsPassed).toContain('allSubtasksComplete');
    }
  });

  it('in-progress → review passes when there are no subtasks at all', () => {
    const ctx = withSubtasks(makeCtx('in-progress', 'review'), 0, 0);
    const result = evaluateTransition(ctx);
    expect(result.allowed).toBe(true);
  });

  it('review → done passes with claraApproved', () => {
    const ctx = withClaraApproval(makeCtx('review', 'done'));
    const result = evaluateTransition(ctx);
    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.guardsPassed).toContain('claraApproved');
    }
  });

  it('review → in-progress passes unconditionally (Clara reject)', () => {
    const ctx = makeCtx('review', 'in-progress');
    const result = evaluateTransition(ctx);
    expect(result.allowed).toBe(true);
  });

  it('human-review → in-progress passes unconditionally', () => {
    const ctx = makeCtx('human-review', 'in-progress');
    expect(evaluateTransition(ctx).allowed).toBe(true);
  });

  it('human-review → review passes unconditionally', () => {
    const ctx = makeCtx('human-review', 'review');
    expect(evaluateTransition(ctx).allowed).toBe(true);
  });

  it('human-review → todo passes unconditionally', () => {
    const ctx = makeCtx('human-review', 'todo');
    expect(evaluateTransition(ctx).allowed).toBe(true);
  });

  it('human-review → done passes with claraApproved', () => {
    const ctx = withClaraApproval(makeCtx('human-review', 'done'));
    expect(evaluateTransition(ctx).allowed).toBe(true);
  });
});

// ── UNIT TESTS: wildcard ───────────────────────────────────────────────────────

describe('WILDCARD_TO_HUMAN_REVIEW — human-review is reachable from any state', () => {
  const allStatuses: TaskStatus[] = [
    'todo',
    'internal-review',
    'in-progress',
    'review',
    'done',
  ];

  for (const from of allStatuses) {
    it(`${from} → human-review is always allowed`, () => {
      const ctx = makeCtx(from, 'human-review');
      const result = evaluateTransition(ctx);
      expect(result.allowed).toBe(true);
    });
  }
});

// ── UNIT TESTS: no-op transitions ─────────────────────────────────────────────

describe('same-status no-op', () => {
  // internal-review is excluded: the state machine explicitly blocks ALL transitions
  // targeting internal-review (it's system-managed). Even a no-op to internal-review
  // is correctly rejected — agents should never be sending status=internal-review.
  const agentAccessibleStatuses: TaskStatus[] = [
    'todo',
    'in-progress',
    'review',
    'human-review',
    'done',
  ];

  for (const status of agentAccessibleStatuses) {
    it(`${status} → ${status} is a no-op and always allowed`, () => {
      const ctx = makeCtx(status, status);
      const result = evaluateTransition(ctx);
      expect(result.allowed).toBe(true);
    });
  }

  it('internal-review → internal-review is a no-op and allowed (no-op check runs before blocked-target guard)', () => {
    const ctx = makeCtx('internal-review', 'internal-review');
    const result = evaluateTransition(ctx);
    // No-op check fires before the blocked-target guard, so same-state updates are always fine.
    // Agents still cannot CHANGE status to internal-review from any other state.
    expect(result.allowed).toBe(true);
  });
});

// ── GUARD FAILURE TESTS ────────────────────────────────────────────────────────

describe('Guard failures return InvalidTransition with correct guardsFailed', () => {
  it('in-progress → review fails when subtasks are incomplete', () => {
    const ctx = withSubtasks(makeCtx('in-progress', 'review'), 5, 2);
    const result = evaluateTransition(ctx);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.error).toBe('InvalidTransition');
      expect(result.guardsFailed).toContain('allSubtasksComplete');
      expect(result.reason).toMatch(/subtask/i);
    }
  });

  it('review → done fails without claraApproved', () => {
    const ctx = makeCtx('review', 'done');
    const result = evaluateTransition(ctx);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.error).toBe('InvalidTransition');
      expect(result.guardsFailed).toContain('claraApproved');
    }
  });

  it('internal-review → in-progress fails without claraApproved', () => {
    const ctx = makeCtx('internal-review', 'in-progress');
    const result = evaluateTransition(ctx);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.guardsFailed).toContain('claraApproved');
    }
  });

  it('human-review → done fails without claraApproved', () => {
    const ctx = makeCtx('human-review', 'done');
    const result = evaluateTransition(ctx);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.guardsFailed).toContain('claraApproved');
    }
  });
});

// ── ACCEPTANCE CRITERIA — CRITICAL BLOCKED TRANSITIONS ────────────────────────

describe('Acceptance criteria: blocked transitions return structured InvalidTransition', () => {
  /**
   * AC-1: todo → done is blocked
   * Agents cannot skip the entire review pipeline.
   */
  it('todo → done is blocked with error=InvalidTransition', () => {
    const ctx = makeCtx('todo', 'done');
    const result = evaluateTransition(ctx);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.error).toBe('InvalidTransition');
      expect(result.from).toBe('todo');
      expect(result.to).toBe('done');
      expect(result.reason).toBeTruthy();
    }
  });

  /**
   * AC-2: todo → in-progress is blocked
   * Tasks must pass Clara's Pre-review gate (internal-review) before work begins.
   */
  it('todo → in-progress is blocked with error=InvalidTransition', () => {
    const ctx = makeCtx('todo', 'in-progress');
    const result = evaluateTransition(ctx);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.error).toBe('InvalidTransition');
      expect(result.from).toBe('todo');
      expect(result.to).toBe('in-progress');
      expect(result.reason).toMatch(/pre-review|Clara|gate/i);
      expect(result.recovery).toBeTruthy();
    }
  });

  /**
   * AC-3: in-progress → review succeeds when all subtasks complete
   * The happy-path agent workflow must work.
   */
  it('in-progress → review succeeds when all subtasks are complete', () => {
    const ctx = withSubtasks(makeCtx('in-progress', 'review'), 3, 0);
    const result = evaluateTransition(ctx);
    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.transition.description).toBeTruthy();
    }
  });

  /**
   * Any agent trying to set internal-review directly is blocked.
   */
  it('* → internal-review is blocked from any source state', () => {
    const sources: TaskStatus[] = ['todo', 'in-progress', 'review', 'human-review'];
    for (const from of sources) {
      const ctx = makeCtx(from, 'internal-review');
      const result = evaluateTransition(ctx);
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.error).toBe('InvalidTransition');
        expect(result.reason).toMatch(/system-managed|Pre-review/i);
      }
    }
  });

  /**
   * in-progress → done is blocked (agents must go through review first).
   */
  it('in-progress → done is blocked with actionable recovery hint', () => {
    const ctx = makeCtx('in-progress', 'done');
    const result = evaluateTransition(ctx);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.error).toBe('InvalidTransition');
      expect(result.recovery).toBeTruthy();
    }
  });

  /**
   * done is a terminal state — no outbound transitions from done.
   */
  it('done → in-progress is blocked (done is terminal)', () => {
    const ctx = makeCtx('done', 'in-progress');
    const result = evaluateTransition(ctx);
    expect(result.allowed).toBe(false);
  });

  it('done → review is blocked (done is terminal)', () => {
    const ctx = makeCtx('done', 'review');
    const result = evaluateTransition(ctx);
    expect(result.allowed).toBe(false);
  });

  it('done → todo is blocked (done is terminal)', () => {
    const ctx = makeCtx('done', 'todo');
    const result = evaluateTransition(ctx);
    expect(result.allowed).toBe(false);
  });
});

// ── STRUCTURED ERROR SHAPE ─────────────────────────────────────────────────────

describe('Error response shape matches acceptance criteria format', () => {
  it('blocked transition response includes error, from, to, reason fields', () => {
    const ctx = makeCtx('todo', 'done');
    const result = evaluateTransition(ctx);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      // Matches the shape documented in planningNotes:
      // { error: "InvalidTransition", from: "todo", to: "done", reason: "..." }
      expect(result).toMatchObject({
        error: 'InvalidTransition',
        from: 'todo',
        to: 'done',
        reason: expect.any(String),
      });
    }
  });

  it('guard failure response includes guardsFailed array', () => {
    const ctx = withSubtasks(makeCtx('in-progress', 'review'), 2, 1);
    const result = evaluateTransition(ctx);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(Array.isArray(result.guardsFailed)).toBe(true);
      expect(result.guardsFailed.length).toBeGreaterThan(0);
    }
  });

  it('successful transition response includes guardsPassed array', () => {
    const ctx = withClaraApproval(makeCtx('review', 'done'));
    const result = evaluateTransition(ctx);
    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(Array.isArray(result.guardsPassed)).toBe(true);
    }
  });
});

// ── COMPLETE TRANSITION TABLE COVERAGE ────────────────────────────────────────

describe('TRANSITIONS array completeness', () => {
  it('TRANSITIONS has at least 8 defined transitions', () => {
    expect(TRANSITIONS.length).toBeGreaterThanOrEqual(8);
  });

  it('WILDCARD_TO_HUMAN_REVIEW sentinel has from="*" and to="human-review"', () => {
    expect(WILDCARD_TO_HUMAN_REVIEW.from).toBe('*');
    expect(WILDCARD_TO_HUMAN_REVIEW.to).toBe('human-review');
  });

  it('every defined transition has a description', () => {
    for (const t of TRANSITIONS) {
      expect(t.description).toBeTruthy();
    }
  });

  it('every guard has a name and failReason', () => {
    for (const t of TRANSITIONS) {
      for (const g of t.guards) {
        expect(g.name).toBeTruthy();
        expect(g.failReason).toBeTruthy();
      }
    }
  });
});
