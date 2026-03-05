---
name: nextjs-patterns
description: Next.js App Router patterns and conventions for Mission Control
---

# Next.js App Router Patterns

## Route Structure
```
app/
├── api/{resource}/route.ts          # Collection: GET, POST
├── api/{resource}/[id]/route.ts     # Item: GET, PUT, DELETE
└── {page}/page.tsx                  # Page component
```

## API Route Template
```typescript
import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/database';

export async function GET(_req: NextRequest) {
  try {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM items').all();
    return NextResponse.json(rows);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
```

## Dynamic Route Params
```typescript
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  ...
}
```

## ENV Usage
Always import from `src/lib/env.ts`:
```typescript
import { ENV } from '@/lib/env';
const filePath = ENV.LIBRARY_PATH + '/output.md';
```

## SSE (Server-Sent Events)
Use `ReadableStream` with `TransformStream`. See `/api/agents/stream/route.ts` for pattern.

## Database
- Always use singleton: `import getDb from '@/lib/database'`
- Never `new Database(...)` directly
- Column names are camelCase (migrated from Electron): `assignedTo`, `createdAt`

## Key Conventions
- TailwindCSS only — no inline styles
- Zustand for client state, SWR or fetch for server data
- Error boundaries on all dynamic panels
- Dark theme: `bg-gray-900 text-gray-100`
