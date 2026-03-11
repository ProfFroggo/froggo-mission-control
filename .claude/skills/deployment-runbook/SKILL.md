---
name: deployment-runbook
description: Standard process for deploying changes to the mission-control platform — pre-deploy checklist, deployment steps, rollback procedure, and post-deploy smoke tests.
---

# Deployment Runbook

## Purpose

Deploy changes to the mission-control platform safely, reproducibly, and with a clear rollback path. Every deployment follows this runbook regardless of how small the change appears. "Quick deploys" without process are how incidents happen.

## Trigger Conditions

Load this skill when:
- Deploying a new build of the mission-control Next.js application
- Restarting or updating an MCP server
- Deploying a database migration
- Rolling back a deployment after a smoke test failure
- Diagnosing a deployment that failed mid-process

## Platform Architecture Reference

```
App:        ~/git/mission-control-nextjs      → localhost:3000 (dev) / production URL
DB:         ~/mission-control/data/mission-control.db   (SQLite)
MCP Tools:  tools/mission-control-db-mcp/              (DB MCP server)
            tools/memory-mcp/                           (Memory MCP server)
Library:    ~/mission-control/library/                  (agent output files)
Memory:     ~/mission-control/memory/                   (agent memory vault)
```

## Procedure

### Step 1 — Pre-Deploy Checklist

Complete every item. Do not begin deployment with any unchecked item.

#### Code and Build
- [ ] All tests passing locally: `npm test` exits clean (0 failures)
- [ ] Build succeeds: `npm run build` completes without errors
- [ ] No TypeScript errors: `npx tsc --noEmit` clean
- [ ] No ESLint errors: `npm run lint` clean
- [ ] All changes are committed to git — working tree is clean (`git status`)
- [ ] Branch is rebased on / merged from main (no stale base)

#### Environment Variables
- [ ] All required env vars are set in production environment
- [ ] No hardcoded secrets in code (confirm with `git diff main -- '*.ts' '*.tsx' '*.js'` scan)
- [ ] `src/lib/env.ts` is the only place env vars are consumed (not `process.env` directly elsewhere)
- [ ] Any new env vars are documented and set in the deployment environment

#### Database Migrations
- [ ] Any schema migrations reviewed and tested against a copy of the DB
- [ ] Migrations are backwards-compatible (old code runs against new schema without errors) OR deployment is coordinated as atomic rollover
- [ ] Migration rollback script exists if migration is not reversible natively
- [ ] DB backed up immediately before migration runs (see backup step below)

#### Dependencies
- [ ] `package.json` and `package-lock.json` / `pnpm-lock.yaml` are committed together
- [ ] No unresolved peer dependency warnings that could affect runtime behavior
- [ ] Any new packages are security-reviewed (not just added without audit)

#### Approval Gate
- [ ] P0/P1 tasks: Clara review sign-off received before deployment
- [ ] External API integrations or payment flows: human-review task completed
- [ ] If this deploy ships a user-facing feature: product owner acknowledged

### Step 2 — Back Up the Database

Always back up the SQLite database immediately before any deployment that includes a migration or any structural change.

```bash
# Create timestamped backup
BACKUP_DATE=$(date +"%Y%m%d_%H%M%S")
cp ~/mission-control/data/mission-control.db \
   ~/mission-control/data/backups/mission-control_${BACKUP_DATE}.db

# Verify backup exists and is non-zero
ls -lh ~/mission-control/data/backups/mission-control_${BACKUP_DATE}.db
```

Note the backup filename in the deployment log. If no backup exists and the migration fails, recovery depends on filesystem-level backups only.

For app-only deploys with no migration: backup is still recommended but optional if DB schema is unchanged.

### Step 3 — Run Database Migrations

If the deployment includes schema changes:

```bash
cd ~/git/mission-control-nextjs

# Review migration file before running
cat migrations/[migration-file].sql

# Run migration
npm run db:migrate

# Verify migration applied
npm run db:status
```

Verify the migration result by querying the DB:
```bash
# Quick schema verification
sqlite3 ~/mission-control/data/mission-control.db ".schema [changed_table]"

# Verify row counts are as expected (no accidental truncation)
sqlite3 ~/mission-control/data/mission-control.db "SELECT COUNT(*) FROM [critical_table];"
```

If migration fails: stop. Do not proceed to app deployment. Restore from backup and investigate.

### Step 4 — Deploy the Next.js Application

```bash
cd ~/git/mission-control-nextjs

# Pull latest code (if deploying from remote)
git pull origin main

# Install dependencies (if package.json changed)
npm ci

# Build production bundle
npm run build

# Check build output for errors or warnings
# Expected: "Route (app)" table showing all routes, no errors
```

**For development / local environment:**
```bash
# Restart dev server
# Kill existing process first
pkill -f "next dev" || true
npm run dev &

# Verify server started
sleep 3 && curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health
# Expected: 200
```

**For production deployment (adjust for your hosting):**
```bash
# Example: PM2-managed process
pm2 restart mission-control

# Example: systemd-managed process
sudo systemctl restart mission-control

# Example: Docker
docker-compose pull && docker-compose up -d --no-deps app
```

### Step 5 — Restart MCP Servers

If MCP server code changed (tools/mission-control-db-mcp/ or tools/memory-mcp/):

```bash
# DB MCP server
cd ~/git/mission-control-nextjs/tools/mission-control-db-mcp
npm ci && npm run build

# Memory MCP server
cd ~/git/mission-control-nextjs/tools/memory-mcp
npm ci && npm run build
```

MCP servers are restarted by the Claude Desktop / Claude Code process on next connection. If they are running as independent processes, restart them after the build:

```bash
# Restart if running as background process
pkill -f "mission-control-db-mcp" || true
pkill -f "memory-mcp" || true
# They will restart on next Claude connection, or restart manually:
node tools/mission-control-db-mcp/dist/index.js &
node tools/memory-mcp/dist/index.js &
```

Verify MCP server health by executing a simple tool call after restart.

### Step 6 — Post-Deploy Smoke Tests

Run these checks immediately after every deployment. Do not mark a deployment done until smoke tests pass.

#### Application Health
```bash
# HTTP health check
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health
# Expected: 200

# Check for error responses on critical routes
curl -s http://localhost:3000/api/health | python3 -m json.tool
# Expected: JSON with status: "ok"
```

#### Route Verification — Check These Pages/Endpoints

| Route | Expected | Check method |
|-------|----------|-------------|
| `GET /` | 200 — dashboard loads | Browser or curl |
| `GET /api/health` | 200 + `{"status":"ok"}` | curl |
| `GET /api/tasks` | 200 + JSON array | curl |
| `POST /api/tasks` | 200 or 201 on valid payload | curl with test body |
| `GET /api/agents` | 200 + agent list | curl |
| MCP: task_list | Returns tasks | MCP tool call |
| MCP: task_create | Creates task | MCP tool call |

Document each check result with timestamp.

#### Functional Spot-Check

- [ ] Create a test task via MCP `task_create` — verify it appears in task list
- [ ] Post a task activity via `task_activity_create` — verify it appears on the task
- [ ] Read a memory file via `memory-mcp` — verify read succeeds
- [ ] Check agent chat via `chat_read` — verify no errors

#### Database Integrity
```bash
# Check DB is not corrupted
sqlite3 ~/mission-control/data/mission-control.db "PRAGMA integrity_check;"
# Expected: "ok"

# Check recent row counts are reasonable
sqlite3 ~/mission-control/data/mission-control.db \
  "SELECT COUNT(*) FROM tasks; SELECT COUNT(*) FROM task_activity;"
```

### Step 7 — Rollback Procedure

Execute rollback if ANY smoke test fails or if the application is behaving unexpectedly post-deploy.

**App rollback (code only — no migration):**
```bash
cd ~/git/mission-control-nextjs

# Identify last known good commit
git log --oneline -10

# Revert to last known good
git checkout [last-good-commit-hash]
npm ci && npm run build

# Restart app (repeat Step 4)
```

**Database rollback (if migration was applied):**
```bash
# Restore from pre-deploy backup
BACKUP_FILE="mission-control_YYYYMMDD_HHMMSS.db"  # use actual filename from Step 2

# Stop app before restoring DB
pkill -f "next" || true

# Restore backup
cp ~/mission-control/data/backups/${BACKUP_FILE} \
   ~/mission-control/data/mission-control.db

# Verify restore
sqlite3 ~/mission-control/data/mission-control.db "PRAGMA integrity_check;"

# Restart app on rolled-back code
git checkout [pre-migration-commit]
npm ci && npm run build
# Restart app
```

**Post-rollback:**
1. Confirm smoke tests pass on rolled-back state
2. Create incident task in task board: title "Deployment rollback — [date] — [reason]"
3. Post full timeline as task activity
4. Do not re-attempt deployment until root cause is understood

### Step 8 — Incident Escalation

If smoke tests fail and rollback does not resolve the issue:

| Condition | Action |
|-----------|--------|
| App returns 500 errors — rollback did not fix | Create `critical` priority task → human-review immediately |
| DB integrity check fails | Stop all operations → human-review → do not restore from backup without human sign-off |
| MCP servers not responding after restart | Create high-priority task, attempt manual restart, escalate to human if not resolved in 15 min |
| Data appears missing or corrupted | Create `critical` task → human-review → document exactly what is missing before any action |

Incident task format:
```
Title: INCIDENT — [what broke] — [date]
Description:
  - Timeline: [when deploy started, when issue detected, when rollback happened]
  - Symptoms: [exactly what is failing]
  - Impact: [which features/agents are affected]
  - Rollback status: [complete / in-progress / failed]
  - Steps taken: [list]
  - Next: [what human needs to decide or do]
Priority: P0
Status: human-review
```

## Deployment Log Template

After every deployment, save a log entry:

```markdown
## Deployment Log — YYYY-MM-DD HH:MM

**Deploy type**: [app / migration / mcp / full]
**Commit deployed**: [git hash]
**Deployed by**: [agent name]
**Duration**: [start to completion in minutes]

### Changes Deployed
- [Brief description of what changed]

### Pre-Deploy Checks
All items: PASSED / [list any that needed attention]

### Migration
Applied: YES / NO
Migration file: [filename if applicable]
DB backup: [backup filename]

### Smoke Tests
| Check | Result |
|-------|--------|
| Health endpoint | PASS / FAIL |
| Task list | PASS / FAIL |
| Task create | PASS / FAIL |
| MCP tool call | PASS / FAIL |
| DB integrity | PASS / FAIL |

### Result: SUCCESS / ROLLBACK
[If rollback: reason and steps taken]

### Notes
[Any issues, anomalies, or follow-up tasks]
```

## Output

Save deployment logs to: `~/mission-control/library/docs/research/YYYY-MM-DD_deploy_log.md`
Save incident reports to: `~/mission-control/library/docs/research/YYYY-MM-DD_incident_[description].md`

## Examples

**Good task for this skill:** "Deploy the latest build to production — run the full pre-launch checklist and smoke tests."

**Good task for this skill:** "The post-deploy smoke test on `/api/tasks` is returning 500. Investigate and determine whether to rollback."

**Anti-pattern to avoid:** Deploying directly after a build without running smoke tests. Broken deploys discovered by users are 10× harder to recover from than broken deploys caught by a 5-minute smoke test.

**Escalation trigger:** Any production incident where rollback does not restore normal function → create P0 human-review task immediately and do not attempt further changes without human direction.
