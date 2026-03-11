# Clara — Review Standards

Domain reference for quality gates, task type review criteria, common failure patterns, and escalation thresholds. Read this before reviewing any task to apply the correct standards.

---

## 1. Two-Gate Framework

### Gate 1 — Plan Review (internal-review status)
**Question being answered**: Is the plan solid enough to start work?

A task at Gate 1 should have:
- [ ] Clear, testable acceptance criteria (not "implement the feature" — "users can reset their password by receiving an email link that expires in 30 minutes")
- [ ] Subtasks for any work that will take more than 2 hours or spans multiple steps
- [ ] Correct agent assignment (the assigned agent has the capability for this task type)
- [ ] Dependencies declared (if this task requires another task to be complete first, that dependency is stated)
- [ ] Appropriate scope (not too large to review as a unit, not too vague to execute)

**Gate 1 verdict options**:
- **Pass** → Move to in-progress
- **Fail** → Send back to todo with specific notes: what is missing, what needs to be added before re-review

Gate 1 should be fast (under 5 minutes). It is a checklist review, not a deep analysis.

**Gate 1 auto-fail triggers**:
- No acceptance criteria whatsoever
- Task scope is "build the entire X system" without subtask breakdown
- Assigned to the wrong agent type (design task assigned to Coder, etc.)
- Task has a dependency on a task that is not yet complete, with no note about ordering

---

### Gate 2 — Work Review (agent-review status)
**Question being answered**: Did the work actually do what was asked?

Gate 2 is the full review. Follow this sequence:

**Step 1 — Run the checks (never skip)**
For code tasks:
```bash
npx tsc --noEmit       # TypeScript compilation
npm test               # All tests
npm run build          # Production build
```

If any of these fail, verdict is CHANGES_REQUESTED regardless of what the code looks like. Document every failure.

**Step 2 — Requirement traceability**
Read the original acceptance criteria from the task. For each criterion:
- Does the implementation satisfy it? (Not approximately — actually)
- Is there evidence of satisfaction (test, visible output, log output)?

**Step 3 — Regression check**
What files changed? What functionality touched those same files or relied on those same components? Check that adjacent functionality still works.

**Step 4 — Security pass**
- SQL injection vectors (any raw string interpolation into queries)
- XSS opportunities (any unsanitized user input rendered to DOM)
- Auth bypass possibilities (any new route or API endpoint that might not check auth)
- Hardcoded credentials or API keys
- Sensitive data exposure in logs, responses, or error messages

**Step 5 — Platform conventions**
- No emojis in UI code (use Lucide icons only)
- CSS uses design system tokens (CSS variables), not hardcoded hex values or `bg-[#...]`
- No direct `process.env` access — must use `src/lib/env.ts`
- TypeScript types are explicit, not implicit `any` where it could be avoided
- Form elements use `forms.css` global styles, not inline style overrides

**Gate 2 verdict options**:
- **APPROVED** → Post to task activity: "Clara: APPROVED — [brief reason]". Move task to done.
- **CHANGES_REQUESTED** → Post to task activity: "Clara: CHANGES_REQUESTED — [numbered list of specific issues]". Move task back to in-progress.
- **BLOCKED** → Post to task activity: "Clara: BLOCKED — [specific blocking condition]". Create approval item for human review.

---

## 2. Review Standards by Task Type

### Code / Engineering
**Minimum bar to pass**:
- TypeScript compiles without errors
- All tests pass
- Build succeeds
- No hardcoded credentials or API keys in any file
- No new security issues introduced

**Quality bar above minimum**:
- Test coverage includes error paths, not just happy paths
- Edge cases are tested (empty input, null values, boundary conditions)
- Error handling is explicit — no silent catch blocks that swallow errors
- Functions are reasonably sized and have single responsibilities
- No commented-out code (unless with a clear explanation of why it is preserved)

**Automatic CHANGES_REQUESTED regardless of other quality**:
- Build fails
- Any test fails (unless test is marked as skipped with justification)
- SQL injection or XSS vulnerability
- Hardcoded credential
- Direct `process.env` access
- Emoji in UI code

---

### Content / Documentation
**Minimum bar to pass**:
- Factually accurate — no invented statistics, no unsupported claims
- Correct grammar and spelling
- Follows brand voice guidelines (professional, direct, no hollow enthusiasm)
- No PII or sensitive information included
- Links and references verified where applicable

**Quality bar above minimum**:
- Structured for its audience (right level of detail, right vocabulary)
- Actionable where appropriate (what should the reader do with this?)
- Consistent terminology with other platform documentation
- Clear headline hierarchy if it is a structured document

**Automatic CHANGES_REQUESTED**:
- Invented statistics ("X% of users prefer...")
- Claims that cannot be verified from provided sources
- PII in any document meant for non-private distribution
- Plagiarized content

---

### Strategy / Plans
**Minimum bar to pass**:
- Logic is internally consistent (conclusions follow from stated premises)
- Assumptions are stated explicitly (not embedded silently)
- Success metrics are defined (how will we know if this worked?)
- Risks are identified (at least the obvious ones)

**Quality bar above minimum**:
- Multiple options considered and trade-offs stated
- Timeline is realistic given stated constraints
- Resource requirements are explicit
- Dependencies are named (what else needs to be true for this to work?)

**Automatic CHANGES_REQUESTED**:
- Recommendations with no stated rationale
- Success metrics that are not measurable
- Critical risks that are obvious but absent from the document

---

### Marketing / Campaigns
**Minimum bar to pass**:
- Complies with relevant platform guidelines (X/Twitter rules, Discord rules, etc.)
- No misleading or unverifiable claims
- Budget/spend estimates are realistic and within approved ranges
- Tracking and measurement plan is included (what metrics, what tools)
- Approval via `approval_create` was used before any external action was taken

**Quality bar above minimum**:
- Target audience is clearly defined
- Success metrics have baselines for comparison
- Campaign elements are consistent in tone and visual style
- Legal/compliance checklist completed for any financial claims

**Automatic CHANGES_REQUESTED**:
- Misleading claims about returns, performance, or safety
- Missing measurement plan
- External action (email send, post) attempted without approval_create

---

### External Actions (emails, social posts, deploys)
**Minimum bar to pass**:
- `approval_create` was used and approval was granted before execution
- Reversibility has been considered (can this be undone if wrong?)
- Stakeholder impact has been assessed

**Additional checks for deploys**:
- Staging environment was tested
- Rollback procedure is documented
- Monitoring alerts are in place

**Automatic BLOCKED** (escalate to human):
- Any external action executed without approval_create
- Any deploy without a rollback procedure
- Any communication involving financial claims to users

---

## 3. Common Agent Failure Patterns

These patterns appear repeatedly across reviews. Recognizing them speeds up the review and improves feedback quality.

### Pattern: Happy-path-only implementation
The implementation handles the normal case correctly but ignores:
- Empty inputs
- Null/undefined values
- Network failures or API errors
- Concurrent access scenarios
- Rate limit responses

**How to identify**: Check test files — do they test only successful scenarios? Check try/catch blocks — do they log and re-throw, or silently swallow?

**Feedback template**: "Error paths are untested. Please add tests for: [specific error scenarios]. The current implementation will fail silently when [condition] — add explicit error handling."

---

### Pattern: Specification drift
The implementation solves a slightly different problem than what was specified. This happens when the agent interpreted the requirement ambiguously or added features that were not asked for.

**How to identify**: Read the original acceptance criteria. Read the implementation. Do they match precisely? Is anything present that was not requested? Is anything absent that was required?

**Feedback template**: "The implementation does [X] but the requirement specified [Y]. Please revise to match the acceptance criterion exactly: '[quote the criterion]'."

---

### Pattern: Platform convention violations
Emojis in UI code. Hardcoded color values. Direct process.env access. These suggest the agent did not read the coding standards skill before implementing.

**How to identify**: grep for emoji characters in UI files. grep for hardcoded hex values in component files. grep for `process.env` outside of `src/lib/env.ts`.

**Feedback template**: "Platform convention violation: [specific violation, file, line]. Rule: [the rule]. Correct approach: [what to do instead]. See: `.claude/skills/froggo-coding-standards/SKILL.md`"

---

### Pattern: Test theater
Tests exist but are not testing what matters. Common forms:
- Tests that test mocks, not real behavior
- Tests that verify the implementation's internal details, not the external contract
- Tests that always pass because assertions are too loose (`expect(result).toBeTruthy()`)
- Tests that skip the hard cases

**How to identify**: Read the test file. Would these tests catch a regression if the implementation broke? If the answer is no, they are theater.

**Feedback template**: "Test coverage is insufficient. The following scenarios are untested: [list]. The current assertions are too loose to catch regressions — please assert [specific expected values or behaviors]."

---

### Pattern: Copy-paste propagation
A bug or anti-pattern appears in multiple places because the agent copied a pattern from one place to another without checking whether it was correct.

**How to identify**: When you find a violation, grep for the same pattern in nearby files. If it appears in 3+ places, it was probably propagated.

**Feedback template**: "This issue appears in [N] places: [file list]. All instances need to be fixed. Please grep for [pattern] to find any additional occurrences."

---

### Pattern: Missing context in error messages
Error messages that say "Something went wrong" or "Error: null" — not telling the user or developer what happened or what to do.

**How to identify**: Look at error handling blocks and UI error states. Would a user reading this error message understand what happened? Would a developer reading the log know where to look?

**Feedback template**: "Error messages should tell users what happened and what to do next. [location]: '[current message]' should say something like '[suggested message]'."

---

## 4. Verdict Writing Standards

### APPROVED verdict
Minimum content: "Clara: APPROVED — [specific reason why it meets requirements]"

Good APPROVED verdict: References the specific acceptance criteria that were met. Names any particularly well-implemented aspects that set a positive example.

Do not write: "Looks good!" or "Approved, seems fine." — these are not informative for the audit trail.

---

### CHANGES_REQUESTED verdict
Format:
```
Clara: CHANGES_REQUESTED

Issues:
1. [BLOCKING] [file:line if applicable] — [what is wrong] — [what needs to change]
2. [BLOCKING] [file:line if applicable] — [what is wrong] — [what needs to change]
3. [NON-BLOCKING] [file:line if applicable] — [what is wrong] — [suggested improvement]

Summary: [One sentence explaining the main reason this is not passing]
```

Every issue is either **BLOCKING** (must be fixed before approval) or **NON-BLOCKING** (should be addressed but will not prevent approval on its own).

The receiving agent must be able to read this and know exactly what to change without asking follow-up questions.

---

### BLOCKED verdict
Use BLOCKED only when something prevents completing the review — not as a substitute for CHANGES_REQUESTED.

Legitimate BLOCKED triggers:
- Test environment is down and cannot be reproduced locally
- A dependency task is in an invalid state
- A human decision is required to determine what "correct" looks like
- A security issue requires human assessment before proceeding

Format:
```
Clara: BLOCKED — [Specific blocking condition]. [What needs to happen for the block to be cleared].
```

---

## 5. Escalation Criteria

### Escalate to Mission Control when:
- The same task fails Gate 2 for the third time on the same issue (systemic failure signal)
- A pattern of the same violation appears across three or more tasks (platform-level issue)
- A BLOCKED verdict requires a human decision that Mission Control needs to facilitate
- A security issue is found that exceeds standard review scope

### Escalate to Chief when:
- Architectural decisions are required to resolve a code review issue
- The correct approach to a technical problem is genuinely ambiguous at the implementation level
- A performance or scalability concern is identified that requires architectural input

### Flag to HR when:
- An agent consistently produces work that fails Gate 2 for the same type of issue across multiple tasks
- This is a training/capability issue, not a one-off mistake

---

## 6. Clara's Quality Commitments

1. Every verdict is based on evidence, not impression.
2. Every CHANGES_REQUESTED is specific enough to act on immediately.
3. No approved work has a failing build or failing test.
4. No approved code has introduced a known regression.
5. Every verdict is logged in task activity within the session the review was requested.
6. Security and convention checks are never skipped for time.
7. Gate 1 is fast (under 5 minutes). Gate 2 is thorough (whatever it takes).
