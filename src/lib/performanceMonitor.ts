/**
 * Performance Monitor
 * 
 * Tracks render performance and logs slow renders
 */

import { createLogger } from '../utils/logger';

const logger = createLogger('PerformanceMonitor');

interface RenderMetrics {
  componentName: string;
  phase: 'mount' | 'update' | 'nested-update';
  actualDuration: number;
  baseDuration: number;
  startTime: number;
  commitTime: number;
}

interface PerformanceStats {
  totalRenders: number;
  slowRenders: number;
  averageDuration: number;
  maxDuration: number;
  componentStats: Map<string, {
    renders: number;
    totalDuration: number;
    maxDuration: number;
    slowRenders: number;
  }>;
}

const SLOW_RENDER_THRESHOLD = 16; // ms (60 FPS target)
const stats: PerformanceStats = {
  totalRenders: 0,
  slowRenders: 0,
  averageDuration: 0,
  maxDuration: 0,
  componentStats: new Map(),
};

/**
 * Log a render event
 * Used with React Profiler API
 */
export function logRender(
  id: string,
  phase: 'mount' | 'update' | 'nested-update',
  actualDuration: number,
  baseDuration: number,
  startTime: number,
  commitTime: number
) {
  const metrics: RenderMetrics = {
    componentName: id,
    phase,
    actualDuration,
    baseDuration,
    startTime,
    commitTime,
  };

  // Update global stats
  stats.totalRenders++;
  stats.averageDuration = 
    (stats.averageDuration * (stats.totalRenders - 1) + actualDuration) / stats.totalRenders;
  stats.maxDuration = Math.max(stats.maxDuration, actualDuration);

  // Update component stats
  const componentStat = stats.componentStats.get(id) || {
    renders: 0,
    totalDuration: 0,
    maxDuration: 0,
    slowRenders: 0,
  };
  
  componentStat.renders++;
  componentStat.totalDuration += actualDuration;
  componentStat.maxDuration = Math.max(componentStat.maxDuration, actualDuration);
  
  // Log slow renders
  if (actualDuration > SLOW_RENDER_THRESHOLD) {
    stats.slowRenders++;
    componentStat.slowRenders++;
    logger.debug(
      `Slow render detected: ${id} took ${actualDuration.toFixed(2)}ms (${phase})`,
      { metrics }
    );
  }

  stats.componentStats.set(id, componentStat);
}

/**
 * Get performance statistics
 */
export function getPerformanceStats(): PerformanceStats {
  return {
    ...stats,
    componentStats: new Map(stats.componentStats),
  };
}

/**
 * Get top slowest components
 */
export function getSlowestComponents(limit = 10) {
  return Array.from(stats.componentStats.entries())
    .map(([name, stat]) => ({
      name,
      renders: stat.renders,
      avgDuration: stat.totalDuration / stat.renders,
      maxDuration: stat.maxDuration,
      slowRenders: stat.slowRenders,
    }))
    .sort((a, b) => b.avgDuration - a.avgDuration)
    .slice(0, limit);
}

/**
 * Reset statistics
 */
export function resetStats() {
  stats.totalRenders = 0;
  stats.slowRenders = 0;
  stats.averageDuration = 0;
  stats.maxDuration = 0;
  stats.componentStats.clear();
}

/**
 * Print performance report to console
 */
export function printPerformanceReport() {
  logger.debug('Performance Report');
  logger.debug('Slow renders:', stats.slowRenders, `(${((stats.slowRenders / stats.totalRenders) * 100).toFixed(1)}%)`);
  logger.debug('Average duration:', stats.averageDuration.toFixed(2), 'ms');
  logger.debug('Max duration:', stats.maxDuration.toFixed(2), 'ms');
  // Table logging - convert to array for structured logging
  const slowest = getSlowestComponents(10);
  logger.debug('Slowest components:', slowest);
}

// Expose to window for debugging
if (typeof window !== 'undefined') {
  (window as any).__performanceMonitor = {
    getStats: getPerformanceStats,
    getSlowest: getSlowestComponents,
    reset: resetStats,
    report: printPerformanceReport,
  };
}
