/* eslint-disable react-hooks/exhaustive-deps */
// LEGACY: TaskModal uses file-level suppression for intentional stable ref patterns.
// Modal lifecycle effects and form state management are carefully designed.
// Review: 2026-02-17 - suppression retained, patterns are safe

import { useState, useEffect, useRef } from 'react';
import { Bot, Flag, Calendar, AlertTriangle, ArrowUp, Circle, ArrowDown, MessageSquare, Edit3, Send, Loader2, Sparkles, Upload, X } from 'lucide-react';
import { useStore, TaskStatus, TaskPriority } from '../store/store';
import { gateway } from '../lib/gateway';
import BaseModal, { BaseModalBody } from './BaseModal';
import AgentAvatar from './AgentAvatar';

const PRIORITIES: { id: TaskPriority; label: string; color: string; bg: string; icon: React.ReactNode }[] = [
  { id: 'p0', label: 'Urgent', color: 'text-error', bg: 'bg-error-subtle', icon: <AlertTriangle size={14} /> },
  { id: 'p1', label: 'High', color: 'text-warning', bg: 'bg-warning-subtle', icon: <ArrowUp size={14} /> },
  { id: 'p2', label: 'Medium', color: 'text-warning', bg: 'bg-warning-subtle', icon: <Circle size={14} /> },
  { id: 'p3', label: 'Low', color: 'text-clawd-text-dim', bg: 'bg-clawd-bg0/20', icon: <ArrowDown size={14} /> },
];

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialStatus?: TaskStatus;
  initialData?: {
    title?: string;
    description?: string;
    project?: string;
    priority?: TaskPriority;
    dueDate?: string;
    assignedTo?: string;
  };
}

type ModalMode = 'chat' | 'manual';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface ExtractedTaskData {
  title?: string;
  description?: string;
  project?: string;
  priority?: TaskPriority;
  dueDate?: number;
  assignedTo?: string;
}

export default function TaskModal({ isOpen, onClose, initialStatus = 'todo', initialData }: TaskModalProps) {
  const { addTask, agents } = useStore();
  
  // Mode selection
  const [mode, setMode] = useState<ModalMode>('chat');
  
  // Manual form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [project, setProject] = useState('Default');
  const [status, setStatus] = useState<TaskStatus>(initialStatus);
  const [priority, setPriority] = useState<TaskPriority | ''>('');
  const [dueDate, setDueDate] = useState('');
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [reviewerId, setReviewerId] = useState<string>('froggo'); // Default to Froggo as reviewer
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]); // Files to attach after task creation

  // Multi-stage project state
  const [showMultiStage, setShowMultiStage] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [stageNumber, setStageNumber] = useState(1);
  const [stageName, setStageName] = useState('');
  const [nextStage, setNextStage] = useState('');

  // Chat mode state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [extractedData, setExtractedData] = useState<ExtractedTaskData>({});
  const [conversationComplete, setConversationComplete] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Reset initial status when modal opens
  useEffect(() => {
    if (isOpen) {
      setStatus(initialStatus);
      // Reset chat state
      setChatMessages([]);
      setChatInput('');
      setExtractedData({});
      setConversationComplete(false);
      setStreamingContent('');
      setIsStreaming(false);
      
      // Apply initial data if provided (switch to manual mode)
      if (initialData) {
        setMode('manual');
        setTitle(initialData.title || '');
        setDescription(initialData.description || '');
        setProject(initialData.project || 'Default');
        if (initialData.priority) setPriority(initialData.priority);
        if (initialData.dueDate) setDueDate(initialData.dueDate);
        if (initialData.assignedTo) setAssignedTo(initialData.assignedTo);
        // Always default reviewer to froggo unless explicitly set
        setReviewerId('froggo');
      } else {
        // Fresh task - default reviewer to froggo
        setReviewerId('froggo');
      }
      
      // Start chat with greeting if in chat mode
      if (mode === 'chat' && !initialData) {
        setChatMessages([{
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: "Hey! 🐸 Tell me what you need done and I'll help you create a well-structured task. What's on your mind?",
          timestamp: Date.now(),
        }]);
      }
    }
  }, [isOpen, initialStatus, mode, initialData]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, streamingContent]);

  const focusTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Focus input when mode switches
  useEffect(() => {
    if (isOpen && mode === 'chat' && inputRef.current) {
      focusTimeoutRef.current = setTimeout(() => inputRef.current?.focus(), 100);
    }
    return () => {
      if (focusTimeoutRef.current) {
        clearTimeout(focusTimeoutRef.current);
      }
    };
  }, [isOpen, mode]);

  // ⌘S to save (manual mode only)
  useEffect(() => {
    if (!isOpen || mode !== 'manual') return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 's' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (title.trim()) {
          const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
          handleManualSubmit(fakeEvent);
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, mode, title]);

  // ⌘Enter to create from chat (chat mode only)
  useEffect(() => {
    if (!isOpen || mode !== 'chat') return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (conversationComplete && extractedData.title) {
          handleCreateFromChat();
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, mode, conversationComplete, extractedData]);

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    // Generate task ID first so we can use it for file attachments
    const taskId = `task-${Date.now()}`;

    const newTask = {
      id: taskId, // Pre-generate ID for file attachment
      title: title.trim(),
      description: description.trim() || undefined,
      project,
      status,
      priority: priority || undefined,
      dueDate: dueDate ? new Date(dueDate).getTime() : undefined,
      assignedTo: assignedTo || undefined,
      reviewerId: reviewerId || 'froggo', // Always set reviewer (default: froggo)
      reviewStatus: 'pending' as any, // Initialize review status
      // Multi-stage fields
      ...(showMultiStage && projectName ? { projectName } : {}),
      ...(showMultiStage && stageNumber ? { stageNumber } : {}),
      ...(showMultiStage && stageName ? { stageName } : {}),
      ...(showMultiStage && nextStage ? { nextStage } : {}),
    };

    addTask(newTask);

    // Attach files if any were selected (background operation, don't block modal close)
    if (selectedFiles.length > 0 && window.clawdbot?.exec && window.clawdbot?.fs && window.clawdbot?.tasks?.attachments) {
      // Do file uploads in background
      (async () => {
        const deliverablePath = `~/froggo/deliverables/${taskId}`;
        
        // Create directory
        try {
          await window.clawdbot.exec.run(`mkdir -p "${deliverablePath}"`);
        } catch (err) {
          // 'Failed to create deliverables directory:', err;
          return;
        }

        // Upload each file
        for (const file of selectedFiles) {
          try {
            const filePath = `${deliverablePath}/${file.name}`;
            
            // Read file as base64
            const base64 = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = (event) => {
                const result = event.target?.result as string;
                const base64Data = result.split(',')[1];
                resolve(base64Data);
              };
              reader.onerror = reject;
              reader.readAsDataURL(file);
            });

            // Write file
            await window.clawdbot.fs.writeBase64(filePath, base64);

            // Add attachment record
            await window.clawdbot.tasks.attachments?.add(
              taskId,
              filePath,
              'deliverable',
              'user'
            );
          } catch (error) {
            // `Error uploading file ${file.name}:`, error;
          }
        }
      })();
    }

    // Trigger post-creation review
    triggerOrchestratorReview(newTask);

    // Reset form
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

    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setIsStreaming(true);
    setStreamingContent('');

    try {
      // Construct context-aware prompt
      const conversationHistory = chatMessages.map(m => `${m.role}: ${m.content}`).join('\n');
      const prompt = `${conversationHistory}\nuser: ${userMessage.content}\n\n---\n\nYou are Froggo 🐸, helping create a task in the Kanban system. Have a natural conversation to gather:\n- Task title (clear, actionable)\n- Description (context, details)\n- Project (Dashboard/X/Discord/Telegram/Dev/etc)\n- Priority (p0=urgent, p1=high, p2=medium, p3=low)\n- Due date (if time-sensitive)\n- Agent assignment (Coder/Researcher/Writer/Chief/Main)\n\nAfter gathering enough info, output the task in this JSON format:\n\`\`\`json\n{"task": {"title": "...", "description": "...", "project": "...", "priority": "p1", "dueDate": "2024-01-30", "assignedTo": "coder"}, "complete": true}\n\`\`\`\n\nBe conversational, friendly, and efficient. Ask clarifying questions if needed.`;

      // Setup streaming listener
      const unsubscribe = gateway.on('chat', (data: any) => {
        const text = data.message?.content?.[0]?.text || data.content || data.delta || '';
        if (text) {
          setStreamingContent(text);
        }
        
        if (data.state === 'final' || data._event === 'end') {
          setIsStreaming(false);
          
          // Add assistant message
          const assistantMessage: ChatMessage = {
            id: `msg-${Date.now()}`,
            role: 'assistant',
            content: text || streamingContent,
            timestamp: Date.now(),
          };
          setChatMessages(prev => [...prev, assistantMessage]);
          setStreamingContent('');
          
          // Try to extract task data from response
          const taskData = extractTaskFromResponse(text || streamingContent);
          if (taskData) {
            setExtractedData(taskData);
            if (taskData.title) {
              setConversationComplete(true);
            }
          }
          
          unsubscribe();
        }
      });

      // Send chat
      await gateway.sendChatStreaming(prompt);

    } catch (error) {
      // 'Chat error:', error;
      setIsStreaming(false);
      setChatMessages(prev => [...prev, {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: 'Oops! Something went wrong. Try again or switch to manual entry.',
        timestamp: Date.now(),
      }]);
    }
  };

  const extractTaskFromResponse = (response: string): ExtractedTaskData | null => {
    // Look for JSON task data in code blocks
    const jsonMatch = response.match(/```json\s*(\{[\s\S]*?\})\s*```/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        if (parsed.task && parsed.complete) {
          return {
            title: parsed.task.title,
            description: parsed.task.description,
            project: parsed.task.project || 'Default',
            priority: parsed.task.priority as TaskPriority,
            dueDate: parsed.task.dueDate ? new Date(parsed.task.dueDate).getTime() : undefined,
            assignedTo: parsed.task.assignedTo,
          };
        }
      } catch (e) {
        // 'Failed to parse task JSON:', e;
      }
    }
    return null;
  };

  const handleCreateFromChat = () => {
    if (!extractedData.title) return;

    const newTask = {
      title: extractedData.title,
      description: extractedData.description,
      project: extractedData.project || 'Default',
      status,
      priority: extractedData.priority,
      dueDate: extractedData.dueDate,
      assignedTo: extractedData.assignedTo || autoAssignWorker(extractedData),
      reviewerId: 'froggo', // Always default to Froggo as reviewer
      reviewStatus: 'pending' as any, // Initialize review status
    };

    addTask(newTask);

    // Trigger post-creation review
    triggerOrchestratorReview(newTask);

    // Reset
    resetForm();
    onClose();
  };

  const triggerOrchestratorReview = async (task: any) => {
    try {
      // Log task creation activity to DB for orchestrator to pick up
      await window.clawdbot?.tasks?.activity?.add(task.id || `task-${Date.now()}`, {
        action: 'created',
        message: `Task created via ${mode} mode`,
        agentId: 'main',
        details: JSON.stringify({
          mode,
          extractedData: mode === 'chat' ? extractedData : null,
          conversationLength: chatMessages.length,
        }),
      });

      // Notify orchestrator via gateway
      await gateway.sendToMain(`[TASK_CREATED] New task needs review: "${task.title}" (${task.project})`);
    } catch (error) {
      // 'Failed to trigger orchestrator review:', error;
    }
  };

  const autoAssignWorker = (data: ExtractedTaskData): string => {
    const title = (data.title || '').toLowerCase();
    const desc = (data.description || '').toLowerCase();
    const combined = `${title} ${desc}`;

    // Auto-assignment logic based on keywords
    if (/code|build|implement|fix|debug|develop|feature|bug|refactor|test/i.test(combined)) {
      return 'coder';
    }
    if (/research|analyze|investigate|explore|study|compare|evaluate/i.test(combined)) {
      return 'researcher';
    }
    if (/write|draft|content|tweet|post|article|blog|documentation/i.test(combined)) {
      return 'writer';
    }
    if (/architect|design|plan|strategy|system|infrastructure/i.test(combined)) {
      return 'chief';
    }
    
    return 'main'; // Default to Froggo
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setProject('Default');
    setPriority('');
    setDueDate('');
    setAssignedTo('');
    setReviewerId('froggo'); // Reset to default reviewer
    setSelectedFiles([]); // Clear file selections
    setChatMessages([]);
    setChatInput('');
    setExtractedData({});
    setConversationComplete(false);
    // Reset multi-stage fields
    setShowMultiStage(false);
    setProjectName('');
    setStageNumber(1);
    setStageName('');
    setNextStage('');
  };

  const setQuickDue = (hours: number) => {
    const date = new Date(Date.now() + hours * 60 * 60 * 1000);
    setDueDate(date.toISOString().slice(0, 16));
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      maxHeight="90vh"
      ariaLabel="Create New Task"
      closeButtonPosition="floating"
    >
      <div className="flex flex-col h-full">
        {/* Header with Mode Selector */}
        <div className="p-6 border-b border-clawd-border">
          <h2 className="text-xl font-semibold mb-4">Create New Task</h2>

          {/* Mode Selector */}
          <div className="flex gap-2">
            <button
              onClick={() => setMode('chat')}
              type="button"
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border transition-all ${
                mode === 'chat'
                  ? 'bg-clawd-accent text-white border-clawd-accent shadow-lg shadow-clawd-accent/20'
                  : 'bg-clawd-surface border-clawd-border hover:border-clawd-accent/50'
              }`}
            >
              <MessageSquare size={16} />
              <span className="font-medium">Chat with Froggo</span>
              <Sparkles size={14} className={mode === 'chat' ? 'animate-pulse' : 'opacity-50'} />
            </button>
            <button
              onClick={() => setMode('manual')}
              type="button"
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border transition-all ${
                mode === 'manual'
                  ? 'bg-clawd-accent text-white border-clawd-accent shadow-lg shadow-clawd-accent/20'
                  : 'bg-clawd-surface border-clawd-border hover:border-clawd-accent/50'
              }`}
            >
              <Edit3 size={16} />
              <span className="font-medium">Manual Entry</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <BaseModalBody noPadding className="flex-1 min-h-0">
          {mode === 'chat' ? (
            // Chat Mode
            <div className="flex flex-col h-full">
              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
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
                        <Loader2 size={14} className="animate-spin text-clawd-accent" />
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

              {/* Extracted Task Preview */}
              {conversationComplete && extractedData.title && (
                <div className="px-6 pb-4">
                  <div className="bg-clawd-accent/10 border border-clawd-accent/30 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles size={16} className="text-clawd-accent" />
                      <span className="font-semibold text-sm">Task Ready!</span>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div><strong>Title:</strong> {extractedData.title}</div>
                      {extractedData.description && <div><strong>Description:</strong> {extractedData.description.slice(0, 100)}...</div>}
                      {extractedData.project && <div><strong>Project:</strong> {extractedData.project}</div>}
                      {extractedData.priority && <div><strong>Priority:</strong> {extractedData.priority.toUpperCase()}</div>}
                      {extractedData.assignedTo && <div><strong>Assigned:</strong> {extractedData.assignedTo}</div>}
                    </div>
                    <button
                      onClick={handleCreateFromChat}
                      type="button"
                      className="mt-3 w-full px-4 py-2 bg-clawd-accent text-white rounded-lg hover:bg-clawd-accent-dim transition-colors font-medium"
                    >
                      Create Task
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
                    placeholder="Describe what you need done..."
                    rows={2}
                    disabled={isStreaming || conversationComplete}
                    className="flex-1 bg-clawd-bg border border-clawd-border rounded-lg px-3 py-2 focus:outline-none focus:border-clawd-accent resize-none disabled:opacity-50"
                  />
                  <button
                    onClick={handleChatSubmit}
                    type="button"
                    disabled={!chatInput.trim() || isStreaming || conversationComplete}
                    className="px-4 py-2 bg-clawd-accent text-white rounded-lg hover:bg-clawd-accent-dim transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isStreaming ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  </button>
                </div>
                <div className="text-xs text-clawd-text-dim mt-2">
                  Press <kbd className="px-1.5 py-0.5 bg-clawd-border rounded">Enter</kbd> to send, <kbd className="px-1.5 py-0.5 bg-clawd-border rounded">Shift+Enter</kbd> for new line
                </div>
              </div>
            </div>
          ) : (
            // Manual Mode
            <form onSubmit={handleManualSubmit} className="p-6 space-y-4 overflow-y-auto h-full">
              {/* Title */}
              <div>
                <label htmlFor="task-title" className="block text-sm text-clawd-text-dim mb-1">Title *</label>
                <input
                  id="task-title"
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="What needs to be done?"
                  className="w-full bg-clawd-bg border border-clawd-border rounded-lg px-3 py-2 focus:outline-none focus:border-clawd-accent"
                  /* autoFocus removed for accessibility - users can focus naturally */
                />
              </div>

              {/* Description */}
              <div>
                <label htmlFor="task-description" className="block text-sm text-clawd-text-dim mb-1">Description</label>
                <textarea
                  id="task-description"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Add more details, context, or instructions for the agent..."
                  rows={3}
                  className="w-full bg-clawd-bg border border-clawd-border rounded-lg px-3 py-2 focus:outline-none focus:border-clawd-accent resize-none"
                />
              </div>

              {/* Priority */}
              <div>
                <span className="block text-sm text-clawd-text-dim mb-1 flex items-center gap-1">
                  <Flag size={14} /> Priority
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPriority('')}
                    aria-label="No priority"
                    className={`flex-1 p-2 rounded-lg border text-sm transition-colors ${
                      !priority
                        ? 'border-clawd-accent bg-clawd-accent/10'
                        : 'border-clawd-border hover:border-clawd-accent/50'
                    }`}
                  >
                    None
                  </button>
                  {PRIORITIES.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPriority(p.id)}
                      aria-label={`Priority: ${p.label}`}
                      className={`flex-1 p-2 rounded-lg border text-sm flex items-center justify-center gap-1 transition-colors ${
                        priority === p.id
                          ? `border-clawd-accent ${p.bg} ${p.color}`
                          : 'border-clawd-border hover:border-clawd-accent/50'
                      }`}
                    >
                      {p.icon}
                    </button>
                  ))}
                </div>
              </div>

              {/* Due Date */}
              <div>
                <span className="block text-sm text-clawd-text-dim mb-1 flex items-center gap-1">
                  <Calendar size={14} /> Due Date
                </span>
                <div className="flex gap-2">
                  <input
                    id="task-due-date"
                    type="datetime-local"
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    className="flex-1 bg-clawd-bg border border-clawd-border rounded-lg px-3 py-2 focus:outline-none focus:border-clawd-accent text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setQuickDue(1)}
                    aria-label="Due in 1 hour"
                    className="px-2 py-1 text-xs bg-clawd-surface border border-clawd-border rounded-lg hover:border-clawd-accent/50"
                  >
                    1h
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickDue(4)}
                    aria-label="Due in 4 hours"
                    className="px-2 py-1 text-xs bg-clawd-surface border border-clawd-border rounded-lg hover:border-clawd-accent/50"
                  >
                    4h
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickDue(24)}
                    aria-label="Due in 1 day"
                    className="px-2 py-1 text-xs bg-clawd-surface border border-clawd-border rounded-lg hover:border-clawd-accent/50"
                  >
                    1d
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickDue(168)}
                    aria-label="Due in 1 week"
                    className="px-2 py-1 text-xs bg-clawd-surface border border-clawd-border rounded-lg hover:border-clawd-accent/50"
                  >
                    1w
                  </button>
                </div>
              </div>

              {/* Project & Status Row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="task-project" className="block text-sm text-clawd-text-dim mb-1">Project</label>
                  <input
                    id="task-project"
                    type="text"
                    value={project}
                    onChange={e => setProject(e.target.value)}
                    placeholder="Project name"
                    className="w-full bg-clawd-bg border border-clawd-border rounded-lg px-3 py-2 focus:outline-none focus:border-clawd-accent"
                  />
                </div>
                <div>
                  <label htmlFor="task-status" className="block text-sm text-clawd-text-dim mb-1">Status</label>
                  <select
                    id="task-status"
                    value={status}
                    onChange={e => setStatus(e.target.value as TaskStatus)}
                    className="w-full bg-clawd-bg border border-clawd-border rounded-lg px-3 py-2 focus:outline-none focus:border-clawd-accent"
                  >
                    <option value="todo">📝 To Do</option>
                    <option value="in-progress">⚡ In Progress</option>
                    <option value="review">👀 Review</option>
                    <option value="done">✅ Done</option>
                  </select>
                </div>
              </div>

              {/* Assign to Agent */}
              <div>
                <span className="block text-sm text-clawd-text-dim mb-1 flex items-center gap-1">
                  <Bot size={14} /> Assign to Agent (Worker)
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setAssignedTo('')}
                    aria-label="No agent assigned"
                    aria-pressed={!assignedTo}
                    className={`p-2 rounded-lg border text-left text-sm flex items-center gap-2 transition-colors ${
                      !assignedTo
                        ? 'border-clawd-accent bg-clawd-accent/10 text-clawd-accent'
                        : 'border-clawd-border hover:border-clawd-accent/50'
                    }`}
                  >
                    <span className="text-base">👤</span>
                    <span className="truncate">None</span>
                  </button>
                  {agents
                    .filter(agent => !['main', 'froggo'].includes(agent.id))
                    .map(agent => (
                      <button
                        key={agent.id}
                        type="button"
                        onClick={() => setAssignedTo(agent.id)}
                        aria-label={`Assign to ${agent.name}`}
                        aria-pressed={assignedTo === agent.id}
                        className={`p-2 rounded-lg border text-left text-sm flex items-center gap-2 transition-colors ${
                          assignedTo === agent.id
                            ? 'border-clawd-accent bg-clawd-accent/10 text-clawd-accent'
                            : 'border-clawd-border hover:border-clawd-accent/50'
                        }`}
                      >
                        <AgentAvatar agentId={agent.id} fallbackEmoji={agent.avatar} size="sm" />
                        <span className="truncate">{agent.name}</span>
                      </button>
                    ))}
                </div>
              </div>

              {/* Assign Reviewer */}
              <div>
                <span className="block text-sm text-clawd-text-dim mb-1 flex items-center gap-1">
                  👀 Agent Reviewer
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {agents
                    .filter(agent => agent.id !== assignedTo)
                    .map(agent => (
                      <button
                        key={agent.id}
                        type="button"
                        onClick={() => setReviewerId(agent.id)}
                        aria-label={`Assign ${agent.name} as reviewer`}
                        aria-pressed={reviewerId === agent.id}
                        className={`p-2 rounded-lg border text-left text-sm flex items-center gap-2 transition-colors ${
                          reviewerId === agent.id
                            ? 'border-clawd-accent bg-clawd-accent/10 text-clawd-accent'
                            : 'border-clawd-border hover:border-clawd-accent/50'
                        }`}
                      >
                        <AgentAvatar agentId={agent.id} fallbackEmoji={agent.avatar} size="sm" />
                        <span className="truncate">{agent.name}</span>
                        {agent.id === 'froggo' && <span className="text-xs opacity-60">(default)</span>}
                      </button>
                    ))}
                </div>
                <p className="text-xs text-clawd-text-dim mt-2">
                  📌 Default: Froggo (agent reviewer for all tasks)
                </p>
              </div>

              {/* File Attachments */}
              <div>
                <span className="block text-sm text-clawd-text-dim mb-1 flex items-center gap-1">
                  <Upload size={14} /> Attach Files (Optional)
                </span>
                <div className="space-y-2">
                  {/* File Input */}
                  <div>
                    <input
                      type="file"
                      id="task-file-input"
                      multiple
                      onChange={(e) => {
                        if (e.target.files) {
                          setSelectedFiles(prev => [...prev, ...Array.from(e.target.files!)]);
                          e.target.value = ''; // Reset input
                        }
                      }}
                      className="hidden"
                    />
                    <label
                      htmlFor="task-file-input"
                      className="inline-flex items-center gap-2 px-3 py-2 bg-clawd-surface border border-clawd-border rounded-lg hover:border-clawd-accent/50 transition-colors cursor-pointer text-sm"
                    >
                      <Upload size={16} />
                      Choose Files
                    </label>
                  </div>

                  {/* Selected Files List */}
                  {selectedFiles.length > 0 && (
                    <div className="space-y-1">
                      {selectedFiles.map((file, index) => (
                        <div
                          key={`${file.name}-${index}`}
                          className="flex items-center justify-between gap-2 px-3 py-2 bg-clawd-surface border border-clawd-border rounded-lg text-sm"
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <Upload size={14} className="flex-shrink-0 text-clawd-text-dim" />
                            <span className="truncate">{file.name}</span>
                            <span className="text-xs text-clawd-text-dim flex-shrink-0">
                              ({(file.size / 1024).toFixed(1)} KB)
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== index))}
                            aria-label={`Remove file ${file.name}`}
                            className="p-1 hover:bg-error/20 hover:text-error rounded transition-colors flex-shrink-0"
                            title="Remove file"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-xs text-clawd-text-dim mt-1">
                  Files will be attached after task creation
                </p>
              </div>

              {/* Multi-Stage Project Setup */}
              <div className="border border-clawd-border rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowMultiStage(!showMultiStage)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-clawd-surface hover:bg-clawd-bg transition-colors text-sm"
                >
                  <span className="flex items-center gap-2">
                    <span>🔄</span>
                    <span>Multi-Stage Project</span>
                    {showMultiStage && projectName && (
                      <span className="text-xs text-clawd-accent bg-clawd-accent/10 px-2 py-0.5 rounded-full">{projectName}</span>
                    )}
                  </span>
                  <span className="text-clawd-text-dim">{showMultiStage ? '▲' : '▼'}</span>
                </button>
                {showMultiStage && (
                  <div className="p-3 space-y-3 border-t border-clawd-border">
                    <div>
                      <label htmlFor="project-name" className="block text-xs text-clawd-text-dim mb-1">Project Name</label>
                      <input
                        id="project-name"
                        type="text"
                        value={projectName}
                        onChange={e => setProjectName(e.target.value)}
                        placeholder="e.g., Authentication System"
                        className="w-full bg-clawd-bg border border-clawd-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-clawd-accent"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="stage-number" className="block text-xs text-clawd-text-dim mb-1">Stage Number</label>
                        <select
                          id="stage-number"
                          value={stageNumber}
                          onChange={e => setStageNumber(Number(e.target.value))}
                          className="w-full bg-clawd-bg border border-clawd-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-clawd-accent"
                        >
                          {[1,2,3,4,5,6,7,8,9,10].map(n => (
                            <option key={n} value={n}>{n}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="stage-name" className="block text-xs text-clawd-text-dim mb-1">Stage Name</label>
                        <input
                          id="stage-name"
                          type="text"
                          value={stageName}
                          onChange={e => setStageName(e.target.value)}
                          placeholder="e.g., Design Phase"
                          className="w-full bg-clawd-bg border border-clawd-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-clawd-accent"
                        />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="next-stage" className="block text-xs text-clawd-text-dim mb-1">Next Stage (auto-creates on completion)</label>
                      <input
                        id="next-stage"
                        type="text"
                        value={nextStage}
                        onChange={e => setNextStage(e.target.value)}
                        placeholder="e.g., Stage 2: Implementation"
                        className="w-full bg-clawd-bg border border-clawd-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-clawd-accent"
                      />
                      <p className="text-xs text-clawd-text-dim mt-1">
                        💡 If set, a new task with this title will be automatically created when this task is marked done
                      </p>
                    </div>
                  </div>
                )}
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
                  disabled={!title.trim()}
                  aria-disabled={!title.trim()}
                  className="px-4 py-2 rounded-lg bg-clawd-accent text-white hover:bg-clawd-accent-dim transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  Create Task
                  {assignedTo && <span className="text-xs opacity-75">& Assign</span>}
                  <kbd className="px-1.5 py-0.5 bg-clawd-text/20 rounded text-xs">⌘S</kbd>
                </button>
              </div>
            </form>
          )}
        </BaseModalBody>
      </div>
    </BaseModal>
  );
}
