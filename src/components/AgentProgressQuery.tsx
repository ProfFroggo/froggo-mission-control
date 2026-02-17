/**
 * AgentProgressQuery - Button to query active agent for progress report
 */

import { useState, useEffect } from 'react';
import { MessageSquare, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { showToast } from './Toast';
import { gateway } from '@/lib/gateway';

interface AgentProgressQueryProps {
  taskId: string;
  taskTitle: string;
  className?: string;
}

export default function AgentProgressQuery({ taskId, taskTitle, className = '' }: AgentProgressQueryProps) {
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasActiveAgent, setHasActiveAgent] = useState(false);
  const [sessionKey, setSessionKey] = useState<string | null>(null);

  // Check for active agent on mount and periodically
  useEffect(() => {
    const checkAgent = async () => {
      try {
        const result = await gateway.getSessions();
        if (result.sessions) {
          const activeSession = result.sessions.find((s: any) => {
            const isRecent = (Date.now() - s.updatedAt) < 5 * 60 * 1000;
            const matchesTask = s.label && (
              s.label.includes(taskId) ||
              s.label.includes(`task-${taskId}`)
            );
            return isRecent && matchesTask;
          });

          if (activeSession) {
            setHasActiveAgent(true);
            // Gateway returns sessionKey, map to key for component compatibility
            setSessionKey(activeSession.sessionKey || activeSession.key);
          } else {
            setHasActiveAgent(false);
            setSessionKey(null);
          }
        }
      } catch (err) {
        // 'Failed to check active agent:', err;
      }
    };

    checkAgent();
    const interval = setInterval(checkAgent, 10000);
    return () => clearInterval(interval);
  }, [taskId]);

  const handleQuery = async () => {
    if (!sessionKey) {
      showToast('error', 'No active agent', 'No agent is currently working on this task');
      return;
    }

    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      // Send progress query to agent session
      const message = `Please provide a brief progress update on task: ${taskTitle}\n\nWhat have you completed so far? What are you currently working on? Any blockers?`;

      await gateway.sendToSession(sessionKey, message);

      // Wait a moment for agent to process and respond
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Fetch recent chat messages to get agent's response
      const chatResult = await window.clawdbot?.chat?.recent?.(sessionKey, 1);

      if (chatResult?.success && chatResult.messages && chatResult.messages.length > 0) {
        const lastMessage = chatResult.messages[0];
        if (lastMessage.role === 'assistant') {
          setResponse(lastMessage.content);
          showToast('success', 'Progress received', 'Agent responded with status update');
        } else {
          setError('Agent did not respond yet. Check Sessions panel for response.');
        }
      } else {
        setError('Could not fetch agent response. Check Sessions panel.');
      }
    } catch (err: unknown) {
      // 'Failed to query agent:', err;
      setError(err.message || 'Failed to query agent');
      showToast('error', 'Query failed', err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  if (!hasActiveAgent) {
    return null; // Only show when agent is actively working
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <button
        onClick={handleQuery}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 bg-review-subtle hover:bg-review-subtle 
                   text-review border border-review-border rounded-lg transition-all
                   disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
      >
        {loading ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            <span>Querying agent...</span>
          </>
        ) : (
          <>
            <MessageSquare size={16} />
            <span>Get Progress Report</span>
          </>
        )}
      </button>

      {/* Response display */}
      {response && (
        <div className="bg-success-subtle border border-success-border rounded-lg p-4">
          <div className="flex items-start gap-2 mb-2">
            <CheckCircle size={16} className="text-success mt-0.5 flex-shrink-0" />
            <div className="text-xs font-semibold text-success">Agent Progress Report</div>
          </div>
          <div className="text-sm text-clawd-text-dim whitespace-pre-wrap ml-6">
            {response}
          </div>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="bg-error-subtle border border-error-border rounded-lg p-4">
          <div className="flex items-start gap-2">
            <XCircle size={16} className="text-error mt-0.5 flex-shrink-0" />
            <div className="text-xs text-error">{error}</div>
          </div>
        </div>
      )}
    </div>
  );
}
