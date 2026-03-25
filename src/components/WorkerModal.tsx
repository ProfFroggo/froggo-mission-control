/* eslint-disable react-hooks/exhaustive-deps */
// LEGACY: WorkerModal uses file-level suppression for intentional stable ref patterns.
// The suppressions are legitimate because:
// - resetForm sets multiple state fields atomically
// - Chat-related effects depend on stable callback patterns
// - Modal lifecycle effects are carefully designed
// Review: 2026-02-17 - suppression retained, fixed ESC handler dep

import { useState, useEffect, useRef } from 'react';
import { X, Bot, MessageSquare, Edit3, Send, Sparkles, Zap, CheckCircle } from 'lucide-react';
import { Button, Flex, IconButton, Spinner, TextArea, TextField } from '@radix-ui/themes';
import { gateway } from '../lib/gateway';
import { useStore } from '../store/store';
import { showToast } from './Toast';

interface WorkerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ModalMode = 'chat' | 'manual';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface ExtractedWorkerData {
  name?: string;
  role?: string;
  taskDescription?: string;
  capabilities?: string[];
  model?: 'sonnet' | 'opus';
  instructions?: string;
}

const MODEL_OPTIONS = [
  { id: 'sonnet', label: 'Claude Sonnet 4.5', description: 'Fast & capable - good for most tasks' },
  { id: 'opus', label: 'Claude Opus 4', description: 'Most powerful - complex reasoning' },
];

export default function WorkerModal({ isOpen, onClose }: WorkerModalProps) {
  const { createWorkerAgent, addActivity } = useStore();

  // Animation state
  const [isClosing, setIsClosing] = useState(false);

  // Mode selection
  const [mode, setMode] = useState<ModalMode>('chat');

  // Manual form state
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [capabilities, setCapabilities] = useState('');
  const [model, setModel] = useState<'sonnet' | 'opus'>('sonnet');

  // Chat mode state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [extractedData, setExtractedData] = useState<ExtractedWorkerData>({});
  const [conversationComplete, setConversationComplete] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  const handleClose = () => {
    setIsClosing(true);
    closeTimeoutRef.current = setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 200);
  };

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      resetForm();

      // Start chat with greeting if in chat mode
      if (mode === 'chat') {
        setChatMessages([
          {
            id: `msg-${Date.now()}`,
            role: 'assistant',
            content:
              "Hey! Let's create a new worker agent together. Tell me what you need this agent to do, and I'll help you design it. What's the task?",
            timestamp: Date.now(),
          },
        ]);
      }
    }
  }, [isOpen, mode]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, streamingContent]);

  // Focus input when mode switches
  useEffect(() => {
    if (isOpen && mode === 'chat' && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, mode]);

  // ESC key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !taskDescription.trim()) return;

    await createWorker({
      name: name.trim(),
      role: role.trim() || name.trim(),
      taskDescription: taskDescription.trim(),
      capabilities: capabilities
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean),
      model,
    });

    resetForm();
    handleClose();
  };

  const handleChatSubmit = async () => {
    if (!chatInput.trim() || isStreaming) return;

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: chatInput.trim(),
      timestamp: Date.now(),
    };

    setChatMessages((prev) => [...prev, userMessage]);
    setChatInput('');
    setIsStreaming(true);
    setStreamingContent('');

    try {
      const conversationHistory = chatMessages.map((m) => `${m.role}: ${m.content}`).join('\n');
      const prompt = `${conversationHistory}\nuser: ${userMessage.content}\n\n---\n\nYou are Mission Control, helping create a worker agent in the mission-control agent system. Have a natural conversation to gather:

- Worker name (clear, descriptive, e.g., "Twitter Content Scheduler", "Database Migration Helper")
- Role/title (what they specialize in)
- Task description (what this agent does, their purpose)
- Capabilities needed (list skills/tools: code, research, write, twitter, database, etc.)
- Model suggestion: "sonnet" (Claude Sonnet 4.5 - fast, most tasks) or "opus" (Claude Opus 4 - complex reasoning)

Ask clarifying questions to understand:
- What problem does this agent solve?
- What workflows will they automate?
- What tools/APIs do they need?
- How complex is the work? (helps pick model)

After gathering enough info, output the worker config in this JSON format:
\`\`\`json
{
  "worker": {
    "name": "Twitter Content Scheduler",
    "role": "Social Media Automation",
    "taskDescription": "Schedules and posts Twitter content based on calendar",
    "capabilities": ["twitter", "calendar", "content"],
    "model": "sonnet",
    "instructions": "Brief summary of how this agent operates"
  },
  "complete": true
}
\`\`\`

Be conversational, friendly, and help design an effective agent.`;

      const unsubscribe = gateway.on('chat', (data: any) => {
        const text = data.message?.content?.[0]?.text || data.content || data.delta || '';
        if (text) {
          setStreamingContent(text);
        }

        if (data.state === 'final' || data._event === 'end') {
          setIsStreaming(false);

          const assistantMessage: ChatMessage = {
            id: `msg-${Date.now()}`,
            role: 'assistant',
            content: text || streamingContent,
            timestamp: Date.now(),
          };
          setChatMessages((prev) => [...prev, assistantMessage]);
          setStreamingContent('');

          // Extract worker data
          const workerData = extractWorkerFromResponse(text || streamingContent);
          if (workerData) {
            setExtractedData(workerData);
            if (workerData.name && workerData.taskDescription) {
              setConversationComplete(true);
            }
          }

          unsubscribe();
        }
      });

      await gateway.sendChatStreaming(prompt);
    } catch (error) {
      // 'Chat error:', error;
      setIsStreaming(false);
      setChatMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: 'Oops! Something went wrong. Try again or switch to manual entry.',
          timestamp: Date.now(),
        },
      ]);
    }
  };

  const extractWorkerFromResponse = (response: string): ExtractedWorkerData | null => {
    const jsonMatch = response.match(/```json\s*(\{[\s\S]*?\})\s*```/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        if (parsed.worker && parsed.complete) {
          return {
            name: parsed.worker.name,
            role: parsed.worker.role,
            taskDescription: parsed.worker.taskDescription,
            capabilities: parsed.worker.capabilities || [],
            model: parsed.worker.model || 'sonnet',
            instructions: parsed.worker.instructions,
          };
        }
      } catch (e) {
        // 'Failed to parse worker JSON:', e;
      }
    }
    return null;
  };

  const handleCreateFromChat = async () => {
    if (!extractedData.name || !extractedData.taskDescription) return;

    await createWorker({
      name: extractedData.name,
      role: extractedData.role || extractedData.name,
      taskDescription: extractedData.taskDescription,
      capabilities: extractedData.capabilities || [],
      model: extractedData.model || 'sonnet',
      instructions: extractedData.instructions,
    });

    resetForm();
    handleClose();
  };

  const createWorker = async (workerData: ExtractedWorkerData) => {
    if (!workerData.name || !workerData.taskDescription) return;

    try {
      // Create worker through store (which spawns via gateway)
      await createWorkerAgent(workerData.name, workerData.taskDescription);

      // Log activity
      addActivity({
        type: 'agent',
        message: `Created worker agent: ${workerData.name} (${workerData.model})`,
        timestamp: Date.now(),
      });

      // Success notification
      showToast('success', 'Worker Created!', `${workerData.name} is starting up...`);

      // Worker created successfully
    } catch (error) {
      // 'Failed to create worker:', error;
      showToast('error', 'Worker Creation Failed', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const resetForm = () => {
    setName('');
    setRole('');
    setTaskDescription('');
    setCapabilities('');
    setModel('sonnet');
    setChatMessages([]);
    setChatInput('');
    setExtractedData({});
    setConversationComplete(false);
    setStreamingContent('');
    setIsStreaming(false);
  };

  return (
    <div
      className={`fixed inset-0 modal-backdrop backdrop-blur-md flex items-center justify-center z-50 ${
        isClosing ? 'modal-backdrop-exit' : 'modal-backdrop-enter'
      }`}
      onClick={handleClose}
      aria-hidden="true"
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div
        className={`glass-modal rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col ${
          isClosing ? 'modal-content-exit' : 'modal-content-enter'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-mission-control-border">
          <Flex align="center" justify="between" className="mb-4">
            <Flex align="center" gap="3">
              <Bot className="text-[--accent-11]" size={24} />
              <h2 className="text-xl font-semibold">Create Worker Agent</h2>
            </Flex>
            <IconButton onClick={handleClose} variant="ghost" color="gray" size="2" aria-label="Close modal">
              <X size={16} />
            </IconButton>
          </Flex>

          {/* Mode Selector */}
          <Flex gap="2">
            <Button
              onClick={() => setMode('chat')}
              type="button"
              aria-pressed={mode === 'chat'}
              aria-label="Chat with Mission Control mode"
              variant={mode === 'chat' ? 'solid' : 'outline'}
              color="gray"
              size="3"
              className="flex-1"
            >
              <MessageSquare size={16} />
              <span className="font-medium">Chat with Mission Control</span>
              <Sparkles size={14} className={mode === 'chat' ? 'animate-pulse' : 'opacity-50'} />
            </Button>
            <Button
              onClick={() => setMode('manual')}
              type="button"
              aria-pressed={mode === 'manual'}
              aria-label="Manual entry mode"
              variant={mode === 'manual' ? 'solid' : 'outline'}
              color="gray"
              size="3"
              className="flex-1"
            >
              <Edit3 size={16} />
              <span className="font-medium">Manual Entry</span>
            </Button>
          </Flex>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {mode === 'chat' ? (
            // Chat Mode
            <div className="flex flex-col h-full">
              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {chatMessages.map((msg) => (
                  <Flex key={msg.id} justify={msg.role === 'user' ? 'end' : 'start'}>
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                        msg.role === 'user'
                          ? 'bg-[--accent-9] text-[--accent-1]'
                          : 'bg-mission-control-surface border border-mission-control-border'
                      }`}
                    >
                      <div className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</div>
                      <div className={`text-xs mt-1 ${msg.role === 'user' ? 'text-[--accent-1]/60' : 'text-mission-control-text-dim'}`}>
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </Flex>
                ))}

                {/* Streaming message */}
                {isStreaming && streamingContent && (
                  <Flex justify="start">
                    <div className="max-w-[80%] rounded-2xl px-4 py-3 bg-mission-control-surface border border-mission-control-border">
                      <div className="text-sm leading-relaxed whitespace-pre-wrap">{streamingContent}</div>
                      <Flex align="center" gap="2" className="mt-2">
                        <Spinner size="1" />
                        <span className="text-xs text-mission-control-text-dim">Mission Control is typing...</span>
                      </Flex>
                    </div>
                  </Flex>
                )}

                {/* Loading indicator */}
                {isStreaming && !streamingContent && (
                  <Flex justify="start">
                    <div className="rounded-2xl px-4 py-3 bg-mission-control-surface border border-mission-control-border">
                      <Flex align="center" gap="2">
                        <Spinner size="2" />
                        <span className="text-sm text-mission-control-text-dim">Mission Control is thinking...</span>
                      </Flex>
                    </div>
                  </Flex>
                )}

                <div ref={chatEndRef} />
              </div>

              {/* Extracted Worker Preview */}
              {conversationComplete && extractedData.name && (
                <div className="px-6 pb-4">
                  <div className="bg-[--accent-3] border border-[--accent-6] rounded-lg p-4">
                    <Flex align="center" gap="2" className="mb-3">
                      <Sparkles size={16} className="text-[--accent-11]" />
                      <span className="font-semibold text-sm">Worker Agent Ready!</span>
                    </Flex>
                    <div className="space-y-2 text-sm mb-4">
                      <Flex align="center" gap="2">
                        <strong>Name:</strong> {extractedData.name}
                      </Flex>
                      {extractedData.role && (
                        <Flex align="center" gap="2">
                          <strong>Role:</strong> {extractedData.role}
                        </Flex>
                      )}
                      {extractedData.taskDescription && (
                        <div>
                          <strong>Task:</strong>{' '}
                          {extractedData.taskDescription.length > 100
                            ? `${extractedData.taskDescription.slice(0, 100)}...`
                            : extractedData.taskDescription}
                        </div>
                      )}
                      {extractedData.capabilities && extractedData.capabilities.length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <strong>Capabilities:</strong>
                          {extractedData.capabilities.map((cap, i) => (
                            <span key={i} className="px-2 py-0.5 bg-[--accent-3] rounded-full text-xs">
                              {cap}
                            </span>
                          ))}
                        </div>
                      )}
                      <Flex align="center" gap="2">
                        <strong>Model:</strong>
                        <span className="px-2 py-0.5 bg-info-subtle text-info rounded text-xs font-medium">
                          {extractedData.model === 'opus' ? 'Claude Opus 4' : 'Claude Sonnet 4.5'}
                        </span>
                      </Flex>
                    </div>
                    <Button
                      onClick={handleCreateFromChat}
                      variant="solid"
                      color="grass"
                      size="2"
                      className="w-full"
                      aria-label="Create and start worker agent"
                    >
                      <Zap size={16} />
                      Create &amp; Start Worker
                    </Button>
                  </div>
                </div>
              )}

              {/* Chat Input */}
              <div className="p-6 border-t border-mission-control-border">
                <Flex gap="3">
                  <TextArea
                    ref={inputRef}
                    variant="soft"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleChatSubmit();
                      }
                    }}
                    placeholder="Describe what you need this worker to do..."
                    rows={2}
                    disabled={isStreaming || conversationComplete}
                    className="flex-1 resize-none"
                  />
                  <IconButton
                    onClick={handleChatSubmit}
                    disabled={!chatInput.trim() || isStreaming || conversationComplete}
                    variant="solid"
                    color="grass"
                    size="3"
                    aria-label="Send message"
                  >
                    {isStreaming ? <Spinner size="2" /> : <Send size={16} />}
                  </IconButton>
                </Flex>
                <div className="text-xs text-mission-control-text-dim mt-2">
                  Press <kbd className="px-1.5 py-0.5 bg-mission-control-border rounded">Enter</kbd> to send,{' '}
                  <kbd className="px-1.5 py-0.5 bg-mission-control-border rounded">Shift+Enter</kbd> for new line
                </div>
              </div>
            </div>
          ) : (
            // Manual Mode
            <form onSubmit={handleManualSubmit} className="p-6 space-y-4 overflow-y-auto h-full">
              {/* Name & Role */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="worker-name" className="block text-sm text-mission-control-text-dim mb-1">Worker Name *</label>
                  <TextField.Root
                    id="worker-name"
                    size="2"
                    className="w-full"
                    type="text"
                    value={name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                    placeholder="e.g., Twitter Content Scheduler"
                  />
                </div>
                <div>
                  <label htmlFor="worker-role" className="block text-sm text-mission-control-text-dim mb-1">Role/Title</label>
                  <TextField.Root
                    id="worker-role"
                    size="2"
                    className="w-full"
                    type="text"
                    value={role}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRole(e.target.value)}
                    placeholder="e.g., Social Media Automation"
                  />
                </div>
              </div>

              {/* Task Description */}
              <div>
                <label htmlFor="worker-task-description" className="block text-sm text-mission-control-text-dim mb-1">Task Description *</label>
                <TextArea
                  id="worker-task-description"
                  variant="soft"
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  placeholder="What does this worker do? What workflows will they handle?"
                  rows={4}
                  className="w-full resize-none"
                />
              </div>

              {/* Capabilities */}
              <div>
                <label htmlFor="worker-capabilities" className="block text-sm text-mission-control-text-dim mb-1">Capabilities</label>
                <TextField.Root
                  id="worker-capabilities"
                  size="2"
                  className="w-full"
                  type="text"
                  value={capabilities}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCapabilities(e.target.value)}
                  placeholder="code, research, twitter, database (comma-separated)"
                />
                <div className="text-xs text-mission-control-text-dim mt-1">Comma-separated list of skills/tools needed</div>
              </div>

              {/* Model Selection */}
              <div>
                <span className="block text-sm text-mission-control-text-dim mb-1">Model</span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {MODEL_OPTIONS.map((opt) => (
                    <Button
                      key={opt.id}
                      type="button"
                      onClick={() => setModel(opt.id as 'sonnet' | 'opus')}
                      aria-pressed={model === opt.id}
                      variant={model === opt.id ? 'soft' : 'outline'}
                      color="gray"
                      size="3"
                      className="p-3 rounded-lg text-left h-auto flex-col items-start"
                    >
                      <Flex align="center" gap="2" className="mb-1">
                        {model === opt.id && <CheckCircle size={16} className="text-[--accent-11]" />}
                        <span className="font-medium text-sm">{opt.label}</span>
                      </Flex>
                      <p className="text-xs text-mission-control-text-dim">{opt.description}</p>
                    </Button>
                  ))}
                </div>
              </div>

              {/* Submit */}
              <Flex justify="end" gap="3" className="pt-4 border-t border-mission-control-border">
                <Button type="button" onClick={handleClose} variant="soft" color="gray" size="2">
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={!name.trim() || !taskDescription.trim()}
                  variant="solid"
                  color="grass"
                  size="2"
                >
                  <Zap size={16} />
                  Create &amp; Start
                </Button>
              </Flex>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
