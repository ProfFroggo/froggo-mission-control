/**
 * Loading Panel - Fallback UI for lazy-loaded components
 */

export default function LoadingPanel() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-4 border-mission-control-accent border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-mission-control-text-dim">Loading...</p>
      </div>
    </div>
  );
}
