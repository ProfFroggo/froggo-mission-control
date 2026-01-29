/**
 * ActiveAgentIndicator - Shows a pulsing green dot when an agent is actively working on a task
 */

import { useEffect, useState } from 'react';

interface ActiveAgentIndicatorProps {
  taskId: string;
  className?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export default function ActiveAgentIndicator({ 
  taskId, 
  className = '', 
  showLabel = false,
  size = 'md'
}: ActiveAgentIndicatorProps) {
  const [isActive, setIsActive] = useState(false);
  const [agentName, setAgentName] = useState<string | null>(null);

  useEffect(() => {
    const checkActiveAgent = async () => {
      try {
        const result = await (window as any).clawdbot.sessions.list();
        if (result.success && result.sessions) {
          // Find session with label matching task ID and recent activity
          const activeSession = result.sessions.find((s: any) => {
            const isRecent = (Date.now() - s.updatedAt) < 5 * 60 * 1000; // Active within 5 mins
            const matchesTask = s.label && (
              s.label.includes(taskId) || 
              s.label.includes(`task-${taskId}`)
            );
            return isRecent && matchesTask;
          });
          
          if (activeSession) {
            setIsActive(true);
            // Extract agent name from label (e.g., "coder-task-123" -> "coder")
            const labelParts = activeSession.label?.split('-') || [];
            const agentId = labelParts[0];
            setAgentName(agentId || 'agent');
          } else {
            setIsActive(false);
            setAgentName(null);
          }
        }
      } catch (err) {
        console.error('Failed to check active agent:', err);
        setIsActive(false);
      }
    };

    // Check immediately
    checkActiveAgent();
    
    // Poll every 10 seconds
    const interval = setInterval(checkActiveAgent, 10000);
    
    return () => clearInterval(interval);
  }, [taskId]);

  if (!isActive) return null;

  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3'
  };

  const dotSize = sizeClasses[size];

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <div className="relative flex items-center justify-center">
        {/* Pulsing outer ring */}
        <div className={`absolute ${dotSize} bg-green-500/30 rounded-full animate-ping`} />
        {/* Solid inner dot */}
        <div className={`relative ${dotSize} bg-green-500 rounded-full`} />
      </div>
      
      {showLabel && agentName && (
        <span className="text-xs text-green-400 font-medium">
          {agentName} working
        </span>
      )}
    </div>
  );
}
