# Security Policy

## Reporting a Vulnerability

To report a security vulnerability in Froggo Mission Control, please email **security@froggo.pro** with:

- A clear description of the vulnerability
- Steps to reproduce
- Potential impact assessment
- Any suggested remediation

We aim to acknowledge reports within 48 hours and provide a remediation timeline within 7 days.

**Please do not open public GitHub issues for security vulnerabilities.**

---

## Security Architecture

### Process Isolation

Each Claude Code agent session runs as a separate subprocess spawned by the Mission Control platform. Agents communicate with the platform exclusively through:

1. **MCP tools** (`tools/mission-control-db-mcp/`, `tools/memory-mcp/`, `tools/cron-mcp/`) — typed, schema-validated interfaces to the SQLite database and memory vault.
2. **HTTP API routes** (`/api/*`) — Next.js route handlers with authentication and authorization checks.
3. **Claude Code hooks** (`tools/hooks/`) — `PreToolUse` and `PostToolUse` hooks that intercept every tool call for tier-based gating.

Agents cannot access the host filesystem, network, or processes outside their permitted scope without going through one of these controlled interfaces.

### Credential Management

All secrets are stored in the **OS Keychain** via [keytar](https://github.com/atom/node-keytar):

- API keys (Anthropic, Twitter/X, etc.)
- OAuth tokens (Google Workspace)
- Service credentials

The centralized accessor is `src/lib/keychain.ts`. Direct use of `process.env` for secrets is prohibited by platform convention — all environment values are consumed through `src/lib/env.ts` which enforces the keychain-first pattern.

### Hook-Based Tool Gating (PreToolUse)

`tools/hooks/approval-hook.js` runs before every tool call in every agent session. It:

1. Resolves the agent's trust tier from the database via `CLAUDE_CODE_SESSION_ID`.
2. Classifies the requested tool into one of four tiers:
   - **Tier 0** — Read-only (Read, Glob, Grep, task/chat reads) — always approved.
   - **Tier 1** — Local writes (Edit, Write, task updates) — approved for Apprentice and above.
   - **Tier 2** — Sensitive local ops (git commit, file delete, task done) — approved for Worker and above.
   - **Tier 3** — External/destructive (git push, rm -rf, deploy) — approved for Trusted/Admin only.
3. Returns `{ decision: "approve" }` or `{ decision: "block", reason: "..." }`.
4. For the `restricted` tier, non-Tier-0 actions are hard-blocked. For all other tiers, out-of-bounds actions create an approval record in the Approval Queue and are still approved (human-in-the-loop review, not hard block).

### Deferred Action Executor

Actions with real-world side effects (email, social media, git push, file deletion) follow a **deferred execution pattern**. Agents have no direct write path to external services — they can only propose an action. A Python executor script is the only mechanism that can trigger a real-world write, and it only runs when a human manually approves the action in the dashboard.

```
Agent proposes action
        ↓
POST /api/actions  →  pending_actions table  +  approvals table
        ↓
Approval Queue dashboard — human reviews rich preview
  (email layout / tweet card / danger box / git push details)
        ↓
Human clicks "Approve & Run"
        ↓
POST /api/approvals/:id fires tools/executors/{action}.py
  send_email.py   →  POST /api/gmail/messages/send  (Google OAuth)
  post_x.py       →  POST /api/x/tweet              (twitter-api-v2)
  delete_file.py  →  safe delete with home-dir path guard
  git_push.py     →  git push with force-push guard on main/master
        ↓
Result stored in pending_actions.result
Approval record permanently updated (approved / failed / rejected)
```

**Why agents cannot accidentally trigger these actions:**

- `POST /api/actions` only writes to the database. No executor is called.
- The executor `spawnSync` call lives exclusively in `POST /api/approvals/:id` — reachable only through the authenticated dashboard UI.
- Executor scripts call internal Next.js API routes rather than external services directly, keeping all traffic inside the authenticated session layer.
- Admin-tier bypass (immediate execution without approval) is an explicit per-agent configuration, off by default for all agents, and every bypass is logged to `analytics_events`.
- Scheduled actions require human pre-approval before they are queued; the schedule controls timing, not authorization.

### Data Privacy

| Data | Location | Cloud Sync |
|------|----------|------------|
| SQLite database | `~/mission-control/data/mission-control.db` | Never |
| Memory vault | `~/mission-control/memory/` | Never |
| Agent library output | `~/mission-control/library/` | Never |
| Audit logs (analytics_events) | SQLite table | Never |
| Session transcripts | `~/mission-control/memory/sessions/` | Never |

No telemetry is collected. No data leaves the host machine unless an agent explicitly triggers an approved external action.

### Dependency Security

Production dependencies are minimized. The platform uses:

- `better-sqlite3` (not `sqlite3`) for synchronous, binding-level DB access with no native SQL injection surface.
- `keytar` for OS-native credential storage.
- `googleapis` + `twitter-api-v2` for OAuth-authenticated external API calls.

Run `npm audit` before any release. High/critical vulnerabilities in direct dependencies must be resolved before deployment.

### Input Sanitization

All user-supplied HTML rendered in the UI is sanitized via `src/utils/sanitize.ts` (DOMPurify). SQL queries use parameterized statements via `better-sqlite3`'s `.prepare().run()` API — no string-interpolated SQL.
