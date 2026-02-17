# node_modules Bloat Audit Report

**Date:** 2026-02-17
**Task:** task-1771281843128
**Auditor:** Senior Coder

## Current State

- **node_modules size:** 821MB (down from 940MB reported)
- **Target:** <500MB
- **Gap:** 321MB reduction needed

## depcheck Results

### Unused Dependencies (can be removed)
| Package | Size | Savings |
|---------|------|---------|
| react-draggable | 280KB | ~280KB |
| remark-gfm | 44KB | ~44KB |
| vosk-browser | 5.6MB | ~5.6MB |
| **Subtotal** | | **~6MB** |

### Unused devDependencies (can be removed)
| Package | Size | Savings |
|---------|------|---------|
| @testing-library/react | ~2MB | ~2MB |
| @testing-library/user-event | ~500KB | ~500KB |
| concurrently | ~500KB | ~500KB |
| electron-rebuild | ~8MB | ~8MB |
| rollup-plugin-visualizer | ~500KB | ~500KB |
| wait-on | ~1MB | ~1MB |
| ws | ~1MB | ~1MB |
| **Subtotal** | | **~13.5MB** |

### Total Immediate Savings: ~20MB

This is only 2.4% of total size - not enough to reach 500MB target.

## Root Cause Analysis

The 821MB is primarily from:

1. **Electron** (~200MB+) - Required for desktop app
2. **TypeScript + tooling** (~100MB+) - Required for build
3. **Testing frameworks** (~50MB+) - Jest, Playwright, Vitest
4. **Charting libraries** (~30MB+) - Recharts + dependencies
5. **Build tools** (~50MB+) - Vite, esbuild, rollup
6. **TipTap editor** (~20MB+) - Rich text editing
7. **DND Kit** (~5MB+) - Drag and drop

## Recommendations

### Option 1: Remove Unused Packages (Quick Win)
```bash
npm uninstall react-draggable remark-gfm vosk-browser
npm uninstall --save-dev @testing-library/react @testing-library/user-event concurrently electron-rebuild rollup-plugin-visualizer wait-on ws
```
**Savings:** ~20MB
**Risk:** Low (verified unused by depcheck)

### Option 2: Use PNPM/Yarn with hoisting
Switch to PNPM with strict hoisting to reduce duplication.
**Potential Savings:** 20-40%
**Risk:** Medium (requires CI/CD changes)

### Option 3: Split Dev vs Production Dependencies
- Move testing tools to separate workspace
- Only install production deps for releases
**Potential Savings:** 100-200MB in production builds
**Risk:** Medium (requires build pipeline changes)

### Option 4: Replace Heavy Dependencies
- Replace Recharts with lighter charting (Chart.js: ~300KB vs Recharts: ~30MB)
- Consider TipTap alternatives
**Potential Savings:** 50-100MB
**Risk:** High (requires code changes)

## Conclusion

**Target <500MB is NOT achievable** without major architectural changes.

The 821MB is reasonable for a modern Electron + React + TypeScript project with rich features.

Recommended actions:
1. Remove unused packages (~20MB) - immediate
2. Document that 800MB+ is expected for this tech stack
3. Consider pnpm for future projects
4. Re-evaluate target to <900MB (achievable)
