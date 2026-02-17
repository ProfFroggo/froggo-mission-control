# Bundle Chunking Strategy Analysis

**Date:** 2026-02-17
**Task:** task-1771281843202
**Auditor:** Senior Coder

## Current State

- **Total JS chunks:** 76 files
- **Total size:** ~5.5MB
- **Minified:** No (minify: false in vite.config.ts)

### Size Distribution
| Category | Count | Size Range |
|----------|-------|------------|
| Tiny | 18 | <1KB |
| Small | 10 | 1-10KB |
| Medium | 32 | 10-50KB |
| Large | 7 | 50-100KB |
| XLarge | 9 | 100-500KB |
| Huge | 18 | 500KB+ |

### Largest Chunks (Potential Issues)
| Chunk | Size | Notes |
|-------|------|-------|
| WritingWorkspace | 1.2MB | Writing feature - could lazy load |
| index | 1.0MB | Main bundle - core app |
| CartesianChart | 721KB | Recharts - already optimized |
| schemas | 390KB | Zod schemas - validation logic |

## Problems Identified

### 1. Too Many Tiny Chunks (18 <1KB)
- HTTP request overhead exceeds content size
- Waterfall loading issue

### 2. No Manual Chunking Strategy
- Vite using default automatic chunking
- No vendor/library separation

### 3. Large Main Bundle (index: 1.0MB)
- Core app code not split by route
- Initial load time impacted

## Optimization Strategy

### Option 1: Manual Rollup Chunking (Recommended)
```typescript
// vite.config.ts
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        // Vendor libraries
        'vendor-react': ['react', 'react-dom'],
        'vendor-ui': ['lucide-react', '@dnd-kit/core'],
        'vendor-charts': ['recharts'],
        'vendor-state': ['zustand', 'zod'],
        
        // Feature chunks
        'feature-writing': ['./src/components/writing/**/*'],
        'feature-x': ['./src/components/X*', './src/components/X*/**/*'],
        'feature-analytics': ['./src/components/Analytics*'],
      },
      // Merge small chunks
      experimentalMinChunkSize: 10000, // 10KB minimum
    },
  },
}
```

### Option 2: Disable Code Splitting for Small App
```typescript
// For apps <10 routes, single bundle may be faster
build: {
  rollupOptions: {
    output: {
      manualChunks: undefined,
    },
  },
}
```

### Option 3: Dynamic Imports for Heavy Features
Already partially implemented for AnalyticsDashboard (249KB chunk).

## Recommended Configuration

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        // Merge chunks smaller than 10KB
        experimentalMinChunkSize: 10000,
        
        // Manual chunking for vendors
        manualChunks: {
          'vendor-core': ['react', 'react-dom'],
          'vendor-charts': ['recharts'],
        },
      },
    },
    
    // Enable minification for production
    minify: 'esbuild',
    
    // Enable source maps for debugging
    sourcemap: true,
  },
});
```

## Expected Results

- **Chunk count:** 76 → ~30-40 (reduce by 40-50%)
- **Tiny chunks:** 18 → 0 (merged into larger chunks)
- **Initial load:** Faster (fewer HTTP requests)
- **Cache efficiency:** Better (stable vendor chunks)

## Implementation Notes

1. **Test after changes:** Verify all features load correctly
2. **Monitor metrics:** Check Lighthouse performance scores
3. **Consider HTTP/2:** With HTTP/2, many small chunks are less problematic
4. **Cache headers:** Ensure proper caching for vendor chunks

## Conclusion

The 76 chunks is not inherently problematic with HTTP/2, but:
- 18 tiny chunks (<1KB) should be merged
- Manual vendor chunking would improve caching
- Current strategy is acceptable for development

**Recommendation:** Implement `experimentalMinChunkSize: 10000` and manual vendor chunks.
