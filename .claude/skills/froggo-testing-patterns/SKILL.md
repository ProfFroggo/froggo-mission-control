---
name: mission-control-testing-patterns
description: Testing patterns and setup for the Mission Control platform
---

# Mission Control Testing Patterns

## Stack
- **Unit tests**: Vitest (`npm test` or `npx vitest run`)
- **Type check**: `npx tsc --noEmit`
- **Build check**: `npm run build:verify` (outputs to `.next-verify/` — safe for running dev server)
- **Dev server**: `npm run dev` → http://localhost:3000

## API Route Testing Pattern
```typescript
import { GET, POST } from '@/app/api/tasks/route';
import { NextRequest } from 'next/server';

test('GET /api/tasks returns array', async () => {
  const req = new NextRequest('http://localhost/api/tasks');
  const res = await GET(req);
  const data = await res.json();
  expect(Array.isArray(data)).toBe(true);
});
```

## better-sqlite3 in Tests
- `better-sqlite3` is a native module that requires a real SQLite file — it cannot be fully mocked
- In tests that exercise DB code, use the actual DB at `~/mission-control/data/mission-control.db` or a test fixture DB
- Wrap DB calls in try/catch so tests degrade gracefully if the DB is absent in CI
- Do NOT mock `getDb()` with an empty object — the synchronous API calls will throw

## Performance Testing (Lighthouse / Core Web Vitals)

> **CRITICAL**: Lighthouse must always target the production build — **never the dev server**.

Turbopack's dev-mode chunks inflate JS bundle sizes and produce artificially **POOR** Core Web Vitals readings. A Lighthouse audit against `npm run dev` is meaningless for performance work.

### Correct workflow
```bash
# 1. Build for production (outputs to .next-verify/ — safe, does NOT crash the running dev server)
npm run build:verify

# 2. Serve the production build
npx serve .next-verify -p 3005    # or whatever port you choose

# 3. Run Lighthouse against the production build
npx lighthouse http://localhost:3005 --view
```

### Why port 3005 / .next-verify?
- `npm run build:verify` writes to `.next-verify/` (not `.next/`), keeping the running dev server untouched.
- The dev server runs on port 3000. Use a **different port** (e.g. 3005) for the production-build server to avoid collision.
- Never run `npm run build` (no `:verify` suffix) — it wipes `.next/` and crashes the dev server for all users.

### Baseline reference
- **LCP target**: ≤ 3.0 s on Tasks view (mobile, simulated throttling)
- Prior baseline (April 2026): Tasks LCP 5,083 ms dev-server (invalid) → 3,753 ms production-build post-fix

## Before Merging Checklist
1. `npx tsc --noEmit` — zero errors
2. `npm test` — all tests pass
3. `npm run build:verify` — build succeeds (use `:verify`, not bare `build`)
4. No `console.log` in production code
5. No hardcoded IDs or credentials
