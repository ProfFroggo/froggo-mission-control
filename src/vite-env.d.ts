// Migration shim: components use import.meta.env (Vite convention).
// In Next.js, use process.env or NEXT_PUBLIC_ vars instead.
// This shim silences TS errors during migration — refactor in Phase 4.

interface ImportMeta {
  readonly env: Record<string, string | undefined>;
}

// window.clawdbot compat — polyfilled by src/lib/bridge.ts
interface Window {
  clawdbot?: any;
}
