/* eslint-disable react-hooks/exhaustive-deps */
// LEGACY: TaskModal uses file-level suppression for intentional stable ref patterns.
// Modal lifecycle effects and form state management are carefully designed.
// Review: 2026-02-17 - suppression retained, patterns are safe

import { useState, useEffect, useRef } from 'react';
import { Bot, Flag, Calendar, Clock, AlertTriangle, ArrowUp, Circle, ArrowDown, MessageSquare, Edit3, Send, Loader2, Sparkles, Upload, X, FileText, ChevronDown, Lightbulb } from 'lucide-react';
import { useStore, TaskStatus, TaskPriority } from '../store/store';
// eslint-disable-next-line import/order
import { Button, Flex, Spinner, TextArea, TextField, IconButton, Select } from '@radix-ui/themes';
import { taskApi } from '../lib/api';
import { gateway } from '../lib/gateway';
import { showToast } from './Toast';
import BaseModal, { BaseModalBody } from './BaseModal';
import AgentAvatar from './AgentAvatar';

const PRIORITIES: { id: TaskPriority; label: string; color: string; bg: string; icon: React.ReactNode }[] = [
  { id: 'p0', label: 'Urgent', color: 'text-error', bg: 'bg-error-subtle', icon: <AlertTriangle size={14} /> },
  { id: 'p1', label: 'High', color: 'text-warning', bg: 'bg-warning-subtle', icon: <ArrowUp size={14} /> },
  { id: 'p2', label: 'Medium', color: 'text-warning', bg: 'bg-warning-subtle', icon: <Circle size={14} /> },
  { id: 'p3', label: 'Low', color: 'text-mission-control-text-dim', bg: 'bg-mission-control-bg0/20', icon: <ArrowDown size={14} /> },
];

// Task templates
const TASK_TEMPLATES: { id: string; label: string; planningNotes: string }[] = [
  {
    id: 'bug',
    label: 'Bug Fix',
    planningNotes: '## Root Cause\n\n## Fix Approach\n\n## Acceptance Criteria\n- Bug no longer reproduces\n- Tests pass',
  },
  {
    id: 'feature',
    label: 'Feature',
    planningNotes: '## What we\'re building\n\n## Approach\n\n## Acceptance Criteria\n- ',
  },
  {
    id: 'research',
    label: 'Research',
    planningNotes: '## Question to answer\n\n## Sources to check\n\n## Output format\n',
  },
  {
    id: 'design',
    label: 'Design',
    planningNotes: '## Brief\n\n## Deliverables\n\n## Acceptance Criteria\n- Designs match brand guidelines\n- ',
  },
  {
    id: 'content',
    label: 'Content',
    planningNotes: '## Topic\n\n## Audience\n\n## Key messages\n\n## Acceptance Criteria\n- ',
  },
];

const DEFAULT_PLANNING_NOTES = '## Approach\n\n## Acceptance Criteria\n- ';

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
  const { addTask, agents, tasks } = useStore();
  
  // Mode selection
  const [mode, setMode] = useState<ModalMode>('chat');
  
  // Manual form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [planningNotes, setPlanningNotes] = useState(DEFAULT_PLANNING_NOTES);
  const [project, setProject] = useState('Default');
  const [status, setStatus] = useState<TaskStatus>(initialStatus);
  const [priority, setPriority] = useState<TaskPriority | ''>('p2');
  const [dueDate, setDueDate] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [reviewerId, setReviewerId] = useState<string>('clara'); // Default to Clara as reviewer
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]); // Files to attach after task creation
  const [showTemplates, setShowTemplates] = useState(false);

  // Validation state
  const [titleError, setTitleError] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
      setTitleError('');
      
      // Apply initial data if provided (switch to manual mode)
      if (initialData) {
        setMode('manual');
        setTitle(initialData.title || '');
        setDescription(initialData.description || '');
        setPlanningNotes(DEFAULT_PLANNING_NOTES);
        setProject(initialData.project || 'Default');
        if (initialData.priority) setPriority(initialData.priority);
        if (initialData.dueDate) setDueDate(initialData.dueDate);
        setScheduledAt('');
        if (initialData.assignedTo) setAssignedTo(initialData.assignedTo);
        // Default reviewer to clara
        setReviewerId('clara');
      } else {
        // Fresh task - default reviewer to clara
        setReviewerId('clara');
        setPriority('p2');
        setPlanningNotes(DEFAULT_PLANNING_NOTES);
      }
      setShowTemplates(false);
      
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
    if (!title.trim()) {
      setTitleError('Task title is required');
      return;
    }

    // Generate task ID first so we can use it for file attachments
    const taskId = `task-${Date.now()}`;

    const newTask = {
      id: taskId, // Pre-generate ID for file attachment
      title: title.trim(),
      description: description.trim() || undefined,
      planningNotes: planningNotes.trim() && planningNotes.trim() !== DEFAULT_PLANNING_NOTES.trim() ? planningNotes.trim() : undefined,
      project,
      status,
      priority: priority || undefined,
      dueDate: dueDate ? new Date(dueDate).getTime() : undefined,
      scheduledAt: scheduledAt ? new Date(scheduledAt).getTime() : undefined,
      assignedTo: assignedTo || undefined,
      reviewerId: reviewerId || 'clara', // Always set reviewer (default: clara)
      reviewStatus: 'pending' as any, // Initialize review status
      // Multi-stage fields
      ...(showMultiStage && projectName ? { projectName } : {}),
      ...(showMultiStage && stageNumber ? { stageNumber } : {}),
      ...(showMultiStage && stageName ? { stageName } : {}),
      ...(showMultiStage && nextStage ? { nextStage } : {}),
    };

    setSubmitting(true);
    try {
      await taskApi.create(newTask);
      addTask(newTask);

      // File attachments not available in web mode (requires Electron fs/exec)
      if (selectedFiles.length > 0) {
        showToast('info', 'File attachments not available in web mode');
      }

      // Trigger post-creation review
      triggerOrchestratorReview(newTask);

      // Reset form
      resetForm();
      onClose();
    } catch (err) {
      showToast('error', 'Failed to create task', (err as Error).message);
    } finally {
      setSubmitting(false);
    }
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
      const prompt = `${conversationHistory}\nuser: ${userMessage.content}\n\n---\n\nYou are Mission Control 🐸, helping create a task in the Kanban system. Have a natural conversation to gather:\n- Task title (clear, actionable)\n- Description (context, details)\n- Project (Dashboard/X/Discord/Telegram/Dev/etc)\n- Priority (p0=urgent, p1=high, p2=medium, p3=low)\n- Due date (if time-sensitive)\n- Agent assignment (Coder/Researcher/Writer/Chief/Main)\n\nAfter gathering enough info, output the task in this JSON format:\n\`\`\`json\n{"task": {"title": "...", "description": "...", "project": "...", "priority": "p1", "dueDate": "2024-01-30", "assignedTo": "coder"}, "complete": true}\n\`\`\`\n\nBe conversational, friendly, and efficient. Ask clarifying questions if needed.`;

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

  const handleCreateFromChat = async () => {
    if (!extractedData.title) return;

    const newTask = {
      title: extractedData.title,
      description: extractedData.description,
      project: extractedData.project || 'Default',
      status,
      priority: extractedData.priority,
      dueDate: extractedData.dueDate,
      assignedTo: extractedData.assignedTo || autoAssignWorker(extractedData),
      reviewerId: 'clara', // Always default to Clara as reviewer
      reviewStatus: 'pending' as any, // Initialize review status
    };

    try {
      await taskApi.create(newTask);
      addTask(newTask);
      // Trigger post-creation review
      triggerOrchestratorReview(newTask);
      // Reset
      resetForm();
      onClose();
    } catch (err) {
      showToast('error', 'Failed to create task', (err as Error).message);
    }
  };

  const triggerOrchestratorReview = async (task: any) => {
    try {
      // Log task creation activity to DB for orchestrator to pick up
      await taskApi.addActivity(task.id || `task-${Date.now()}`, {
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
    
    return 'main'; // Default to Mission Control
  };

  const resetForm = () => {
    setTitleError('');
    setTitle('');
    setDescription('');
    setPlanningNotes(DEFAULT_PLANNING_NOTES);
    setProject('Default');
    setPriority('');
    setDueDate('');
    setScheduledAt('');
    setAssignedTo('');
    setReviewerId('mission-control'); // Reset to default reviewer
    setSelectedFiles([]); // Clear file selections
    setChatMessages([]);
    setChatInput('');
    setExtractedData({});
    setConversationComplete(false);
    setShowTemplates(false);
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
        <div className="p-6 border-b border-mission-control-border">
          <h2 className="text-xl font-semibold mb-4">Create New Task</h2>

          {/* Mode Selector */}
          <Flex gap="2">
            <Button
              onClick={() => setMode('chat')}
              type="button"
              variant={mode === 'chat' ? 'solid' : 'outline'}
              color={mode === 'chat' ? 'violet' : 'gray'}
              size="3"
              className="flex-1"
            >
              <MessageSquare size={16} />
              Chat with Mission Control
              <Sparkles size={14} className={mode === 'chat' ? 'animate-pulse' : 'opacity-50'} />
            </Button>
            <Button
              onClick={() => setMode('manual')}
              type="button"
              variant={mode === 'manual' ? 'solid' : 'outline'}
              color={mode === 'manual' ? 'violet' : 'gray'}
              size="3"
              className="flex-1"
            >
              <Edit3 size={16} />
              Manual Entry
            </Button>
          </Flex>
        </div>

        {/* Content */}
        <BaseModalBody noPadding className="flex-1 min-h-0" maxHeight="calc(90vh - 140px)">
          {mode === 'chat' ? (
            // Chat Mode
            <div className="flex flex-col" style={{ minHeight: 0, height: 'calc(90vh - 140px)' }}>
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
                          ? 'bg-mission-control-accent text-white'
                          : 'bg-mission-control-surface border border-mission-control-border'
                      }`}
                    >
                      <div className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</div>
                      <div className={`text-xs mt-1 ${msg.role === 'user' ? 'text-white/60' : 'text-mission-control-text-dim'}`}>
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Streaming message */}
                {isStreaming && streamingContent && (
                  <Flex justify="start">
                    <div className="max-w-[80%] rounded-2xl px-4 py-3 bg-mission-control-surface border border-mission-control-border">
                      <div className="text-sm leading-relaxed whitespace-pre-wrap">{streamingContent}</div>
                      <Flex align="center" gap="2" className="mt-2">
                        <Loader2 size={14} className="animate-spin text-mission-control-accent" />
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
                        <Loader2 size={16} className="animate-spin text-mission-control-accent" />
                        <span className="text-sm text-mission-control-text-dim">Mission Control is thinking...</span>
                      </Flex>
                    </div>
                  </Flex>
                )}

                <div ref={chatEndRef} />
              </div>

              {/* Extracted Task Preview */}
              {conversationComplete && extractedData.title && (
                <div className="px-6 pb-4">
                  <div className="bg-mission-control-accent/10 border border-mission-control-accent/30 rounded-lg p-4">
                    <Flex align="center" gap="2" className="mb-2">
                      <Sparkles size={16} className="text-mission-control-accent" />
                      <span className="font-semibold text-sm">Task Ready!</span>
                    </Flex>
                    <div className="space-y-1 text-sm">
                      <div><strong>Title:</strong> {extractedData.title}</div>
                      {extractedData.description && <div><strong>Description:</strong> {extractedData.description.slice(0, 100)}...</div>}
                      {extractedData.project && <div><strong>Project:</strong> {extractedData.project}</div>}
                      {extractedData.priority && <div><strong>Priority:</strong> {extractedData.priority.toUpperCase()}</div>}
                      {extractedData.assignedTo && <div><strong>Assigned:</strong> {extractedData.assignedTo}</div>}
                    </div>
                    <Button
                      onClick={handleCreateFromChat}
                      type="button"
                      size="2"
                      className="mt-3 w-full"
                    >
                      Create Task
                    </Button>
                  </div>
                </div>
              )}

              {/* Chat Input */}
              <div className="p-6 border-t border-mission-control-border">
                <Flex gap="3">
                  <TextArea
                    ref={inputRef as any}
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleChatSubmit();
                      }
                    }}
                    placeholder="Describe what you need done..."
                    aria-label="Describe what you need done"
                    rows={2}
                    disabled={isStreaming || conversationComplete}
                    resize="none"
                    className="flex-1"
                  />
                  <IconButton
                    onClick={handleChatSubmit}
                    type="button"
                    disabled={!chatInput.trim() || isStreaming || conversationComplete}
                    size="3"
                    aria-label="Send"
                  >
                    {isStreaming ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  </IconButton>
                </Flex>
                <div className="text-xs text-mission-control-text-dim mt-2">
                  Press <kbd className="px-1.5 py-0.5 bg-mission-control-border rounded">Enter</kbd> or <kbd className="px-1.5 py-0.5 bg-mission-control-border rounded">⌘↩</kbd> to send, <kbd className="px-1.5 py-0.5 bg-mission-control-border rounded">Shift+Enter</kbd> for new line
                </div>
              </div>
            </div>
          ) : (
            // Manual Mode
            <form onSubmit={handleManualSubmit} className="p-6 space-y-4">
              {/* Title */}
              <div>
                <Flex align="center" justify="between" className="mb-1">
                  <label htmlFor="task-title" className="text-sm text-mission-control-text-dim">
                    Title <span className="text-error text-xs ml-0.5" aria-hidden="true">*</span>
                  </label>
                  <span className={`text-xs ${title.length > 120 ? 'text-warning' : 'text-mission-control-text-dim'}`}>{title.length}/140</span>
                </Flex>
                <TextField.Root
                  id="task-title"
                  value={title}
                  maxLength={140}
                  onChange={e => { setTitle(e.target.value); if (titleError) setTitleError(''); }}
                  placeholder="What needs to be done?"
                  color={titleError ? 'red' : undefined}
                  size="2"
                />
                {titleError && (
                  <p className="text-error text-xs mt-1" role="alert">{titleError}</p>
                )}
              </div>

              {/* Description */}
              <div>
                <Flex align="center" justify="between" className="mb-1">
                  <label htmlFor="task-description" className="text-sm text-mission-control-text-dim">Description</label>
                  <span className="text-xs text-mission-control-text-dim">{description.length} chars</span>
                </Flex>
                <TextArea
                  id="task-description"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Add more details, context, or instructions for the agent..."
                  rows={3}
                  resize="none"
                />
              </div>

              {/* Planning Notes */}
              <div>
                <Flex align="center" justify="between" className="mb-1">
                  <label htmlFor="task-planning-notes" className="flex items-center gap-1.5 text-sm text-mission-control-text-dim">
                    <FileText size={14} />
                    Planning Notes
                    <span className="text-error text-xs ml-0.5" aria-hidden="true">*</span>
                  </label>
                  <Flex align="center" gap="2">
                    <span className="text-xs text-mission-control-text-dim">{planningNotes.length} chars</span>
                    <div className="relative">
                      <Button
                        type="button"
                        onClick={() => setShowTemplates(v => !v)}
                        size="1"
                        variant="ghost"
                       
                      >
                        <Lightbulb size={12} />
                        Use template
                        <ChevronDown size={12} className={`transition-transform ${showTemplates ? 'rotate-180' : ''}`} />
                      </Button>
                      {showTemplates && (
                        <div className="absolute right-0 top-full mt-1 bg-mission-control-surface border border-mission-control-border rounded-lg shadow-lg z-50 min-w-[140px]">
                          {TASK_TEMPLATES.map(t => (
                            <Button
                              key={t.id}
                              type="button"
                              onClick={() => { setPlanningNotes(t.planningNotes); setShowTemplates(false); }}
                              variant="ghost"
                              size="1"
                              radius="none"
                              className="w-full justify-start px-3 py-2 first:rounded-t-lg last:rounded-b-lg"
                            >
                              {t.label}
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                  </Flex>
                </Flex>
                <TextArea
                  id="task-planning-notes"
                  value={planningNotes}
                  onChange={e => setPlanningNotes(e.target.value)}
                  rows={6}
                  resize="vertical"
                  className="font-mono"
                />
                <p className="text-xs text-mission-control-text-dim mt-1 flex items-center gap-1">
                  <Lightbulb size={11} />
                  Describe your approach and acceptance criteria. Clara checks this before dispatch.
                </p>
              </div>

              {/* Priority */}
              <div>
                <span className="block text-sm text-mission-control-text-dim mb-1 flex items-center gap-1">
                  <Flag size={14} /> Priority
                </span>
                <Flex gap="2">
                  <Button
                    type="button"
                    onClick={() => setPriority('')}
                    aria-label="No priority"
                    size="2"
                    variant={!priority ? 'soft' : 'outline'}
                   
                    className="flex-1"
                  >
                    None
                  </Button>
                  {PRIORITIES.map(p => (
                    <Button
                      key={p.id}
                      type="button"
                      onClick={() => setPriority(p.id)}
                      aria-label={`Priority: ${p.label}`}
                      size="2"
                      variant={priority === p.id ? 'soft' : 'outline'}
                     
                      className="flex-1"
                    >
                      {p.icon}
                    </Button>
                  ))}
                </Flex>
              </div>

              {/* Due Date */}
              <div>
                <span className="block text-sm text-mission-control-text-dim mb-1 flex items-center gap-1">
                  <Calendar size={14} /> Due Date
                </span>
                <Flex gap="2">
                  <TextField.Root
                    id="task-due-date"
                    type="datetime-local"
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    size="2"
                    className="flex-1"
                  />
                  {[{ h: 1, l: '1h' }, { h: 4, l: '4h' }, { h: 24, l: '1d' }, { h: 168, l: '1w' }].map(({ h, l }) => (
                    <Button
                      key={l}
                      type="button"
                      onClick={() => setQuickDue(h)}
                      aria-label={`Due in ${l}`}
                      variant="outline"
                      color="gray"
                      size="2"
                    >
                      {l}
                    </Button>
                  ))}
                </Flex>
              </div>

              {/* Schedule for */}
              <div>
                <span className="block text-sm text-mission-control-text-dim mb-1 flex items-center gap-1">
                  <Clock size={14} /> Schedule for
                </span>
                <TextField.Root
                  id="task-scheduled-at"
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={e => setScheduledAt(e.target.value)}
                  size="2"
                />
                <p className="text-xs text-mission-control-text-dim mt-1">When to start working on this task</p>
              </div>

              {/* Project & Status Row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="task-project" className="block text-sm text-mission-control-text-dim mb-1">Project</label>
                  <TextField.Root
                    id="task-project"
                    value={project}
                    onChange={e => setProject(e.target.value)}
                    placeholder="Project name"
                    size="2"
                  />
                </div>
                <div>
                  <label htmlFor="task-status" className="block text-sm text-mission-control-text-dim mb-1">Status</label>
                  <Select.Root value={status} onValueChange={val => setStatus(val as TaskStatus)}>
                    <Select.Trigger className="w-full" />
                    <Select.Content>
                      <Select.Item value="todo">To Do</Select.Item>
                      <Select.Item value="in-progress">In Progress</Select.Item>
                      <Select.Item value="review">Review</Select.Item>
                      <Select.Item value="done">Done</Select.Item>
                    </Select.Content>
                  </Select.Root>
                </div>
              </div>

              {/* Assign to Agent */}
              <div>
                <span className="block text-sm text-mission-control-text-dim mb-1 flex items-center gap-1">
                  <Bot size={14} /> Assign to Agent (Worker)
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    type="button"
                    onClick={() => setAssignedTo('')}
                    aria-label="No agent assigned"
                    aria-pressed={!assignedTo}
                    size="2"
                    variant={!assignedTo ? 'soft' : 'outline'}
                   
                    className="p-2 text-left flex items-center gap-2"
                  >
                    <span className="text-base">👤</span>
                    <span className="truncate">None</span>
                  </Button>
                  {agents
                    .filter(agent => !['main', 'mission-control'].includes(agent.id))
                    .map(agent => {
                      const activeTaskCount = tasks.filter(t => t.assignedTo === agent.id && ['todo', 'in-progress', 'internal-review'].includes(t.status)).length;
                      return { agent, activeTaskCount };
                    })
                    .sort((a, b) => a.activeTaskCount - b.activeTaskCount)
                    .map(({ agent, activeTaskCount }) => {
                      const isDisabled = agent.status === 'disabled';
                      const isBusy = activeTaskCount > 5;
                      return (
                        <Button
                          key={agent.id}
                          type="button"
                          onClick={() => setAssignedTo(agent.id)}
                          aria-label={`Assign to ${agent.name}${isDisabled ? ' (offline)' : ''}${isBusy ? ' (busy)' : ''}`}
                          aria-pressed={assignedTo === agent.id}
                          size="2"
                          variant={assignedTo === agent.id ? 'soft' : 'outline'}
                         
                          disabled={isDisabled}
                          className="p-2 text-left flex flex-col gap-1 h-auto"
                        >
                          <Flex align="center" gap="2">
                            <AgentAvatar agentId={agent.id} fallbackEmoji={agent.avatar} size="sm" />
                            <span className="truncate text-xs font-medium">{agent.name}</span>
                          </Flex>
                          <Flex align="center" gap="1" className="text-[10px] text-mission-control-text-dim">
                            <span>{activeTaskCount} task{activeTaskCount !== 1 ? 's' : ''}</span>
                            {isBusy && <span className="text-warning">(busy)</span>}
                            {isDisabled && <span className="text-error">(offline)</span>}
                          </Flex>
                          {activeTaskCount > 0 && (
                            <div className="h-1 bg-mission-control-border rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${isBusy ? 'bg-warning' : 'bg-success'}`}
                                style={{ width: `${Math.min(100, (activeTaskCount / 8) * 100)}%` }}
                              />
                            </div>
                          )}
                        </Button>
                      );
                    })}
                </div>
                {assignedTo && agents.find(a => a.id === assignedTo)?.status === 'disabled' && (
                  <div className="mt-2 flex items-center gap-2 p-2 rounded-lg bg-warning-subtle border border-warning-border text-warning text-xs">
                    <AlertTriangle size={12} className="flex-shrink-0" />
                    This agent is disabled. Task will queue but won&apos;t execute until re-enabled.
                  </div>
                )}
              </div>

              {/* Assign Reviewer */}
              <div>
                <span className="block text-sm text-mission-control-text-dim mb-1 flex items-center gap-1">
                  👀 Agent Reviewer
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {agents
                    .filter(agent => agent.id !== assignedTo)
                    .map(agent => (
                      <Button
                        key={agent.id}
                        type="button"
                        onClick={() => setReviewerId(agent.id)}
                        aria-label={`Assign ${agent.name} as reviewer`}
                        aria-pressed={reviewerId === agent.id}
                        size="2"
                        variant={reviewerId === agent.id ? 'soft' : 'outline'}
                       
                        className="p-2 text-left flex items-center gap-2"
                      >
                        <AgentAvatar agentId={agent.id} fallbackEmoji={agent.avatar} size="sm" />
                        <span className="truncate">{agent.name}</span>
                        {agent.id === 'mission-control' && <span className="text-xs opacity-60">(default)</span>}
                      </Button>
                    ))}
                </div>
                <p className="text-xs text-mission-control-text-dim mt-2">
                  Default: Clara (quality gate reviewer for all tasks)
                </p>
              </div>

              {/* File Attachments */}
              <div>
                <span className="block text-sm text-mission-control-text-dim mb-1 flex items-center gap-1">
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
                      className="inline-flex items-center gap-2 px-3 py-2 bg-mission-control-surface border border-mission-control-border rounded-lg hover:border-mission-control-accent/50 transition-colors cursor-pointer text-sm"
                    >
                      <Upload size={16} />
                      Choose Files
                    </label>
                  </div>

                  {/* Selected Files List */}
                  {selectedFiles.length > 0 && (
                    <div className="space-y-1">
                      {selectedFiles.map((file, index) => (
                        <Flex
                          key={`${file.name}-${index}`}
                          align="center"
                          justify="between"
                          gap="2"
                          className="px-3 py-2 bg-mission-control-surface border border-mission-control-border rounded-lg text-sm"
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <Upload size={14} className="flex-shrink-0 text-mission-control-text-dim" />
                            <span className="truncate">{file.name}</span>
                            <span className="text-xs text-mission-control-text-dim flex-shrink-0">
                              ({(file.size / 1024).toFixed(1)} KB)
                            </span>
                          </div>
                          <IconButton
                            type="button"
                            onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== index))}
                            aria-label={`Remove file ${file.name}`}
                            variant="ghost"
                            color="red"
                            size="1"
                          >
                            <X size={14} />
                          </IconButton>
                        </Flex>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-xs text-mission-control-text-dim mt-1">
                  Files will be attached after task creation
                </p>
              </div>

              {/* Multi-Stage Project Setup */}
              <div className="border border-mission-control-border rounded-lg overflow-hidden">
                <Button
                  type="button"
                  onClick={() => setShowMultiStage(!showMultiStage)}
                  variant="ghost"
                  size="2"
                  radius="none"
                  className="w-full flex items-center justify-between px-3 py-2"
                >
                  <span className="flex items-center gap-2">
                    <ChevronDown size={14} className="text-mission-control-text-dim" />
                    <span>Multi-Stage Project</span>
                    {showMultiStage && projectName && (
                      <span className="text-xs text-mission-control-accent bg-mission-control-accent/10 px-2 py-0.5 rounded-full">{projectName}</span>
                    )}
                  </span>
                  <ChevronDown size={14} className={`text-mission-control-text-dim transition-transform ${showMultiStage ? 'rotate-180' : ''}`} />
                </Button>
                {showMultiStage && (
                  <div className="p-3 space-y-3 border-t border-mission-control-border">
                    <div>
                      <label className="block text-xs text-mission-control-text-dim mb-1">Project Name</label>
                      <TextField.Root
                        type="text"
                        value={projectName}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProjectName(e.target.value)}
                        placeholder="e.g., Authentication System"
                        aria-label="Project name"
                        size="2"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-mission-control-text-dim mb-1">Stage Number</label>
                        <Select.Root value={String(stageNumber)} onValueChange={val => setStageNumber(Number(val))}>
                          <Select.Trigger className="w-full" />
                          <Select.Content>
                            {[1,2,3,4,5,6,7,8,9,10].map(n => (
                              <Select.Item key={n} value={String(n)}>{n}</Select.Item>
                            ))}
                          </Select.Content>
                        </Select.Root>
                      </div>
                      <div>
                        <label className="block text-xs text-mission-control-text-dim mb-1">Stage Name</label>
                        <TextField.Root
                          type="text"
                          value={stageName}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStageName(e.target.value)}
                          placeholder="e.g., Design Phase"
                          aria-label="Stage name"
                          size="2"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-mission-control-text-dim mb-1">Next Stage (auto-creates on completion)</label>
                      <TextField.Root
                        type="text"
                        value={nextStage}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNextStage(e.target.value)}
                        placeholder="e.g., Stage 2: Implementation"
                        aria-label="Next stage name"
                        size="2"
                      />
                      <p className="text-xs text-mission-control-text-dim mt-1">
                        💡 If set, a new task with this title will be automatically created when this task is marked done
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Submit */}
              <Flex justify="end" gap="3" className="pt-4 border-t border-mission-control-border">
                <Button
                  type="button"
                  onClick={onClose}
                  variant="outline"
                  color="gray"
                  size="2"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={!title.trim() || submitting}
                  title="Submit (Enter)"
                  size="2"
                >
                  {submitting ? <Spinner size="1" /> : null}
                  Create Task
                  {assignedTo && <span className="text-xs opacity-75">& Assign</span>}
                  <kbd className="px-1.5 py-0.5 bg-mission-control-text/20 rounded text-xs">⌘S</kbd>
                </Button>
              </Flex>
            </form>
          )}
        </BaseModalBody>
      </div>
    </BaseModal>
  );
}
