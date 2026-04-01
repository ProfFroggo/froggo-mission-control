// Skeleton loading components - wraps Radix Themes Skeleton

import { Skeleton as RadixSkeleton, Box, Flex } from '@radix-ui/themes';

interface SkeletonProps {
  className?: string;
  shimmer?: boolean;
}

export function Skeleton({ className = '', shimmer: _shimmer = true }: SkeletonProps) {
  return <RadixSkeleton className={className} />;
}

export function SkeletonText({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <Box className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <RadixSkeleton
          key={i}
          className={`h-4 ${i === lines - 1 ? 'w-3/4' : 'w-full'}`}
        />
      ))}
    </Box>
  );
}

export function SkeletonCard({ className = '' }: SkeletonProps) {
  return (
    <Box p="4" className={`bg-mission-control-surface border border-mission-control-border rounded-lg ${className}`}>
      <Flex align="center" gap="3" mb="3">
        <RadixSkeleton className="w-10 h-10 rounded-full" />
        <Box className="flex-1">
          <RadixSkeleton className="h-4 w-1/3 mb-2" />
          <RadixSkeleton className="h-3 w-1/2" />
        </Box>
      </Flex>
      <SkeletonText lines={2} />
    </Box>
  );
}

export function SkeletonList({ count = 3, className = '' }: { count?: number; className?: string }) {
  return (
    <Box className={`space-y-3 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <Flex key={i} align="center" gap="3" p="3" className="bg-mission-control-surface border border-mission-control-border rounded-lg">
          <RadixSkeleton className="w-8 h-8 rounded-lg" />
          <Box className="flex-1">
            <RadixSkeleton className="h-4 w-2/3 mb-1" />
            <RadixSkeleton className="h-3 w-1/2" />
          </Box>
        </Flex>
      ))}
    </Box>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <Box className="space-y-2">
      {/* Header */}
      <Flex gap="4" p="3" className="bg-mission-control-border/50 rounded-lg">
        {Array.from({ length: cols }).map((_, i) => (
          <RadixSkeleton key={i} className="h-4 flex-1" />
        ))}
      </Flex>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <Flex key={i} gap="4" p="3">
          {Array.from({ length: cols }).map((_, j) => (
            <RadixSkeleton key={j} className="h-4 flex-1" />
          ))}
        </Flex>
      ))}
    </Box>
  );
}

export function SkeletonMessage({ className = '' }: SkeletonProps) {
  return (
    <Flex gap="3" className={className}>
      <RadixSkeleton className="w-8 h-8 rounded-full flex-shrink-0" />
      <Box className="flex-1">
        <RadixSkeleton className="h-4 w-24 mb-2" />
        <Box p="3" className="bg-mission-control-surface rounded-lg">
          <SkeletonText lines={2} />
        </Box>
      </Box>
    </Flex>
  );
}

export function SkeletonInbox() {
  return (
    <Box className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <Box key={i} p="4" className="bg-mission-control-surface border border-mission-control-border rounded-lg">
          <Flex align="start" gap="3">
            <RadixSkeleton className="w-10 h-10 rounded-lg" />
            <Box className="flex-1">
              <Flex justify="between" mb="2">
                <RadixSkeleton className="h-5 w-1/3" />
                <RadixSkeleton className="h-4 w-16" />
              </Flex>
              <SkeletonText lines={2} />
              <Flex gap="2" mt="3">
                <RadixSkeleton className="h-8 w-20 rounded-lg" />
                <RadixSkeleton className="h-8 w-20 rounded-lg" />
              </Flex>
            </Box>
          </Flex>
        </Box>
      ))}
    </Box>
  );
}
