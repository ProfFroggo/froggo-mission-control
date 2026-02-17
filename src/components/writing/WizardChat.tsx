import { useRef, useEffect, useCallback } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { gateway } from '../../lib/gateway';
import {
  buildConversationPrompt,
  buildExtractionPrompt,
  getWizardAgent,
  parseWizardPlan,
} from '../../lib/wizardPrompts';
import { useWizardStore, type ChatMessage as ChatMessageType } from '../../store/wizardStore';
import ChatMessage from './ChatMessage';

const bridge = () => window.clawdbot?.writing?.wizard;

export default function WizardChat() {
  const {
    step,
    sessionId,
    messages,
    streaming,
    streamContent,
    selectedAgent,
    brainDump,
    extractionError,
    setStreaming,
    setStreamContent,
    addMessage,
    setError,
    setPlan,
    setStep,
    setExtractionError,
  } = useWizardStore();

  const scrollRef = useRef<HTMLDivElement>(null);
  const accumulatedRef = useRef('');
  const extractingRef = useRef(false);
  const autoSentRef = useRef(false);

  // Auto-scroll on new messages or stream updates
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, streamContent]);

  // Persist wizard state to disk
  const persistState = useCallback(async () => {
    if (!sessionId) return;
    const state = useWizardStore.getState();
    try {
      await bridge()?.save(sessionId, {
        step: state.step,
        sessionId: state.sessionId,
        messages: state.messages,
        selectedAgent: state.selectedAgent,
        brainDump: state.brainDump,
        plan: state.plan,
      });
    } catch {
      // Session persist failure is non-blocking
    }
  }, [sessionId]);

  const handleSend = useCallback(
    async (text: string) => {
      if (!sessionId || streaming) return;

      const agent = getWizardAgent(selectedAgent);

      // Create user message
      const userMsg: ChatMessageType = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        role: 'user',
        content: text,
        agent: agent.id,
        timestamp: Date.now(),
      };

      const currentMessages = useWizardStore.getState().messages;
      addMessage(userMsg);
      setStreaming(true);
      setStreamContent('');
      setError(null);
      accumulatedRef.current = '';

      // Session key for conversation
      const sessionKey = `agent:${agent.id}:writing:wizard:${sessionId}`;

      // For the first message, prepend the conversation system prompt
      const isFirstMessage = currentMessages.length === 0;
      const fullMessage = isFirstMessage
        ? buildConversationPrompt(selectedAgent, brainDump) + '\n\n## User Message\n' + text
        : text;

      try {
        await gateway.sendChatWithCallbacks(fullMessage, sessionKey, {
          onDelta: (delta) => {
            accumulatedRef.current += delta;
            setStreamContent(accumulatedRef.current);
          },
          onEnd: () => {
            const assistantMsg: ChatMessageType = {
              id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              role: 'assistant',
              content: accumulatedRef.current,
              agent: agent.id,
              timestamp: Date.now(),
            };
            addMessage(assistantMsg);
            setStreaming(false);
            setStreamContent('');
            accumulatedRef.current = '';
            // Persist after each turn
            persistState();
          },
          onError: (err) => {
            setError(typeof err === 'string' ? err : 'An error occurred');
            setStreaming(false);
            setStreamContent('');
          },
        });
      } catch (e: unknown) {
        setError(e.message || 'Failed to send');
        setStreaming(false);
        setStreamContent('');
      }
    },
    [sessionId, streaming, selectedAgent, brainDump, addMessage, setStreaming, setStreamContent, setError, persistState],
  );

  // -- Extraction handler --
  const handleExtract = useCallback(async () => {
    if (!sessionId || extractingRef.current) return;
    extractingRef.current = true;

    const agent = getWizardAgent(selectedAgent);
    const currentMessages = useWizardStore.getState().messages;

    // Build a summary from conversation messages (limit ~4000 chars, focus on decisions)
    let summary = '';
    for (const msg of currentMessages) {
      const prefix = msg.role === 'user' ? 'User: ' : 'Assistant: ';
      summary += prefix + msg.content + '\n\n';
      if (summary.length > 4000) {
        summary = summary.slice(-4000);
        break;
      }
    }

    // Separate session key for extraction
    const extractSessionKey = `agent:${agent.id}:writing:wizard-extract:${sessionId}`;
    let extractAccumulated = '';

    try {
      await gateway.sendChatWithCallbacks(
        buildExtractionPrompt(summary),
        extractSessionKey,
        {
          onDelta: (delta) => {
            extractAccumulated += delta;
          },
          onEnd: () => {
            const result = parseWizardPlan(extractAccumulated);
            if (result) {
              setPlan(result);
              setStep('review');
            } else {
              setExtractionError('Failed to parse the generated plan. Try adding more details to the conversation, then try again.');
              setStep('conversation');
            }
            extractingRef.current = false;
            persistState();
          },
          onError: (err) => {
            const msg = typeof err === 'string' ? err : 'Extraction failed';
            setExtractionError(msg);
            setStep('conversation');
            extractingRef.current = false;
          },
        },
      );
    } catch (e: unknown) {
      setExtractionError(e.message || 'Extraction request failed');
      setStep('conversation');
      extractingRef.current = false;
    }
  }, [sessionId, selectedAgent, setPlan, setStep, setExtractionError, persistState]);

  // Trigger extraction when step changes to 'extracting'
  useEffect(() => {
    if (step === 'extracting') {
      handleExtract();
    }
  }, [step, handleExtract]);

  // Auto-send brain dump as first message when entering conversation
  useEffect(() => {
    if (step === 'conversation' && messages.length === 0 && brainDump.trim() && !autoSentRef.current) {
      autoSentRef.current = true;
      handleSend(brainDump.trim());
    }
  }, [step, messages.length, brainDump, handleSend]);

  // Handle keyboard submit
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const target = e.target as HTMLTextAreaElement;
      const text = target.value.trim();
      if (text && !streaming && step !== 'extracting') {
        target.value = '';
        handleSend(text);
      }
    }
  };

  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSendClick = () => {
    const text = inputRef.current?.value.trim();
    if (text && !streaming && step !== 'extracting') {
      if (inputRef.current) inputRef.current.value = '';
      handleSend(text);
    }
  };

  return (
    <div className="flex flex-col h-full bg-clawd-surface">
      {/* Extraction error banner */}
      {extractionError && (
        <div className="px-4 py-2 bg-error-subtle border-b border-error-border flex items-center gap-2">
          <AlertCircle size={14} className="text-error flex-shrink-0" />
          <span className="text-xs text-error">{extractionError}</span>
          <button
            onClick={() => setExtractionError(null)}
            className="ml-auto text-xs text-error/60 hover:text-error"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Extraction overlay */}
      {step === 'extracting' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-clawd-bg/80 backdrop-blur-sm">
          <div className="text-center p-6">
            <Loader2 size={28} className="mx-auto text-clawd-accent animate-spin mb-3" />
            <p className="text-sm text-clawd-text font-medium">Generating your book plan...</p>
            <p className="text-xs text-clawd-text-dim mt-1">Extracting structure from the conversation</p>
          </div>
        </div>
      )}

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-3 py-3 relative">
        {messages.length === 0 && !streaming ? (
          <div className="flex items-center justify-center h-full text-clawd-text-dim text-sm text-center px-4">
            <p>Starting conversation about your book idea...</p>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}
            {streaming && (
              <ChatMessage
                message={{
                  id: 'streaming',
                  role: 'assistant',
                  content: '',
                  agent: getWizardAgent(selectedAgent).id,
                  timestamp: Date.now(),
                }}
                isStreaming
                streamContent={streamContent}
              />
            )}
          </>
        )}
        {/* Scroll sentinel */}
        <div ref={scrollRef} />
      </div>

      {/* Simple input (no agent picker -- agent is already chosen) */}
      <div className="bg-clawd-surface border-t border-clawd-border p-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            onKeyDown={handleKeyDown}
            placeholder={step === 'extracting' ? 'Generating plan...' : 'Continue the conversation...'}
            rows={1}
            disabled={streaming || step === 'extracting'}
            className="flex-1 bg-clawd-surface border border-clawd-border rounded-xl px-4 py-3 text-sm text-clawd-text placeholder:text-clawd-text-dim focus:outline-none focus:border-clawd-accent resize-none transition-colors disabled:opacity-50"
          />
          <button
            onClick={handleSendClick}
            disabled={streaming || step === 'extracting'}
            className="p-3 bg-clawd-accent text-white rounded-xl hover:opacity-90 transition-all disabled:opacity-50"
            title="Send message"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
