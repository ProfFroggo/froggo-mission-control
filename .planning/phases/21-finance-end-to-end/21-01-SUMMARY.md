# Phase 21 Plan 01: Fix CLI JSON Output + IPC Handler Args Summary

**One-liner:** Added --format json to 4 finance CLI commands, fixed alerts crash on non-existent column, fixed IPC budget-type flag + upload params + PDF handler

## What Was Done

### Task 1: Add --format json to CLI finance commands and fix finance-alerts crash
- **finance-transactions**: Added `--format json` flag, outputs `{"transactions": [...]}`
- **finance-budget-status**: Added `--format json` flag, outputs `{"budgets": [...]}` with nested categories
- **finance-alerts**: Added `--format json` flag, outputs `{"alerts": [...]}`; fixed crash by replacing `WHERE status = 'active'` with `WHERE acknowledged = 0` (finance_alerts table has no status column)
- **finance-upload**: Added `--format json` flag, outputs import stats as JSON
- Removed duplicate dead-code first definitions of `cmd_finance_alerts` and `cmd_finance_insights` (Python uses last definition)
- Commit: `ff55d4f`

### Task 2: Fix IPC handlers -- upload params, budget-type flag, PDF accept
- **finance:getBudgetStatus**: Changed `--type` to `--budget-type` (matching CLI); changed return field from `budget` to `status` (matching global.d.ts type declaration)
- **finance:uploadCSV**: Added `--account acc-default --budget-type family` params to CLI call; added auto-creation of default account if missing
- **finance:uploadPDF**: New IPC handler that writes PDF to temp file and delegates to finance-manager agent for processing
- Commit: `91b745c`

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Return field `status` (not `budget`) from getBudgetStatus IPC | Matches global.d.ts type declaration; Plan 21-02 will update frontend to read `.status` |
| Default account ID `acc-default` for uploads | Simple default that auto-creates; users can add specific accounts later |
| PDF upload fires-and-forgets to agent | Agent processes asynchronously; avoids blocking IPC response |
| Temp PDF cleanup after 5 min | Gives agent enough time to read the file |

## Deviations from Plan

None -- plan executed exactly as written.

## Verification Results

```
froggo-db finance-transactions --limit 3 --format json  -> {"transactions": []}  (valid JSON)
froggo-db finance-budget-status --budget-type family --format json  -> {"budgets": []}  (valid JSON)
froggo-db finance-alerts --format json  -> {"alerts": []}  (valid JSON, no crash)
IPC: --budget-type ${budgetType} confirmed in main.ts
IPC: --account acc-default confirmed in main.ts
IPC: finance:uploadPDF handler confirmed in main.ts
TypeScript: no finance-related compile errors
```

## Key Files

| File | Action | Description |
|------|--------|-------------|
| `~/froggo/tools/froggo-db/finance_commands.py` | Modified | --format json on 4 commands, alerts crash fix, dead code removal |
| `electron/main.ts` | Modified | Fixed 3 IPC handlers, added uploadPDF handler |

## Duration

~3.5 minutes
