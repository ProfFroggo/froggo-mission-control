---
name: froggo-coding-standards
description: Froggo platform coding standards and conventions
---

# Froggo Coding Standards

## TypeScript
- Always use TypeScript (no JavaScript in src/)
- `noImplicitAny: false` (migrated Electron code — accept any where needed)
- Explicit return types on API functions
- Use `Promise<T>` not `Promise<any>` where type is known

## Module Pattern
Each feature is a module in `src/modules/`:
```
src/modules/{name}/
├── module.json     # id, name, description, enabled
├── index.ts        # re-exports
└── views/          # React components
```

## API Routes
- Use `getDb()` from `@/lib/database` — singleton, never create new Database()
- Always handle errors with try/catch, return `NextResponse.json({ error }, { status: 500 })`
- Use async params: `{ params }: { params: Promise<{ id: string }> }` then `await params`
- Column names are camelCase (migrated schema): `assignedTo`, `createdAt`, `agentId`

## Zustand Stores
- Use `zustand/middleware` persist for UI state
- Actions are synchronous where possible
- API calls in actions, not in components

## Styling
- TailwindCSS only — no inline styles
- Dark theme default: `bg-gray-900 text-gray-100`
- Buttons: `bg-emerald-700 hover:bg-emerald-600`
- Borders: `border-gray-700`

## Testing
- Vitest for unit tests (`*.test.ts`)
- Test files next to source: `foo.ts` + `foo.test.ts`
- Always test business logic functions
