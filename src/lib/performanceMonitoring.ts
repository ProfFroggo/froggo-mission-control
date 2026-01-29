/**
 * Performance Monitoring
 * Tracks component render times and identifies slow renders
 */

export interface PerformanceMetric {
  component: string;
  phase: 'mount' | 'update';
  renderTime: number;
  timestamp: number;
}

export interface PerformanceStats {
  component: string;
  totalRenders: number;
  avgRenderTime: number;
  maxRenderTime: number;
  slowRenders: number; // > 16ms threshold
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private readonly MAX_METRICS = 500; // Keep last 500 renders
  private readonly SLOW_THRESHOLD = 16; // 16ms = 60fps

  /**
   * Log a component render
   */
  logRender(component: string, phase: 'mount' | 'update', renderTime: number) {
    this.metrics.push({
      component,
      phase,
      renderTime,
      timestamp: Date.now()
    });

    // Keep metrics limited
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics.shift();
    }

    // Warn on very slow renders
    if (renderTime > 50) {
      console.warn(`[Perf] Slow render detected: ${component} (${phase}) took ${renderTime.toFixed(2)}ms`);
    }
  }

  /**
   * Get all slow renders (> threshold)
   */
  getSlowRenders(threshold = this.SLOW_THRESHOLD): PerformanceMetric[] {
    return this.metrics.filter(m => m.renderTime > threshold);
  }

  /**
   * Get stats for a specific component
   */
  getComponentStats(component: string): PerformanceStats | null {
    const componentMetrics = this.metrics.filter(m => m.component === component);
    if (componentMetrics.length === 0) return null;

    const totalRenderTime = componentMetrics.reduce((sum, m) => sum + m.renderTime, 0);
    const maxRenderTime = Math.max(...componentMetrics.map(m => m.renderTime));
    const slowRenders = componentMetrics.filter(m => m.renderTime > this.SLOW_THRESHOLD).length;

    return {
      component,
      totalRenders: componentMetrics.length,
      avgRenderTime: totalRenderTime / componentMetrics.length,
      maxRenderTime,
      slowRenders
    };
  }

  /**
   * Get stats for all components
   */
  getAllStats(): PerformanceStats[] {
    const componentNames = [...new Set(this.metrics.map(m => m.component))];
    return componentNames
      .map(name => this.getComponentStats(name))
      .filter((stats): stats is PerformanceStats => stats !== null)
      .sort((a, b) => b.avgRenderTime - a.avgRenderTime);
  }

  /**
   * Clear all metrics
   */
  clear() {
    this.metrics = [];
  }

  /**
   * Export metrics as JSON
   */
  export(): PerformanceMetric[] {
    return [...this.metrics];
  }

  /**
   * Get summary report
   */
  getSummary(): string {
    const stats = this.getAllStats();
    if (stats.length === 0) return 'No performance data collected';

    let report = '📊 Performance Summary\n\n';
    report += `Total components tracked: ${stats.length}\n`;
    report += `Total renders: ${this.metrics.length}\n\n`;

    report += 'Top 10 slowest components:\n';
    stats.slice(0, 10).forEach((stat, i) => {
      report += `${i + 1}. ${stat.component}: ${stat.avgRenderTime.toFixed(2)}ms avg (${stat.totalRenders} renders, ${stat.slowRenders} slow)\n`;
    });

    const totalSlowRenders = this.getSlowRenders().length;
    const slowPercentage = ((totalSlowRenders / this.metrics.length) * 100).toFixed(1);
    report += `\n⚠️  Slow renders (>16ms): ${totalSlowRenders} (${slowPercentage}%)\n`;

    return report;
  }
}

// Singleton instance
export const perfMonitor = new PerformanceMonitor();

// Expose to window for debugging
if (typeof window !== 'undefined') {
  (window as any).perfMonitor = perfMonitor;
}
