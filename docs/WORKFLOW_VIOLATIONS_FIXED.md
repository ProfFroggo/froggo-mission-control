# Workflow Violations Fixed — task-1769648388862

**Date:** 2025-06-28  
**Status:** Review

## Summary

Fixed **248 unused import/variable violations** across **73 production source files**.

## What Was Fixed

| Category | Count | Action |
|----------|-------|--------|
| Unused named imports (lucide-react icons, components, types) | 131 | Removed from import statements |
| Unused destructured variables | 62 | Prefixed with `_` or removed from destructuring |
| Unused function declarations | 19 | Commented out with explanation |
| Unused lazy component imports | 4 | Removed |
| Smart quote parse error (test file) | 1 | Fixed encoding |
| Cascading unused references | 31 | Cleaned up after initial removal pass |
| **Total violations fixed** | **248** | |

## Remaining Issues (195 type-system errors)

These require **type definition updates** (not code changes):

| Error Code | Count | Description |
|------------|-------|-------------|
| TS18048 | 69 | `window.clawdbot` possibly undefined — needs null checks or type assertion |
| TS2339 | 63 | Missing properties on types (e.g., `notificationSettings`, `vip`, `snooze`, `froggo` not on `window.clawdbot` type) |
| TS2345 | 23 | Argument type mismatches (e.g., `showToast` parameter types) |
| TS2322 | 9 | Type assignment mismatches |
| TS18046 | 5 | Variables of type `unknown` |
| TS2367 | 4 | Unintentional type comparisons |
| Other | 22 | Various (missing modules, implicit any, etc.) |

### Recommended Next Steps

1. **Update `window.clawdbot` type definition** in `src/types/global.d.ts` to include `notificationSettings`, `vip`, `snooze`, `froggo`, `notifications`, `onNavigate` properties
2. **Fix `showToast` type** — it accepts string messages but the type signature expects `ToastType`
3. **Add null checks** for `window.clawdbot` access patterns
4. **Update test files** to match current component APIs (many tests use outdated prop names)

## Files Modified

73 files across `src/components/`, `src/hooks/`, `src/lib/`, `src/store/`, `src/services/`, and `src/App.tsx`.
