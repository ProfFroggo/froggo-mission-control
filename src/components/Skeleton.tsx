// Skeleton loading components with shimmer effect

interface SkeletonProps {
  className?: string;
  shimmer?: boolean;
}

export function Skeleton({ className = '', shimmer = true }: SkeletonProps) {
  return (
    <div 
      className={`relative overflow-hidden bg-mission-control-border/50 rounded ${className}`}
    >
      {shimmer && (
        <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      )}
    </div>
  );
}

export function SkeletonText({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton 
          key={i} 
          className={`h-4 ${i === lines - 1 ? 'w-3/4' : 'w-full'}`} 
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className = '' }: SkeletonProps) {
  return (
    <div className={`p-4 bg-mission-control-surface border border-mission-control-border rounded-xl ${className}`}>
      <div className="flex items-center gap-3 mb-3">
        <Skeleton className="w-10 h-10 rounded-full" />
        <div className="flex-1">
          <Skeleton className="h-4 w-1/3 mb-2" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <SkeletonText lines={2} />
    </div>
  );
}

export function SkeletonList({ count = 3, className = '' }: { count?: number; className?: string }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 bg-mission-control-surface border border-mission-control-border rounded-xl">
          <Skeleton className="w-8 h-8 rounded-lg" />
          <div className="flex-1">
            <Skeleton className="h-4 w-2/3 mb-1" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex gap-4 p-3 bg-mission-control-border/50 rounded-lg">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 p-3">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonMessage({ className = '' }: SkeletonProps) {
  return (
    <div className={`flex gap-3 ${className}`}>
      <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
      <div className="flex-1">
        <Skeleton className="h-4 w-24 mb-2" />
        <div className="p-3 bg-mission-control-surface rounded-xl">
          <SkeletonText lines={2} />
        </div>
      </div>
    </div>
  );
}

export function SkeletonInbox() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="p-4 bg-mission-control-surface border border-mission-control-border rounded-xl">
          <div className="flex items-start gap-3">
            <Skeleton className="w-10 h-10 rounded-lg" />
            <div className="flex-1">
              <div className="flex justify-between mb-2">
                <Skeleton className="h-5 w-1/3" />
                <Skeleton className="h-4 w-16" />
              </div>
              <SkeletonText lines={2} />
              <div className="flex gap-2 mt-3">
                <Skeleton className="h-8 w-20 rounded-lg" />
                <Skeleton className="h-8 w-20 rounded-lg" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
