/**
 * PanelSkeleton - Animated loading placeholder for lazy-loaded panel components
 */

import { Skeleton } from '@radix-ui/themes';

export function PanelSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-6">
      <Skeleton className="h-8 w-48 rounded-lg" />
      <Skeleton className="h-4 w-32 rounded" />
      <div className="grid grid-cols-3 gap-4 mt-2">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
      <div className="flex flex-col gap-2 mt-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton
            key={i}
            className="h-12 rounded-lg"
            style={{ opacity: 1 - i * 0.15 }}
          />
        ))}
      </div>
    </div>
  );
}
