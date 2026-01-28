import { useState, useEffect, useRef } from 'react';
import { X, Bot, MessageSquare, Edit3, Send, Loader2, Sparkles, Zap, CheckCircle } from 'lucide-react';
import { gateway } from '../lib/gateway';
import { useStore } from '../store/store';

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
              "Hey! 🐸 Let's create a new worker agent together. Tell me what you need this agent to do, and I'll help you design it. What's the task?",
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
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

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
    onClose();
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
      const prompt = `${conversationHistory}\nuser: ${userMessage.content}\n\n---\n\nYou are Froggo 🐸, helping create a worker agent in the Clawdbot agent system. Have a natural conversation to gather:

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
      console.error('Chat error:', error);
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
        console.error('Failed to parse worker JSON:', e);
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
    onClose();
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
      const { showToast } = await import('./Toast');
      showToast('success', 'Worker Created!', `${workerData.name} is starting up...`);

      console.log('[WorkerModal] Created worker:', workerData);
    } catch (error) {
      console.error('Failed to create worker:', error);
      const { showToast } = await import('./Toast');
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
    <div className="fixed inset-0 modal-backdrop backdrop-blur-md flex items-center justify-center z-50" onClick={onClose}>
      <div className="glass-modal rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="p-6 border-b border-clawd-border">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Bot className="text-clawd-accent" size={24} />
              <h2 className="text-xl font-semibold">Create Worker Agent</h2>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-clawd-border rounded-lg transition-colors">
              <X size={20} />
            </button>
          </div>

          {/* Mode Selector */}
          <div className="flex gap-2">
            <button
              onClick={() => setMode('chat')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border transition-all ${
                mode === 'chat'
                  ? 'bg-clawd-accent text-white border-clawd-accent shadow-lg shadow-clawd-accent/20'
                  : 'bg-clawd-surface border-clawd-border hover:border-clawd-accent/50'
              }`}
            >
              <MessageSquare size={18} />
              <span className="font-medium">Chat with Froggo</span>
              <Sparkles size={14} className={mode === 'chat' ? 'animate-pulse' : 'opacity-50'} />
            </button>
            <button
              onClick={() => setMode('manual')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border transition-all ${
                mode === 'manual'
                  ? 'bg-clawd-accent text-white border-clawd-accent shadow-lg shadow-clawd-accent/20'
                  : 'bg-clawd-surface border-clawd-border hover:border-clawd-accent/50'
              }`}
            >
              <Edit3 size={18} />
              <span className="font-medium">Manual Entry</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {mode === 'chat' ? (
            // Chat Mode
            <div className="flex flex-col h-full">
              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {chatMessages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                        msg.role === 'user'
                          ? 'bg-clawd-accent text-white'
                          : 'bg-clawd-surface border border-clawd-border'
                      }`}
                    >
                      <div className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</div>
                      <div className={`text-xs mt-1 ${msg.role === 'user' ? 'text-white/60' : 'text-clawd-text-dim'}`}>
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Streaming message */}
                {isStreaming && streamingContent && (
                  <div className="flex justify-start">
                    <div className="max-w-[80%] rounded-2xl px-4 py-3 bg-clawd-surface border border-clawd-border">
                      <div className="text-sm leading-relaxed whitespace-pre-wrap">{streamingContent}</div>
                      <div className="flex items-center gap-2 mt-2">
                        <Loader2 size={12} className="animate-spin text-clawd-accent" />
                        <span className="text-xs text-clawd-text-dim">Froggo is typing...</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Loading indicator */}
                {isStreaming && !streamingContent && (
                  <div className="flex justify-start">
                    <div className="rounded-2xl px-4 py-3 bg-clawd-surface border border-clawd-border">
                      <div className="flex items-center gap-2">
                        <Loader2 size={16} className="animate-spin text-clawd-accent" />
                        <span className="text-sm text-clawd-text-dim">Froggo is thinking...</span>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>

              {/* Extracted Worker Preview */}
              {conversationComplete && extractedData.name && (
                <div className="px-6 pb-4">
                  <div className="bg-clawd-accent/10 border border-clawd-accent/30 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles size={16} className="text-clawd-accent" />
                      <span className="font-semibold text-sm">Worker Agent Ready!</span>
                    </div>
                    <div className="space-y-2 text-sm mb-4">
                      <div className="flex items-center gap-2">
                        <strong>Name:</strong> {extractedData.name}
                      </div>
                      {extractedData.role && (
                        <div className="flex items-center gap-2">
                          <strong>Role:</strong> {extractedData.role}
                        </div>
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
                            <span key={i} className="px-2 py-0.5 bg-clawd-accent/20 rounded-full text-xs">
                              {cap}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <strong>Model:</strong>
                        <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs font-medium">
                          {extractedData.model === 'opus' ? 'Claude Opus 4 🚀' : 'Claude Sonnet 4.5 ⚡'}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={handleCreateFromChat}
                      className="w-full px-4 py-2 bg-clawd-accent text-white rounded-lg hover:bg-clawd-accent-dim transition-colors font-medium flex items-center justify-center gap-2"
                    >
                      <Zap size={18} />
                      Create & Start Worker
                    </button>
                  </div>
                </div>
              )}

              {/* Chat Input */}
              <div className="p-6 border-t border-clawd-border">
                <div className="flex gap-3">
                  <textarea
                    ref={inputRef}
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
                    className="flex-1 bg-clawd-bg border border-clawd-border rounded-lg px-3 py-2 focus:outline-none focus:border-clawd-accent resize-none disabled:opacity-50"
                  />
                  <button
                    onClick={handleChatSubmit}
                    disabled={!chatInput.trim() || isStreaming || conversationComplete}
                    className="px-4 py-2 bg-clawd-accent text-white rounded-lg hover:bg-clawd-accent-dim transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isStreaming ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                  </button>
                </div>
                <div className="text-xs text-clawd-text-dim mt-2">
                  Press <kbd className="px-1.5 py-0.5 bg-clawd-border rounded">Enter</kbd> to send,{' '}
                  <kbd className="px-1.5 py-0.5 bg-clawd-border rounded">Shift+Enter</kbd> for new line
                </div>
              </div>
            </div>
          ) : (
            // Manual Mode
            <form onSubmit={handleManualSubmit} className="p-6 space-y-4 overflow-y-auto h-full">
              {/* Name & Role */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-clawd-text-dim mb-1">Worker Name *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Twitter Content Scheduler"
                    className="w-full bg-clawd-bg border border-clawd-border rounded-lg px-3 py-2 focus:outline-none focus:border-clawd-accent"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm text-clawd-text-dim mb-1">Role/Title</label>
                  <input
                    type="text"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="e.g., Social Media Automation"
                    className="w-full bg-clawd-bg border border-clawd-border rounded-lg px-3 py-2 focus:outline-none focus:border-clawd-accent"
                  />
                </div>
              </div>

              {/* Task Description */}
              <div>
                <label className="block text-sm text-clawd-text-dim mb-1">Task Description *</label>
                <textarea
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  placeholder="What does this worker do? What workflows will they handle?"
                  rows={4}
                  className="w-full bg-clawd-bg border border-clawd-border rounded-lg px-3 py-2 focus:outline-none focus:border-clawd-accent resize-none"
                />
              </div>

              {/* Capabilities */}
              <div>
                <label className="block text-sm text-clawd-text-dim mb-1">Capabilities</label>
                <input
                  type="text"
                  value={capabilities}
                  onChange={(e) => setCapabilities(e.target.value)}
                  placeholder="code, research, twitter, database (comma-separated)"
                  className="w-full bg-clawd-bg border border-clawd-border rounded-lg px-3 py-2 focus:outline-none focus:border-clawd-accent"
                />
                <div className="text-xs text-clawd-text-dim mt-1">Comma-separated list of skills/tools needed</div>
              </div>

              {/* Model Selection */}
              <div>
                <label className="block text-sm text-clawd-text-dim mb-1">Model</label>
                <div className="grid grid-cols-2 gap-3">
                  {MODEL_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setModel(opt.id as 'sonnet' | 'opus')}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        model === opt.id
                          ? 'border-clawd-accent bg-clawd-accent/10'
                          : 'border-clawd-border hover:border-clawd-accent/50'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {model === opt.id && <CheckCircle size={16} className="text-clawd-accent" />}
                        <span className="font-medium text-sm">{opt.label}</span>
                      </div>
                      <p className="text-xs text-clawd-text-dim">{opt.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit */}
              <div className="flex justify-end gap-3 pt-4 border-t border-clawd-border">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg border border-clawd-border hover:bg-clawd-border transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!name.trim() || !taskDescription.trim()}
                  className="px-4 py-2 rounded-lg bg-clawd-accent text-white hover:bg-clawd-accent-dim transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Zap size={18} />
                  Create & Start
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
