# Platform Operations — Mission Control Reference

Stack: Next.js 16, better-sqlite3 (SQLite), MCP servers (Node.js), Vercel or self-hosted, GitHub Actions

---

## Platform Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│  Next.js App (localhost:3000 / production URL)       │
│  • App Router pages and API routes                   │
│  • Zustand client state                              │
└────────────────────────┬────────────────────────────┘
                         │ HTTP / Server Actions
┌────────────────────────▼────────────────────────────┐
│  MCP Servers (local processes)                       │
│  • mission-control-db MCP  (SQLite access)           │
│  • memory-mcp              (file-based memory)       │
└────────────────────────┬────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────┐
│  Data                                                │
│  ~/mission-control/data/mission-control.db (SQLite)  │
│  ~/mission-control/memory/ (agent memory files)      │
│  ~/mission-control/library/ (agent outputs)          │
└─────────────────────────────────────────────────────┘
```

## Key Paths

| Path | Purpose |
|------|---------|
| `~/git/mission-control-nextjs/` | Application source code |
| `~/mission-control/data/mission-control.db` | Primary SQLite database |
| `~/mission-control/memory/` | Agent memory store (flat files) |
| `~/mission-control/library/` | Agent output files (code, docs, reports) |
| `~/git/mission-control-nextjs/tools/mission-control-db-mcp/` | DB MCP server source |
| `~/git/mission-control-nextjs/tools/memory-mcp/` | Memory MCP server source |

---

## Running the Platform

### Development

```bash
cd ~/git/mission-control-nextjs

# Install dependencies (first time or after package changes)
npm install

# Start development server
npm run dev
# → http://localhost:3000

# The MCP servers start automatically when agents connect via Claude Code.
# They do NOT need to be started manually for development.
```

### Build and Type Check

```bash
# Type check (zero errors before any deployment)
npx tsc --noEmit

# Production build
npm run build

# Start production server locally
npm run start
```

---

## MCP Server Management

The platform has two MCP servers. They run as long-lived processes managed by Claude Code when agents are active.

### mission-control-db MCP

**Location**: `~/git/mission-control-nextjs/tools/mission-control-db-mcp/`

**Purpose**: All agent database access. Agents NEVER access the SQLite file directly — all reads and writes go through this server to prevent concurrent write lock issues.

**Common tasks**:

```bash
# Check MCP server is responding (from agent perspective, via Claude Code)
# DevOps cannot directly test MCP tools — they are invoked by Claude Code sessions

# Check the SQLite database file exists and is readable
ls -lh ~/mission-control/data/mission-control.db

# Check database integrity
sqlite3 ~/mission-control/data/mission-control.db "PRAGMA integrity_check;"

# Check database size and page count
sqlite3 ~/mission-control/data/mission-control.db "PRAGMA page_count; PRAGMA page_size;"

# List all tables
sqlite3 ~/mission-control/data/mission-control.db ".tables"

# Check recent task activity (manual inspection)
sqlite3 ~/mission-control/data/mission-control.db \
  "SELECT id, title, status, updated_at FROM tasks ORDER BY updated_at DESC LIMIT 10;"
```

### memory MCP

**Location**: `~/git/mission-control-nextjs/tools/memory-mcp/`

**Purpose**: Agent memory — reads and writes markdown files in `~/mission-control/memory/`.

**Common tasks**:

```bash
# Check memory directory structure
ls ~/mission-control/memory/

# Check agent memory files
ls ~/mission-control/memory/agents/

# Memory is flat files — can be directly inspected
cat ~/mission-control/memory/agents/coder/2025-01-15-task-notes.md
```

---

## Database Operations

### Backup

```bash
#!/bin/bash
# backup-db.sh — creates timestamped backup of mission-control.db
# Safe to run while app is live (SQLite VACUUM INTO is safe for concurrent reads)

DB_PATH="$HOME/mission-control/data/mission-control.db"
BACKUP_DIR="$HOME/mission-control/backups"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_PATH="$BACKUP_DIR/mission-control-$TIMESTAMP.db"

mkdir -p "$BACKUP_DIR"

# SQLite online backup — safe with concurrent readers
sqlite3 "$DB_PATH" ".backup '$BACKUP_PATH'"

if [ $? -eq 0 ]; then
  echo "Backup created: $BACKUP_PATH"
  # Keep only the last 30 backups
  ls -t "$BACKUP_DIR"/*.db | tail -n +31 | xargs rm -f
else
  echo "ERROR: Backup failed" >&2
  exit 1
fi
```

### Restore

```bash
#!/bin/bash
# restore-db.sh <backup-file>
# WARNING: This overwrites the live database. Requires Mission Control approval.

BACKUP_FILE="$1"
DB_PATH="$HOME/mission-control/data/mission-control.db"

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: restore-db.sh <backup-file>"
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "ERROR: Backup file not found: $BACKUP_FILE"
  exit 1
fi

# Stop the application before restore
echo "Stopping application..."
# (deployment-specific — see deployment runbook)

# Create safety backup of current state
sqlite3 "$DB_PATH" ".backup '${DB_PATH}.pre-restore'"

# Restore
cp "$BACKUP_FILE" "$DB_PATH"
sqlite3 "$DB_PATH" "PRAGMA integrity_check;"

echo "Restore complete. Verify then restart application."
```

### Database Migrations

Migrations live in `~/git/mission-control-nextjs/migrations/` or are applied via the MCP tools. Rules:

1. Each migration is numbered sequentially: `001_initial.sql`, `002_add_priority.sql`
2. Migrations are idempotent (`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`)
3. Never modify a migration that has already been applied to any environment
4. Never drop a column or table in the same migration that removes its use — two-step: (1) remove code references, (2) separate migration to drop schema

```bash
# Apply a migration manually (for emergency use)
# Normally done via MCP tools
sqlite3 ~/mission-control/data/mission-control.db < migrations/003_add_tags.sql

# Verify migration applied
sqlite3 ~/mission-control/data/mission-control.db ".schema tasks"
```

---

## Environment Variables

### Required Environment Variables

| Variable | Purpose | Required in prod? |
|----------|---------|-------------------|
| `NEXTAUTH_SECRET` | NextAuth.js session encryption | Yes |
| `NEXTAUTH_URL` | Application URL for auth callbacks | Yes |
| `DATABASE_URL` | SQLite file path (for reference, not direct access) | Yes |
| `NEXT_PUBLIC_APP_URL` | Public-facing URL (used in client code) | Yes |

**Dev-only** (in `.env.local`, never committed):
```bash
# .env.local — local development only
NEXTAUTH_SECRET=any-random-string-for-dev
NEXTAUTH_URL=http://localhost:3000
DATABASE_URL=~/mission-control/data/mission-control.db
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Production**: Set these in the deployment platform's environment settings (Vercel env vars, or OS environment for self-hosted). Never in a committed file.

### Adding a New Environment Variable

1. Add to `src/lib/env.ts` with validation
2. Document in this file with purpose and required/optional status
3. Add to `.env.example` (committed — safe reference without real values)
4. Set in all environments (dev, staging, production)
5. Never log the value

---

## CI/CD Pipeline

### GitHub Actions — Main Pipeline

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, 'feat/**', 'fix/**']
  pull_request:
    branches: [main]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: TypeScript check
        run: npx tsc --noEmit

      - name: Build
        run: npm run build

      - name: Unit tests
        run: npx vitest run

  # E2E tests run only on main branch (slower, use CI resources wisely)
  e2e:
    runs-on: ubuntu-latest
    needs: validate
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test
```

### Deployment Flow

```
Push to main → CI passes → Deploy to staging → Manual approval → Deploy to production
```

For self-hosted deployments:

```bash
#!/bin/bash
# deploy.sh — production deployment
# Requires: CI passed, Mission Control approval

set -e  # exit on any error

APP_DIR="$HOME/git/mission-control-nextjs"
PM2_NAME="mission-control"

echo "=== Starting deployment $(date) ==="

# 1. Pull latest code
cd "$APP_DIR"
git pull origin main

# 2. Install dependencies
npm ci --production=false  # need devDeps for build

# 3. Type check
npx tsc --noEmit

# 4. Build
npm run build

# 5. Apply any pending migrations
# (run migration scripts here if applicable)

# 6. Restart application
pm2 restart "$PM2_NAME" || pm2 start npm --name "$PM2_NAME" -- start

# 7. Health check — wait up to 30s for app to respond
for i in {1..6}; do
  if curl -sf http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "=== Deployment successful ==="
    exit 0
  fi
  echo "Waiting for app to start... ($i/6)"
  sleep 5
done

echo "ERROR: Health check failed after deployment"
echo "Rolling back..."
pm2 restart "$PM2_NAME" --update-env  # restart with previous build if still on disk
exit 1
```

---

## Common Ops Tasks

### Restart Application (without deploying new code)

```bash
# Self-hosted with PM2
pm2 restart mission-control

# Vercel: deployments are immutable — rollback to previous deployment instead
vercel rollback  # or via Vercel dashboard
```

### Check Application Logs

```bash
# PM2 logs (self-hosted)
pm2 logs mission-control --lines 100

# Filter for errors only
pm2 logs mission-control --lines 500 | grep -i "error\|fatal\|uncaught"

# Vercel logs
vercel logs --follow
```

### Check Disk Space

```bash
# Check overall disk usage
df -h

# Check mission-control directory sizes
du -sh ~/mission-control/*/

# Find large files in library (outputs can accumulate)
find ~/mission-control/library -size +10M -exec ls -lh {} \;
```

### Rotate Agent Memory (cleanup old files)

```bash
#!/bin/bash
# Keeps last 30 days of agent memory files. Run monthly.
find ~/mission-control/memory/agents -name "*.md" -mtime +30 -exec ls -la {} \;
# Review output before deleting:
# find ~/mission-control/memory/agents -name "*.md" -mtime +30 -delete
```

---

## Monitoring Checklist

Minimum monitoring for a healthy platform:

### Uptime
- [ ] External uptime check (UptimeRobot free tier) hitting `/api/health`
- [ ] Alert to email/Slack on downtime

### Application Health Endpoint

```typescript
// app/api/health/route.ts
export async function GET() {
  // Check DB connectivity
  try {
    // Simple read via MCP (or direct sqlite3 check)
    const timestamp = new Date().toISOString();
    return Response.json({
      status: 'ok',
      timestamp,
      version: process.env.npm_package_version,
    });
  } catch (error) {
    return Response.json(
      { status: 'error', error: 'Database unavailable' },
      { status: 503 }
    );
  }
}
```

### Error Rate
- [ ] Monitor application error logs for rate spikes
- [ ] Alert if >10 errors/minute

### Database
- [ ] Monitor DB file size growth (alert if >500MB — SQLite has practical limits)
- [ ] Daily backup job with success/failure notification
- [ ] Weekly `PRAGMA integrity_check` run

---

## Incident Response Protocol

1. **Assess**: Is the platform down? Degraded? Who is affected?
2. **Rollback first** (if deployment recently): Revert to previous version immediately if the incident started after a deployment.
3. **Communicate**: Post in the Mission Control task system with initial assessment. Don't disappear into debugging silently.
4. **Diagnose**: Check logs, check metrics, form a hypothesis before acting.
5. **Fix**: Apply the minimal fix. Not a cleanup refactor — restore service.
6. **Verify**: Confirm the fix worked. Don't declare done based on hope.
7. **Post-mortem**: Write up timeline, root cause, fix, and what would have caught it earlier. Save to memory.

**Escalation**:
- Agent platform issues → Chief (architecture), Mission Control (priority call)
- Security incidents → Security immediately, Mission Control for communication
- Data loss or corruption → Mission Control immediately, stop all writes to DB
