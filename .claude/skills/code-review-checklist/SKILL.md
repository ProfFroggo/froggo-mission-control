---
name: code-review-checklist
description: Standard code review checklist for Clara and senior-coder
---

# Code Review Checklist

## Correctness
- [ ] Logic matches stated requirements
- [ ] Edge cases handled (empty arrays, null values, network errors)
- [ ] No off-by-one errors in loops or pagination

## Security
- [ ] SQL uses parameterized queries (never string interpolation)
- [ ] User input validated before use
- [ ] No secrets in code or logs
- [ ] API routes don't expose sensitive data

## TypeScript
- [ ] `npx tsc --noEmit` passes cleanly
- [ ] No `any` introduced without clear reason
- [ ] Async/await used correctly (no floating promises)

## Performance
- [ ] No N+1 queries (use JOINs)
- [ ] Large lists paginated
- [ ] Expensive operations not in render loops

## Mission Control Specifics
- [ ] DB schema changes run via `npx tsx tools/migrate-db.js` (never raw sqlite3 CLI)
- [ ] ENV values imported via `src/lib/env.ts` not `process.env` directly
- [ ] New output files written to `~/mission-control/library/` (correct subfolder)
- [ ] External actions (tweets, emails, deploys) use `approval_create` MCP tool

## Verdict
- **APPROVED**: All boxes checked or minor issues noted
- **CHANGES_REQUESTED**: One or more boxes fail — list specifics
- **BLOCKED**: Needs architectural decision or human input
