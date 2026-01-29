/**
 * Performance Profiler Wrapper
 * 
 * Wraps components with React Profiler to track render performance
 */

import { Profiler, ReactNode } from 'react';
import { logRender } from '../lib/performanceMonitor';

interface PerformanceProfilerProps {
  id: string;
  children: ReactNode;
}

export default function PerformanceProfiler({ id, children }: PerformanceProfilerProps) {
  return (
    <Profiler id={id} onRender={logRender}>
      {children}
    </Profiler>
  );
}
