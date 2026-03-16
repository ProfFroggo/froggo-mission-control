/**
 * PanelSkeleton - Animated loading placeholder for lazy-loaded panel components
 */

export function PanelSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-6 animate-pulse">
      <div className="h-8 w-48 rounded-lg bg-mission-control-border" />
      <div className="h-4 w-32 rounded bg-mission-control-border" />
      <div className="grid grid-cols-3 gap-4 mt-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 rounded-lg bg-mission-control-border" />
        ))}
      </div>
      <div className="flex flex-col gap-2 mt-2">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="h-12 rounded-lg bg-mission-control-border"
            style={{ opacity: 1 - i * 0.15 }}
          />
        ))}
      </div>
    </div>
  );
}
