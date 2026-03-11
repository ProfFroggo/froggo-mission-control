# Decision Frameworks — Mission Control Platform Reference

Strategic tools for architecture reviews, risk assessment, and build/buy/borrow decisions.

---

## Architecture Decision Record (ADR) Format

Save ADRs to `library/docs/strategies/YYYY-MM-DD_adr_NNNN_short-title.md` and reference in task memory.

```markdown
# ADR-NNNN: [Short Decision Title]

**Date**: YYYY-MM-DD
**Status**: Proposed | Accepted | Deprecated | Superseded by ADR-XXXX
**Deciders**: Chief, [others involved]
**Context task**: [task ID if applicable]

---

## Context

Describe the situation, constraints, and forces at play. What made this decision necessary?
What assumptions are we making? What are the current system capabilities?

## Decision

State the decision clearly in one sentence. Then explain it.

> We will [do X] because [primary reason].

## Options Considered

| Option | Summary | Pros | Cons | Reversibility |
|--------|---------|------|------|---------------|
| A (chosen) | ... | ... | ... | High/Med/Low |
| B | ... | ... | ... | High/Med/Low |
| C | ... | ... | ... | High/Med/Low |

## Consequences

### Positive
- [What becomes possible or easier]

### Negative / Trade-offs
- [What becomes harder or is accepted as a cost]

### Risks and Mitigations
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| ... | H/M/L | H/M/L | ... |

## Review Trigger

This decision should be revisited if:
- [Specific condition: e.g., "user count exceeds 10k"]
- [Specific condition: e.g., "requirements change to include X"]
```

---

## Risk Matrix

Use this to score and communicate risks in architecture reviews.

### Scoring

**Likelihood**:
- 1 = Rare (unlikely in normal operation)
- 2 = Possible (could happen under stress or edge conditions)
- 3 = Likely (will happen at some point in normal operation)

**Impact**:
- 1 = Low (recoverable quickly, minimal user effect)
- 2 = Medium (degraded experience, recoverable within hours)
- 3 = High (data loss, extended outage, security breach)

**Risk Score** = Likelihood × Impact

| Score | Category | Response |
|-------|----------|----------|
| 1–2 | Low | Accept and monitor |
| 3–4 | Medium | Mitigate before launch |
| 6–9 | High | Must address before proceeding |

### Risk Matrix Template

```markdown
## Risk Assessment: [Feature/Change Name]

| Risk | Likelihood (1-3) | Impact (1-3) | Score | Status |
|------|-----------------|-------------|-------|--------|
| DB migration fails mid-flight | 2 | 3 | 6 | Mitigated: migration is idempotent + rollback tested |
| API contract change breaks MCP tools | 2 | 2 | 4 | Mitigated: backward-compatible change + version flag |
| Auth token expiry not handled | 1 | 3 | 3 | Accepted: handled at client layer |

**Highest risk item**: [Name] (score: N) — [one sentence mitigation plan]
**Go/no-go**: [Go / Go with conditions / No-go]
```

---

## Build vs Buy vs Borrow Framework

Apply this before committing to implementing any new capability.

### Decision Tree

```
Is this capability core to the platform's differentiation?
  └─ YES → Is there an OSS solution that covers 80%+ of the need?
       ├─ YES → Borrow (adopt + contribute if needed)
       └─ NO  → Build (own the implementation)
  └─ NO  → Is this a solved problem with commercial solutions?
       ├─ YES → Buy (SaaS/vendor solution)
       └─ NO  → Borrow or build the minimal version needed
```

### Evaluation Matrix

| Criterion | Build | Buy | Borrow (OSS) |
|-----------|-------|-----|--------------|
| Core to differentiation | Best | Not appropriate | Acceptable |
| Need deep customization | Best | Unlikely | Possible |
| Time to first working version | Weeks | Hours | Days |
| Total cost of ownership | High (internal) | Predictable (licensing) | Medium (upgrade burden) |
| Vendor dependency risk | None | High | Low (fork option) |
| Expertise required | Domain + eng | Integration only | OSS + domain |
| Long-term maintenance | Full ownership | Vendor dependent | Shared with community |

### Questions to Ask

1. **Scope**: What exactly do we need? Not the whole library — the specific function.
2. **Frequency**: How often will this be called? Once at startup vs 1000/sec changes the answer.
3. **Evolution**: Will our requirements here change frequently? If yes, buying locks us in.
4. **Team**: Do we have the expertise to build and maintain this?
5. **Risk**: What's the blast radius if the vendor disappears / the OSS project is abandoned?

### Platform-Specific Defaults

| Capability | Default choice | Reason |
|-----------|---------------|--------|
| Authentication | Buy (NextAuth) | Solved problem; security-critical; high maintenance cost to build correctly |
| UI components | Borrow (Lucide icons, Tailwind) | Not differentiated; community-maintained |
| Database ORM | Build thin wrapper | better-sqlite3 is already minimal; ORM adds complexity without value at this scale |
| Email delivery | Buy (transactional email SaaS) | Deliverability is a solved hard problem |
| AI integration | Borrow (SDK) | Provider SDKs handle the protocol complexity |
| Task queue | Build minimal version | Current scale doesn't justify Redis/BullMQ; SQLite-backed queue is appropriate |
| Full-text search | SQLite FTS5 (built-in) | Adequate at current scale; Elasticsearch adds operational complexity |

---

## Capacity and Complexity Estimation

### Complexity Score Model

Score each factor 1–3, sum for total complexity cost. Higher scores → more careful review required.

| Factor | 1 (Low) | 2 (Medium) | 3 (High) |
|--------|---------|-----------|---------|
| Number of components touched | 1–2 | 3–5 | 6+ |
| Dependency on external systems | None | Optional | Required |
| State management complexity | Stateless | Single store | Cross-store dependencies |
| Failure modes | 1 clear path | 2–3 modes | Many / cascading |
| Reversibility | Easy | With effort | Effectively permanent |
| Security implications | None | Review needed | Auth / data scope |
| Performance sensitivity | Not on critical path | Moderate load | High-frequency / latency-sensitive |

**Score interpretation**:
- 7–11: Standard implementation. Coder can own with normal review.
- 12–16: Complex implementation. Senior Coder should lead; Chief reviews approach.
- 17+: High risk. Chief must review architecture before implementation begins.

### Time Estimation Calibration

Working multipliers for this platform:

| Task type | Raw estimate × multiplier |
|-----------|--------------------------|
| UI component (no business logic) | 1.0 |
| API route (CRUD) | 1.3 |
| New DB schema + migration | 1.5 |
| Cross-cutting refactor | 2.0 |
| Auth / security change | 2.0 |
| New agent integration | 1.8 |
| Performance investigation | 2.5 (unknown unknowns) |

Apply the multiplier to the gut-estimate to get a realistic estimate. Track actuals.

---

## Architecture Review Checklist

Use before approving any significant change.

### Structural Correctness
- [ ] Does the proposed design actually solve the stated problem?
- [ ] Are the system boundaries correct? (What's inside vs outside this change?)
- [ ] Does it introduce unexpected coupling between things that should change independently?
- [ ] Is the data model correct? (Is the schema right, not just "will it work today"?)

### Failure Modes
- [ ] What happens when the new component fails?
- [ ] Is there a rollback path if the deployment goes wrong?
- [ ] What monitoring would indicate a problem in production?
- [ ] Is the blast radius contained? (A failure here should not take down unrelated systems.)

### Reversibility
- [ ] Is this decision easily reversible? If not, has it received proportionate review?
- [ ] Are there irreversible dependencies introduced (API contracts, DB schema, auth scheme)?

### Security
- [ ] Does this change touch auth, permissions, or user data?
- [ ] Has Security been consulted for any security-adjacent decisions?
- [ ] Are there new attack surfaces introduced?

### Completeness
- [ ] Are there implementation decisions that are unspecified and will be made during coding? (These are risks — specify them or accept they might be wrong.)
- [ ] Is the error handling strategy specified, not just the happy path?

### Second-Order Effects
- [ ] What changes about the system in 6 months if this is in place?
- [ ] What becomes harder to change after this is built?
- [ ] What other agents or components will be affected?

---

## Second-Order Effects Analysis

A structured way to think through downstream consequences.

### The Five Whys (Applied to "Why Are We Building This?")

Before approving architecture, validate the problem statement:
1. Why do we need this feature? → [stated reason]
2. Why is that the constraint? → [actual constraint or assumption]
3. Why haven't we solved it with what we have? → [gap analysis]
4. Why is this the right solution and not [simpler alternative]? → [elimination reasoning]
5. Why now vs later? → [urgency and priority validation]

If any "why" reveals an assumption that hasn't been validated, that's the first thing to investigate.

### Second-Order Effects Template

```markdown
## Second-Order Analysis: [Decision]

### First-order effects (intended)
- [What we expect to happen]

### Second-order effects (downstream)
- If [first-order effect], then [what follows]...
- Users who rely on [current behavior] will [be affected in this way]...
- The [related system] will need to [change accordingly]...

### Third-order effects (watch for)
- [Things that might change as a result of second-order effects]

### Mitigations
- [How to address the most significant second-order effects]
```

---

## Platform Architecture Map

Current load-bearing structures — decisions here require highest review level.

### Immutable Constraints (effectively irreversible without major coordinated effort)
- **SQLite as primary database** — all agents, all data. Changing this would require migrating all data and rewriting the MCP layer.
- **Task pipeline status machine** — `todo → internal-review → in-progress → agent-review → done` with `human-review` branch. Changing statuses breaks all agents' workflow assumptions.
- **MCP as agent-DB interface** — agents access the database only via MCP tools, never directly. This is a security and concurrency boundary.
- **Agent workspace isolation** — each agent has its own workspace directory; shared state only via the task DB.

### Expensive to Change (require architecture review + coordinated migration)
- Next.js App Router as framework (all routing, server/client split)
- Zustand as client state management
- Task as the primary unit of agent coordination
- Memory MCP as the shared agent memory store
- Agent catalog format (soul.md, CLAUDE.md, manifest.json)

### Cheap to Change (standard review)
- Individual component implementations
- API route business logic (as long as interface stays stable)
- UI layout and styling
- Zustand store shape for UI-only state
- Individual agent soul.md content (doesn't affect platform behavior)
