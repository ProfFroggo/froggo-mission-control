import { describe, it, expect } from 'vitest';
import {
  evaluateTransition,
  TRANSITIONS,
  WILDCARD_TO_HUMAN_REVIEW,
  type TransitionContext,
  type TaskStatus,
} from './stateMachine';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a minimal TransitionContext with sensible defaults */
function ctx(
  from: TaskStatus,
  to: TaskStatus,
  overrides: Partial<TransitionContext['args']> = {},
  taskOverrides: Partial<TransitionContext['task']> = {}
): TransitionContext {
  return {
    from,
    to,
    args: { ...overrides },
    task: {
      incompleteSubtaskCount: 0,
      totalSubtaskCount: 0,
      ...taskOverrides,
    },
  };
}

// ── Valid transitions ─────────────────────────────────────────────────────────

describe('valid transitions — should be allowed', () => {
  it('in-progress → review (no subtasks)', () => {
    const result = evaluateTransition(ctx('in-progress', 'review'));
    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.guardsPassed).toContain('allSubtasksComplete');
    }
  });

  it('in-progress → review (all subtasks complete)', () => {
    const result = evaluateTransition(
      ctx('in-progress', 'review', {}, { totalSubtaskCount: 3, incompleteSubtaskCount: 0 })
    );
    expect(result.allowed).toBe(true);
  });

  it('in-progress → human-review', () => {
    const result = evaluateTransition(ctx('in-progress', 'human-review'));
    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.transition).toBe(WILDCARD_TO_HUMAN_REVIEW);
    }
  });

  it('review → done (with claraApproved)', () => {
    const result = evaluateTransition(ctx('review', 'done', { reviewStatus: 'approved' }));
    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.guardsPassed).toContain('claraApproved');
    }
  });

  it('review → in-progress (send back for rework)', () => {
    const result = evaluateTransition(ctx('review', 'in-progress'));
    expect(result.allowed).toBe(true);
  });

  it('review → human-review', () => {
    const result = evaluateTransition(ctx('review', 'human-review'));
    expect(result.allowed).toBe(true);
  });

  it('human-review → in-progress', () => {
    const result = evaluateTransition(ctx('human-review', 'in-progress'));
    expect(result.allowed).toBe(true);
  });

  it('human-review → review', () => {
    const result = evaluateTransition(ctx('human-review', 'review'));
    expect(result.allowed).toBe(true);
  });

  it('human-review → todo (reset)', () => {
    const result = evaluateTransition(ctx('human-review', 'todo'));
    expect(result.allowed).toBe(true);
  });

  it('human-review → done (with claraApproved)', () => {
    const result = evaluateTransition(ctx('human-review', 'done', { reviewStatus: 'approved' }));
    expect(result.allowed).toBe(true);
  });

  it('todo → human-review (escalation before work starts)', () => {
    const result = evaluateTransition(ctx('todo', 'human-review'));
    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.transition).toBe(WILDCARD_TO_HUMAN_REVIEW);
    }
  });

  it('internal-review → in-progress (clara approved)', () => {
    const result = evaluateTransition(
      ctx('internal-review', 'in-progress', { reviewStatus: 'approved' })
    );
    expect(result.allowed).toBe(true);
  });

  it('internal-review → todo (clara rejected)', () => {
    const result = evaluateTransition(ctx('internal-review', 'todo'));
    expect(result.allowed).toBe(true);
  });

  it('done → human-review (wildcard escalation)', () => {
    const result = evaluateTransition(ctx('done', 'human-review'));
    expect(result.allowed).toBe(true);
  });

  it('no-op: same status returns allowed', () => {
    const result = evaluateTransition(ctx('in-progress', 'in-progress'));
    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.guardsPassed).toHaveLength(0);
    }
  });
});

// ── Acceptance criteria: blocked transitions ──────────────────────────────────

describe('acceptance criteria — must be blocked', () => {
  it('BLOCKED: todo → done', () => {
    const result = evaluateTransition(ctx('todo', 'done'));
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.error).toBe('InvalidTransition');
      expect(result.from).toBe('todo');
      expect(result.to).toBe('done');
      expect(result.reason).toBeTruthy();
    }
  });

  it('BLOCKED: todo → in-progress (must go through internal-review)', () => {
    const result = evaluateTransition(ctx('todo', 'in-progress'));
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.error).toBe('InvalidTransition');
      expect(result.from).toBe('todo');
      expect(result.to).toBe('in-progress');
      expect(result.reason).toMatch(/pre-review|Clara|internal-review/i);
    }
  });

  it('BLOCKED: in-progress → done (must go through review)', () => {
    const result = evaluateTransition(ctx('in-progress', 'done'));
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.error).toBe('InvalidTransition');
      expect(result.from).toBe('in-progress');
      expect(result.to).toBe('done');
    }
  });

  it('BLOCKED: * → internal-review (system-managed)', () => {
    const statuses: TaskStatus[] = ['todo', 'in-progress', 'review', 'human-review', 'done'];
    for (const from of statuses) {
      const result = evaluateTransition(ctx(from, 'internal-review'));
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.error).toBe('InvalidTransition');
        expect(result.to).toBe('internal-review');
        expect(result.reason).toMatch(/system-managed|Pre-review/i);
      }
    }
  });

  it('BLOCKED: review → done without claraApproved', () => {
    // No reviewStatus → guard should fail
    const result = evaluateTransition(ctx('review', 'done'));
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.error).toBe('InvalidTransition');
      expect(result.guardsFailed).toContain('claraApproved');
    }
  });

  it('BLOCKED: review → done with wrong reviewStatus', () => {
    const result = evaluateTransition(ctx('review', 'done', { reviewStatus: 'rejected' }));
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.guardsFailed).toContain('claraApproved');
    }
  });

  it('BLOCKED: in-progress → review with incomplete subtasks', () => {
    const result = evaluateTransition(
      ctx('in-progress', 'review', {}, { totalSubtaskCount: 3, incompleteSubtaskCount: 2 })
    );
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.error).toBe('InvalidTransition');
      expect(result.guardsFailed).toContain('allSubtasksComplete');
    }
  });

  it('BLOCKED: todo → review (skipping in-progress)', () => {
    const result = evaluateTransition(ctx('todo', 'review'));
    expect(result.allowed).toBe(false);
  });

  it('BLOCKED: done → in-progress (agent cannot reopen)', () => {
    const result = evaluateTransition(ctx('done', 'in-progress'));
    expect(result.allowed).toBe(false);
  });

  it('BLOCKED: done → review', () => {
    const result = evaluateTransition(ctx('done', 'review'));
    expect(result.allowed).toBe(false);
  });

  it('BLOCKED: internal-review → in-progress without claraApproved', () => {
    const result = evaluateTransition(ctx('internal-review', 'in-progress'));
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.guardsFailed).toContain('claraApproved');
    }
  });
});

// ── Error shape ───────────────────────────────────────────────────────────────

describe('InvalidTransition error shape', () => {
  it('has all required fields', () => {
    const result = evaluateTransition(ctx('todo', 'done'));
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result).toMatchObject({
        allowed: false,
        error: 'InvalidTransition',
        from: 'todo',
        to: 'done',
        reason: expect.any(String),
        guardsFailed: expect.any(Array),
      });
    }
  });

  it('includes hint and recovery for well-known blocked transitions', () => {
    const result = evaluateTransition(ctx('todo', 'in-progress'));
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.hint).toBeTruthy();
      expect(result.recovery).toBeTruthy();
    }
  });

  it('internal-review block includes hint and recovery', () => {
    const result = evaluateTransition(ctx('in-progress', 'internal-review'));
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.hint).toBeTruthy();
      expect(result.recovery).toBeTruthy();
    }
  });

  it('allowed result includes guardsPassed array', () => {
    const result = evaluateTransition(ctx('review', 'done', { reviewStatus: 'approved' }));
    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(Array.isArray(result.guardsPassed)).toBe(true);
      expect(result.guardsPassed).toContain('claraApproved');
    }
  });

  it('allowed no-guard transition has empty guardsPassed', () => {
    const result = evaluateTransition(ctx('review', 'in-progress'));
    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.guardsPassed).toHaveLength(0);
    }
  });
});

// ── TRANSITIONS table completeness ────────────────────────────────────────────

describe('TRANSITIONS table', () => {
  it('all transitions have non-empty description', () => {
    for (const t of TRANSITIONS) {
      expect(t.description).toBeTruthy();
    }
  });

  it('all transitions have a valid from/to status', () => {
    const validStatuses = new Set<string>([
      'todo', 'internal-review', 'in-progress', 'review', 'human-review', 'done', '*',
    ]);
    for (const t of TRANSITIONS) {
      expect(validStatuses.has(t.from as string)).toBe(true);
      expect(validStatuses.has(t.to)).toBe(true);
    }
  });

  it('WILDCARD_TO_HUMAN_REVIEW targets human-review', () => {
    expect(WILDCARD_TO_HUMAN_REVIEW.from).toBe('*');
    expect(WILDCARD_TO_HUMAN_REVIEW.to).toBe('human-review');
    expect(WILDCARD_TO_HUMAN_REVIEW.guards).toHaveLength(0);
  });
});
