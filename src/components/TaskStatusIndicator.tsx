/**
 * TaskStatusIndicator - Shows real-time visual status of a task's agent
 *
 * 🟢 Active  - Agent is actively working (session active within 5 min)
 * 🟡 Paused  - Agent has a session but idle (5-30 min since last activity)
 * 🔴 Stuck   - Agent blocked/errored (>30 min idle or error state)
 * ⚪ Ready   - Task has agent assigned, ready to spawn (todo status)
 * (nothing)  - No agent assigned or task is done/failed
 */

import { useEffect, useState, memo } from 'react';
import { gateway } from '@/lib/gateway';

export type AgentStatus = 'active' | 'paused' | 'stuck' | 'ready' | 'none';

interface TaskStatusIndicatorProps {
  taskId: string;
  taskStatus: string;
  assignedTo?: string;
  className?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

interface StatusInfo {
  status: AgentStatus;
  agentName: string | null;
  lastActivity: number | null;
}

const STATUS_CONFIG: Record<AgentStatus, { 
  color: string; 
  bgColor: string; 
  pulseColor: string;
  label: string; 
  emoji: string;
  animate: boolean;
}> = {
  active: {
    color: 'bg-green-500',
    bgColor: 'bg-green-500/20',
    pulseColor: 'bg-green-500/30',
    label: 'Working',
    emoji: '🟢',
    animate: true,
  },
  paused: {
    color: 'bg-yellow-500',
    bgColor: 'bg-yellow-500/20',
    pulseColor: 'bg-yellow-500/30',
    label: 'Paused',
    emoji: '🟡',
    animate: false,
  },
  stuck: {
    color: 'bg-red-500',
    bgColor: 'bg-red-500/20',
    pulseColor: 'bg-red-500/30',
    label: 'Stuck',
    emoji: '🔴',
    animate: true,
  },
  ready: {
    color: 'bg-gray-400',
    bgColor: 'bg-gray-400/20',
    pulseColor: 'bg-gray-400/30',
    label: 'Ready',
    emoji: '⚪',
    animate: false,
  },
  none: {
    color: '',
    bgColor: '',
    pulseColor: '',
    label: '',
    emoji: '',
    animate: false,
  },
};

// Shared session cache to avoid redundant API calls across all indicators
let sessionCache: { sessions: any[] | null; timestamp: number } = { sessions: null, timestamp: 0 };
const CACHE_TTL = 8000; // 8 seconds

async function fetchSessions(): Promise<any[]> {
  const now = Date.now();
  if (sessionCache.sessions && (now - sessionCache.timestamp) < CACHE_TTL) {
    return sessionCache.sessions;
  }
  try {
    const result = await gateway.getSessions();
    if (result.sessions) {
      sessionCache = { sessions: result.sessions, timestamp: now };
      return result.sessions;
    }
  } catch (err) {
    console.error('Failed to fetch sessions for status indicator:', err);
  }
  return sessionCache.sessions || [];
}

function determineStatus(
  taskId: string, 
  taskStatus: string, 
  assignedTo: string | undefined,
  sessions: any[]
): StatusInfo {
  // Done/failed tasks don't show indicators
  if (taskStatus === 'done' || taskStatus === 'failed') {
    return { status: 'none', agentName: null, lastActivity: null };
  }

  // Find matching sessions for this task
  const matchingSessions = sessions.filter((s: any) => {
    const label = s.label || '';
    return label.includes(taskId) || label.includes(`task-${taskId}`);
  });

  if (matchingSessions.length > 0) {
    // Sort by most recent activity
    const sorted = matchingSessions.sort((a: any, b: any) => (b.updatedAt || 0) - (a.updatedAt || 0));
    const mostRecent = sorted[0];
    const ageMs = Date.now() - (mostRecent.updatedAt || 0);
    
    // Extract agent name from label
    const labelParts = (mostRecent.label || '').split('-');
    const agentName = labelParts[0] || assignedTo || 'agent';

    if (ageMs < 5 * 60 * 1000) {
      // Active within 5 minutes
      return { status: 'active', agentName, lastActivity: mostRecent.updatedAt };
    } else if (ageMs < 30 * 60 * 1000) {
      // Idle 5-30 minutes
      return { status: 'paused', agentName, lastActivity: mostRecent.updatedAt };
    } else {
      // Idle >30 minutes - stuck
      return { status: 'stuck', agentName, lastActivity: mostRecent.updatedAt };
    }
  }

  // No task-specific session found - check agent's main session
  if (assignedTo) {
    const agentMainSession = sessions.find((s: any) => {
      const key = s.key || s.sessionKey || '';
      return key.includes(`agent:${assignedTo}:main`) || key.includes(`${assignedTo}:main`);
    });
    
    if (agentMainSession) {
      const ageMs = Date.now() - (agentMainSession.updatedAt || 0);
      if (ageMs < 10 * 60 * 1000) {
        // Agent's main session active within 10 min - assume working
        return { status: 'active', agentName: assignedTo, lastActivity: agentMainSession.updatedAt };
      } else if (ageMs < 60 * 60 * 1000) {
        // Agent idle 10-60 min
        return { status: 'paused', agentName: assignedTo, lastActivity: agentMainSession.updatedAt };
      }
    }
  }

  // Ready state for todo with assigned agent
  if (assignedTo && taskStatus === 'todo') {
    return { status: 'ready', agentName: assignedTo, lastActivity: null };
  }

  // In-progress: default to paused (yellow) not stuck (red)
  // Only show stuck if explicitly no agent or agent confirmed idle >1hr
  if (taskStatus === 'in-progress') {
    if (assignedTo) {
      return { status: 'paused', agentName: assignedTo, lastActivity: null };
    }
    // No agent assigned to in-progress task - this IS a problem
    return { status: 'stuck', agentName: null, lastActivity: null };
  }

  return { status: 'none', agentName: null, lastActivity: null };
}

const TaskStatusIndicator = memo(function TaskStatusIndicator({ 
  taskId, 
  taskStatus,
  assignedTo,
  className = '', 
  showLabel = false,
  size = 'md'
}: TaskStatusIndicatorProps) {
  const [statusInfo, setStatusInfo] = useState<StatusInfo>({ status: 'none', agentName: null, lastActivity: null });

  useEffect(() => {
    const check = async () => {
      const sessions = await fetchSessions();
      const info = determineStatus(taskId, taskStatus, assignedTo, sessions);
      setStatusInfo(info);
    };

    check();
    const interval = setInterval(check, 10000);
    return () => clearInterval(interval);
  }, [taskId, taskStatus, assignedTo]);

  if (statusInfo.status === 'none') return null;

  const config = STATUS_CONFIG[statusInfo.status];
  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3'
  };
  const dotSize = sizeClasses[size];

  // Format time since last activity
  const timeAgo = statusInfo.lastActivity 
    ? formatTimeAgo(Date.now() - statusInfo.lastActivity)
    : null;

  const tooltip = [
    config.label,
    statusInfo.agentName ? `(${statusInfo.agentName})` : '',
    timeAgo ? `- ${timeAgo} ago` : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={`flex items-center gap-1.5 ${className}`} title={tooltip}>
      <div className="relative flex items-center justify-center">
        {/* Pulsing outer ring for active/stuck */}
        {config.animate && (
          <div className={`absolute ${dotSize} ${config.pulseColor} rounded-full animate-ping`} />
        )}
        {/* Solid dot */}
        <div className={`relative ${dotSize} ${config.color} rounded-full`} />
      </div>
      
      {showLabel && (
        <span className={`text-xs font-medium ${
          statusInfo.status === 'active' ? 'text-success' :
          statusInfo.status === 'paused' ? 'text-warning' :
          statusInfo.status === 'stuck' ? 'text-error' :
          'text-clawd-text-dim'
        }`}>
          {config.label}
          {statusInfo.agentName ? ` · ${statusInfo.agentName}` : ''}
        </span>
      )}
    </div>
  );
});

function formatTimeAgo(ms: number): string {
  if (ms < 60000) return `${Math.floor(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m`;
  if (ms < 86400000) return `${Math.floor(ms / 3600000)}h`;
  return `${Math.floor(ms / 86400000)}d`;
}

export default TaskStatusIndicator;
