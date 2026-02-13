import { useState, useEffect } from 'react';
import { Shield, CheckCircle, AlertTriangle, XCircle, Loader } from 'lucide-react';

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
    const interval = setInterval(loadSystemStatus, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadSystemStatus = async () => {
    try {
      const result = await (window as any).clawdbot.system.status();
      
      if (result.success && result.status) {
        setStatus(result.status);
        setError(null);
      } else {
        setError(result.error || 'Failed to load status');
      }
      
      setLoading(false);
    } catch (err: any) {
      console.error('Failed to load system status:', err);
      setError(err.message || 'Failed to load');
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
      <div className="p-4 flex flex-col items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-clawd-accent"></div>
        <p className="text-xs text-clawd-text-dim mt-2">Checking...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 flex flex-col items-center justify-center h-full">
        <XCircle size={32} className="text-error mb-2" />
        <p className="text-xs text-clawd-text-dim text-center">{error}</p>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="p-4 flex flex-col items-center justify-center h-full">
        <Shield size={32} className="text-clawd-text-dim/50 mb-2" />
        <p className="text-xs text-clawd-text-dim">No data</p>
      </div>
    );
  }

  return (
    <div className="p-4 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Shield size={16} className={
          health === 'healthy' ? 'text-success' :
          health === 'warning' ? 'text-warning' :
          'text-error'
        } />
        <h3 className="text-sm font-semibold text-clawd-text">System Health</h3>
      </div>

      {/* Main status */}
      <div className="flex-1 flex flex-col justify-center gap-3">
        {/* Health indicator */}
        <div className="flex items-center gap-3">
          <div className={`flex items-center justify-center w-12 h-12 rounded-full ${
            health === 'healthy' ? 'bg-green-500/20' :
            health === 'warning' ? 'bg-yellow-500/20' :
            'bg-red-500/20'
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
            <div className="text-xs text-clawd-text-dim">
              {health === 'healthy' ? 'Everything operating normally' :
               health === 'warning' ? 'Review recommended' :
               'Immediate attention needed'}
            </div>
          </div>
        </div>

        {/* Status details */}
        <div className="space-y-2 pt-2 border-t border-clawd-border">
          {/* Watcher status */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-clawd-text-dim">Task Watcher</span>
            <span className={status.watcherRunning ? 'text-success' : 'text-error'}>
              {status.watcherRunning ? 'Running' : 'Stopped'}
            </span>
          </div>

          {/* Kill switch */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-clawd-text-dim">Safety Lock</span>
            <span className={status.killSwitchOn ? 'text-error' : 'text-success'}>
              {status.killSwitchOn ? 'Engaged' : 'Normal'}
            </span>
          </div>

          {/* Active tasks */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-clawd-text-dim">Active Tasks</span>
            <div className="flex items-center gap-1.5">
              {status.inProgressTasks > 0 && (
                <Loader size={12} className="text-info animate-spin" />
              )}
              <span className={
                status.inProgressTasks === 0 ? 'text-clawd-text-dim' :
                status.inProgressTasks > 10 ? 'text-warning' :
                'text-info'
              }>
                {status.inProgressTasks}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Last updated */}
      <div className="mt-3 pt-3 border-t border-clawd-border text-xs text-clawd-text-dim text-center">
        Auto-refreshing every 30s
      </div>
    </div>
  );
}
