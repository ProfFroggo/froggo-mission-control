---
name: mission-control-testing-patterns
description: Testing patterns and setup for the Mission Control platform
---

# Mission Control Testing Patterns

## Stack
- **Unit tests**: Vitest (`npm test` or `npx vitest run`)
- **Type check**: `npx tsc --noEmit`
- **Build check**: `npm run build`
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

## Before Merging Checklist
1. `npx tsc --noEmit` — zero errors
2. `npm test` — all tests pass
3. `npm run build` — build succeeds
4. No `console.log` in production code
5. No hardcoded IDs or credentials
