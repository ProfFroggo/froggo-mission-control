---
name: froggo-testing-patterns
description: Testing patterns and setup for the Froggo platform
---

# Froggo Testing Patterns

## Stack
- **Unit tests**: Vitest (`npm test`)
- **Type check**: `npx tsc --noEmit`
- **Build check**: `npm run build`

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

## Before Merging Checklist
1. `npx tsc --noEmit` — zero errors
2. `npm test` — all tests pass
3. `npm run build` — build succeeds
4. No `console.log` in production code
5. No hardcoded IDs or credentials
