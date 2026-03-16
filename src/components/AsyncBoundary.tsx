// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// src/components/AsyncBoundary.tsx
// Combines React Suspense + ErrorBoundary into a single composable wrapper.

import { Suspense, type ReactNode } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { PanelSkeleton } from './PanelSkeleton';

interface AsyncBoundaryProps {
  children: ReactNode;
  /** Fallback shown while the child suspends (defaults to PanelSkeleton) */
  fallback?: ReactNode;
  /** Fallback shown when the ErrorBoundary catches a render error */
  errorFallback?: ReactNode;
  /** Human-readable name used in error boundary reporting */
  componentName?: string;
}

/**
 * AsyncBoundary wraps children in both an ErrorBoundary (for render errors)
 * and a Suspense boundary (for lazy/async components).
 *
 * Use this instead of raw <Suspense> wherever a panel or widget can both
 * suspend and throw — so a single wrapper handles both failure modes.
 *
 * @example
 *   <AsyncBoundary componentName="KanbanBoard">
 *     <KanbanBoard />
 *   </AsyncBoundary>
 */
export function AsyncBoundary({
  children,
  fallback,
  errorFallback,
  componentName,
}: AsyncBoundaryProps) {
  return (
    <ErrorBoundary
      componentName={componentName}
      fallback={errorFallback}
    >
      <Suspense fallback={fallback ?? <PanelSkeleton />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}

export default AsyncBoundary;
