import { useState, useEffect } from 'react';
import { Shield, CheckCircle, AlertTriangle, XCircle, Loader } from 'lucide-react';
import { Flex } from '@radix-ui/themes';
import WidgetLoading from './WidgetLoading';

interface SystemStatus {
  watcherRunning: boolean;
  killSwitchOn: boolean;
  inProgressTasks: number;
  blockedTasks?: number;
  totalTasks?: number;
}

export default function HealthStatusWidget() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSystemStatus();
    const interval = setInterval(loadSystemStatus, 60000); // Refresh every 60 seconds
    return () => clearInterval(interval);
  }, []);

  const loadSystemStatus = async () => {
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        const s: SystemStatus = {
          watcherRunning: data?.watcherRunning ?? true,
          killSwitchOn: data?.killSwitchOn ?? false,
          inProgressTasks: data?.inProgressTasks ?? 0,
          blockedTasks: data?.blockedTasks,
          totalTasks: data?.totalTasks,
        };
        setStatus(s);
        setError(null);
      } else {
        setError('Failed to load status');
      }

      setLoading(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load');
      setLoading(false);
    }
  };

  const getHealthStatus = (): 'healthy' | 'warning' | 'critical' => {
    if (!status) return 'warning';
    
    // Critical: kill switch is on
    if (status.killSwitchOn) return 'critical';
    
    // Warning: watcher not running or high task load
    if (!status.watcherRunning) return 'warning';
    if (status.inProgressTasks > 10) return 'warning';
    
    // Healthy: everything OK
    return 'healthy';
  };

  const health = getHealthStatus();

  if (loading) {
    return (
      <WidgetLoading 
        variant="spinner" 
        title="Checking system status..." 
        compact 
      />
    );
  }

  if (error) {
    return (
      <div className="p-4 flex flex-col items-center justify-center h-full">
        <XCircle size={32} className="text-error mb-2" />
        <p className="text-xs text-mission-control-text-dim text-center">{error}</p>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="p-4 flex flex-col items-center justify-center h-full">
        <Shield size={32} className="text-mission-control-text-dim/50 mb-2" />
        <p className="text-xs text-mission-control-text-dim">No data</p>
      </div>
    );
  }

  return (
    <div className="p-4 h-full flex flex-col">
      {/* Header */}
      <Flex align="center" gap="2" className="mb-3">
        <Shield size={16} className={
          health === 'healthy' ? 'text-success' :
          health === 'warning' ? 'text-warning' :
          'text-error'
        } />
        <h3 className="text-sm font-semibold text-mission-control-text">System Health</h3>
      </Flex>

      {/* Main status */}
      <div className="flex-1 flex flex-col justify-center gap-3">
        {/* Health indicator */}
        <Flex align="center" gap="3">
          <div className={`flex items-center justify-center w-12 h-12 rounded-full ${
            health === 'healthy' ? 'bg-success/10' :
            health === 'warning' ? 'bg-warning/10' :
            'bg-error/10'
          }`}>
            {health === 'healthy' ? (
              <CheckCircle size={24} className="text-success" />
            ) : health === 'warning' ? (
              <AlertTriangle size={24} className="text-warning" />
            ) : (
              <XCircle size={24} className="text-error" />
            )}
          </div>
          
          <div className="flex-1">
            <div className={`text-lg font-bold ${
              health === 'healthy' ? 'text-success' :
              health === 'warning' ? 'text-warning' :
              'text-error'
            }`}>
              {health === 'healthy' ? 'All Systems Go' :
               health === 'warning' ? 'Minor Issues' :
               'Critical Alert'}
            </div>
            <div className="text-xs text-mission-control-text-dim">
              {health === 'healthy' ? 'Everything operating normally' :
               health === 'warning' ? 'Review recommended' :
               'Immediate attention needed'}
            </div>
          </div>
        </Flex>

        {/* Status details */}
        <div className="space-y-2 pt-2 border-t border-mission-control-border">
          {/* Watcher status */}
          <Flex align="center" justify="between" className="text-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim">Task Processing</span>
            <span className={`text-xs font-medium ${status.watcherRunning ? 'text-success' : 'text-error'}`}>
              {status.watcherRunning ? 'Running' : 'Stopped'}
            </span>
          </Flex>

          {/* Kill switch */}
          <Flex align="center" justify="between" className="text-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim">Safety Controls</span>
            <span className={`text-xs font-medium ${status.killSwitchOn ? 'text-error' : 'text-success'}`}>
              {status.killSwitchOn ? 'Engaged' : 'Normal'}
            </span>
          </Flex>

          {/* Active tasks */}
          <Flex align="center" justify="between" className="text-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim">Active Tasks</span>
            <div className="flex items-center gap-1.5">
              {status.inProgressTasks > 0 && (
                <Loader size={12} className="text-info animate-spin" />
              )}
              <span className={`tabular-nums font-mono text-xs font-medium ${
                status.inProgressTasks === 0 ? 'text-mission-control-text-dim' :
                status.inProgressTasks > 10 ? 'text-warning' :
                'text-info'
              }`}>
                {status.inProgressTasks}
              </span>
            </div>
          </Flex>
        </div>
      </div>

      {/* Last updated */}
      <div className="mt-3 pt-3 border-t border-mission-control-border text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim/70 text-center">
        Auto-refreshes every 60s
      </div>
    </div>
  );
}
