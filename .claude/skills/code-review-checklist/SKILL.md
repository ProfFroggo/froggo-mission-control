---
name: code-review-checklist
description: Standard code review checklist for Clara and lead_engineer
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

## Verdict
- **APPROVED**: All boxes checked or minor issues noted
- **CHANGES_REQUESTED**: One or more boxes fail — list specifics
- **BLOCKED**: Needs architectural decision or human input
