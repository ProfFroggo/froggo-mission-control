// Task pipeline state machine — single source of truth for valid status transitions.
//
// Design principles:
//   - Whitelist: absence from TRANSITIONS = blocked
//   - Guards are pure functions — all DB context is pre-fetched and passed in
//   - No I/O in this module — fully testable without a DB
//
// Pipeline (documented in CLAUDE.md):
//   todo → [system: internal-review] → [Clara: in-progress] → review → [Clara: done]
//                                                  ↕
//                                           human-review (from any state)
//
// Scope: guards only agent-initiated task_update calls via MCP.
// System/cron transitions (todo→internal-review, dispatch→in-progress) use direct SQL
// and are trusted — they bypass this guard layer intentionally.

export type TaskStatus =
  | 'todo'
  | 'internal-review'
  | 'in-progress'
  | 'review'
  | 'human-review'
  | 'done';

/** Context passed to every guard function. Pre-fetched by the caller before evaluation. */
export interface TransitionContext {
  /** Current status from the database */
  from: TaskStatus;
  /** Requested target status */
  to: TaskStatus;
  /** Caller-supplied arguments (reviewStatus is relevant for Clara-approval guards) */
  args: {
    reviewStatus?: string;
    agentId?: string;
    [key: string]: unknown;
  };
  /** Task data relevant to guards — fetched from DB before calling evaluateTransition */
  task: {
    incompleteSubtaskCount: number;
    totalSubtaskCount: number;
  };
}

export interface Guard {
  /** Unique name used in audit log */
  name: string;
  /** Returns true if the guard passes (transition is allowed) */
  check: (ctx: TransitionContext) => boolean;
  /** Human-readable reason returned when this guard fails */
  failReason: string;
}

export interface Transition {
  from: TaskStatus | '*';
  to: TaskStatus;
  guards: Guard[];
  description: string;
}

export interface TransitionAllowed {
  allowed: true;
  guardsPassed: string[];
  transition: Transition;
}

export interface TransitionDenied {
  allowed: false;
  error: 'InvalidTransition';
  from: string;
  to: string;
  reason: string;
  guardsFailed: string[];
  hint?: string;
  recovery?: string;
}

export type EvaluateResult = TransitionAllowed | TransitionDenied;

// ── Guard definitions ─────────────────────────────────────────────────────────

/**
 * Passes when Clara sets reviewStatus='approved' alongside the status change.
 * This is the standard Clara approval mechanism for review→done and pre-review gates.
 */
export const claraApproved: Guard = {
  name: 'claraApproved',
  check: (ctx) => ctx.args.reviewStatus === 'approved',
  failReason:
    'Clara approval required — only Clara can advance to this status by setting reviewStatus="approved"',
};

/**
 * Passes when all subtasks are complete (or when there are no subtasks).
 * Blocks in-progress → review when work is incomplete.
 */
export const allSubtasksComplete: Guard = {
  name: 'allSubtasksComplete',
  check: (ctx) =>
    ctx.task.totalSubtaskCount === 0 || ctx.task.incompleteSubtaskCount === 0,
  failReason:
    'All subtasks must be completed before submitting for review. Complete remaining subtasks or mark irrelevant ones complete with a note.',
};

// ── Transition table ──────────────────────────────────────────────────────────
//
// RULES:
//   - Agents CANNOT set internal-review (system-managed via Clara cron)
//   - todo → in-progress is blocked (tasks must pass Clara pre-review gate first)
//   - done is terminal for agents (Clara advances via reviewStatus='approved')
//   - Any state → human-review is always valid (handled via wildcard sentinel below)
//
// Note: internal-review transitions are mostly system-managed via direct SQL.
// They are listed here for completeness — if an agent somehow triggers them via
// task_update, the claraApproved guard enforces the correct access pattern.

export const TRANSITIONS: Transition[] = [
  // ── From internal-review (system/Clara managed) ───────────────────────────
  {
    from: 'internal-review',
    to: 'in-progress',
    guards: [claraApproved],
    description: 'Clara approves pre-review and dispatches agent',
  },
  {
    from: 'internal-review',
    to: 'todo',
    guards: [],
    description: 'Clara rejects pre-review — task needs more planning',
  },

  // ── From in-progress (agent transitions) ─────────────────────────────────
  {
    from: 'in-progress',
    to: 'review',
    guards: [allSubtasksComplete],
    description: 'Agent submits completed work for Clara review',
  },
  // in-progress → human-review: covered by WILDCARD_TO_HUMAN_REVIEW

  // ── From review (Clara transitions) ──────────────────────────────────────
  {
    from: 'review',
    to: 'done',
    guards: [claraApproved],
    description: 'Clara approves completed work — task is done',
  },
  {
    from: 'review',
    to: 'in-progress',
    guards: [],
    description: 'Clara sends work back for rework (rejected or needs-changes)',
  },
  // review → human-review: covered by WILDCARD_TO_HUMAN_REVIEW

  // ── From human-review (human-unblocking transitions) ─────────────────────
  {
    from: 'human-review',
    to: 'in-progress',
    guards: [],
    description: 'Human unblocks agent — resume work',
  },
  {
    from: 'human-review',
    to: 'review',
    guards: [],
    description: 'Human redirects to review stage',
  },
  {
    from: 'human-review',
    to: 'todo',
    guards: [],
    description: 'Human resets task to planning stage',
  },
  {
    from: 'human-review',
    to: 'done',
    guards: [claraApproved],
    description: 'Human directly closes task with Clara approval',
  },
];

/** Sentinel transition: human-review is reachable from ANY state (escalation). */
export const WILDCARD_TO_HUMAN_REVIEW: Transition = {
  from: '*',
  to: 'human-review',
  guards: [],
  description: 'Escalate to human review from any state — always valid',
};

// ── Blocked-transition hints ──────────────────────────────────────────────────
// Specific, actionable error messages for commonly attempted invalid transitions.

interface BlockedHint {
  reason: string;
  hint?: string;
  recovery?: string;
}

const BLOCKED_HINTS: Record<string, BlockedHint> = {
  'in-progress→review': {
    reason: 'All subtasks must be completed before submitting for review.',
    hint: 'Call task_get to see which subtasks are still incomplete.',
    recovery:
      'Mark each incomplete subtask complete with subtask_update({ id: "<sub-id>", completed: true }), then retry task_update({ status: "review", progress: 100, lastAgentUpdate: "Completed: ..." }).',
  },
  'todo→in-progress': {
    reason:
      "Tasks must pass Clara's Pre-review gate before work begins. The system automatically moves tasks to internal-review when an agent is assigned — Clara then dispatches the agent.",
    hint: 'Ensure planningNotes and subtasks are set on the task, then wait for Clara\'s pre-review approval.',
    recovery:
      'Verify task has planningNotes and at least one subtask. The system will auto-advance to internal-review, and Clara will dispatch you.',
  },
  'todo→done': {
    reason:
      'Tasks cannot skip the review pipeline. They must progress: todo → internal-review → in-progress → review → done.',
    hint: 'Complete the work and set status="review". Clara will approve and advance to done.',
    recovery:
      'The correct flow is: wait for Clara dispatch, complete work, then set status="review" with lastAgentUpdate summarising what was built.',
  },
  'in-progress→done': {
    reason:
      'Agents cannot mark tasks done directly. Submit for Clara review first.',
    hint: 'Set status="review" with lastAgentUpdate describing completed work. Clara will approve and advance to done.',
    recovery:
      'Complete all subtasks, then call task_update({ status: "review", lastAgentUpdate: "Completed: <summary>. Output: <file paths or no files>." }).',
  },
  'done→*': {
    reason:
      'Done is a terminal state for agent transitions. Tasks can only be reopened by a human via the UI.',
    hint: 'If this task needs rework, ask a human to reopen it via the Mission Control dashboard.',
    recovery: 'Contact the team lead or use the human-review escalation path before the task reaches done.',
  },
  '*→internal-review': {
    reason:
      'The internal-review (Pre-review) status is system-managed. It is set automatically when a task is assigned to an agent — Clara then reviews and dispatches.',
    hint: 'If you finished work, set status="review". If blocked, set status="human-review".',
    recovery:
      'Set status="review" with lastAgentUpdate summarising what was built and where outputs are. Clara will verify and approve.',
  },
  '*→done': {
    reason:
      'Only Clara can mark tasks done, by approving the work at review stage.',
    hint: 'Set status="review" with lastAgentUpdate describing what was completed. Clara reviews and advances to done.',
    recovery:
      'Set status="review" with lastAgentUpdate summarising what was built and where outputs are. Clara will approve and close the task.',
  },
};

function getBlockedHint(from: string, to: string): BlockedHint | undefined {
  return (
    BLOCKED_HINTS[`${from}→${to}`] ||
    BLOCKED_HINTS[`*→${to}`] ||
    (from === 'done' ? BLOCKED_HINTS['done→*'] : undefined)
  );
}

// ── evaluateTransition ────────────────────────────────────────────────────────

/**
 * Evaluate whether a status transition is permitted given the context.
 *
 * @param ctx - All data needed by guards, pre-fetched by the caller
 * @returns TransitionAllowed (proceed) or TransitionDenied (return error to caller)
 *
 * Usage in task_update:
 *   const result = evaluateTransition({ from: current.status, to: newStatus, args, task });
 *   if (!result.allowed) return { content: [{ type: 'text', text: JSON.stringify(result) }] };
 *   // log audit trail with result.guardsPassed, then proceed
 */
export function evaluateTransition(ctx: TransitionContext): EvaluateResult {
  const { from, to } = ctx;

  // No-op — same status is always fine (must check before any blocked-target guards)
  if (from === to) {
    return {
      allowed: true,
      guardsPassed: [],
      transition: { from, to, guards: [], description: 'No status change (same state)' },
    };
  }

  // Agents can never set internal-review — system-managed only
  if (to === 'internal-review') {
    const hint = BLOCKED_HINTS['*→internal-review'];
    return {
      allowed: false,
      error: 'InvalidTransition',
      from,
      to,
      reason: hint.reason,
      guardsFailed: [],
      hint: hint.hint,
      recovery: hint.recovery,
    };
  }

  // human-review is always reachable from any state — escalation valve
  if (to === 'human-review') {
    return {
      allowed: true,
      guardsPassed: [],
      transition: WILDCARD_TO_HUMAN_REVIEW,
    };
  }

  // Find matching transition (exact from match only — wildcards handled above)
  const transition = TRANSITIONS.find(
    (t) => (t.from === from || t.from === '*') && t.to === to
  );

  if (!transition) {
    const blocked = getBlockedHint(from, to);
    return {
      allowed: false,
      error: 'InvalidTransition',
      from,
      to,
      reason:
        blocked?.reason ??
        `No valid transition defined from '${from}' to '${to}'. Check the task pipeline documentation.`,
      guardsFailed: [],
      hint: blocked?.hint,
      recovery: blocked?.recovery,
    };
  }

  // Run each guard in sequence — collect failures
  const passed: string[] = [];
  const failed: { name: string; reason: string }[] = [];

  for (const guard of transition.guards) {
    if (guard.check(ctx)) {
      passed.push(guard.name);
    } else {
      failed.push({ name: guard.name, reason: guard.failReason });
    }
  }

  if (failed.length > 0) {
    const blocked = getBlockedHint(from, to);
    return {
      allowed: false,
      error: 'InvalidTransition',
      from,
      to,
      reason: failed.map((f) => f.reason).join('; '),
      guardsFailed: failed.map((f) => f.name),
      hint: blocked?.hint,
      recovery: blocked?.recovery,
    };
  }

  return {
    allowed: true,
    guardsPassed: passed,
    transition,
  };
}
