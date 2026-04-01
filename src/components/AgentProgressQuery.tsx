/**
 * AgentProgressQuery - Button to query active agent for progress report
 */

import { useState, useEffect } from 'react';
import { BarChart3, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Button, Flex } from '@radix-ui/themes';
import { showToast } from './Toast';
import { gateway } from '@/lib/gateway';
import { chatApi } from '@/lib/api';

interface AgentProgressQueryProps {
  taskId: string;
  taskTitle: string;
  className?: string;
}

/** Returns a human-friendly relative time string */
function relativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 10) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function AgentProgressQuery({ taskId, taskTitle, className = '' }: AgentProgressQueryProps) {
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasActiveAgent, setHasActiveAgent] = useState(false);
  const [sessionKey, setSessionKey] = useState<string | null>(null);
  const [lastQueriedAt, setLastQueriedAt] = useState<number | null>(null);

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
            setSessionKey((activeSession.sessionKey || activeSession.key) as string | null);
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
    const interval = setInterval(checkAgent, 30000); // 30s (was 10s — too aggressive)
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
      try {
        const messages = await chatApi.getMessages(sessionKey);
        const msgList = Array.isArray(messages) ? messages : [];
        if (msgList.length > 0) {
          const lastMessage = msgList[msgList.length - 1];
          if (lastMessage.role === 'assistant') {
            setResponse(lastMessage.content);
            setLastQueriedAt(Date.now());
            showToast('success', 'Progress received', 'Agent responded with status update');
          } else {
            setError('Agent did not respond yet. Check Sessions panel for response.');
          }
        } else {
          setError('Could not fetch agent response. Check Sessions panel.');
        }
      } catch {
        setError('Could not fetch agent response. Check Sessions panel.');
      }
    } catch (err: unknown) {
      // 'Failed to query agent:', err;
      const errMsg = err instanceof Error ? err.message : 'Failed to query agent';
      setError(errMsg);
      showToast('error', 'Query failed', errMsg);
    } finally {
      setLoading(false);
    }
  };

  if (!hasActiveAgent) {
    return null; // Only show when agent is actively working
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Query button + last queried timestamp */}
      <Flex align="center" gap="3">
        <Button
          onClick={handleQuery}
          disabled={loading}
          size="2"
          variant="soft"
          color="purple"
        >
          {loading ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              Querying agent...
            </>
          ) : (
            <>
              <BarChart3 size={15} />
              Get Progress Report
            </>
          )}
        </Button>

        {lastQueriedAt && (
          <span className="text-[10px] text-mission-control-text-dim">
            Last queried {relativeTime(lastQueriedAt)}
          </span>
        )}
      </Flex>

      {/* Response display */}
      {response && (
        <div className="bg-info/8 border border-info/20 rounded-xl px-4 py-3">
          <Flex align="start" gap="2" className="mb-2">
            <CheckCircle size={14} className="text-info mt-0.5 flex-shrink-0" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-info">
              Agent Progress Report
            </span>
          </Flex>
          <div className="text-sm text-mission-control-text whitespace-pre-wrap pl-5 leading-relaxed">
            {response}
          </div>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="bg-error/8 border border-error/20 rounded-xl px-4 py-3">
          <Flex align="start" gap="2">
            <XCircle size={14} className="text-error mt-0.5 flex-shrink-0" />
            <span className="text-xs text-error">{error}</span>
          </Flex>
        </div>
      )}
    </div>
  );
}
