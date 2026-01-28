import { useState, useEffect, useRef } from 'react';
import { X, Sparkles, Brain, Edit3, Lightbulb, MessageSquare, Send, Loader2, CheckCircle, Code, Search } from 'lucide-react';
import { gateway } from '../lib/gateway';

interface SkillModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ModalMode = 'suggest' | 'dialogue' | 'manual';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface ExtractedSkillData {
  name?: string;
  category?: string;
  description?: string;
  instructions?: string;
  skillType?: 'code' | 'research' | 'content' | 'general';
}

interface SkillSuggestion {
  name: string;
  reason: string;
  category: string;
  skillType: 'code' | 'research' | 'content' | 'general';
}

export default function SkillModal({ isOpen, onClose }: SkillModalProps) {
  // Mode selection
  const [mode, setMode] = useState<ModalMode>('suggest');
  
  // Manual form state
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');

  // Suggest mode state
  const [suggestions, setSuggestions] = useState<SkillSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<SkillSuggestion | null>(null);

  // Chat mode state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [extractedData, setExtractedData] = useState<ExtractedSkillData>({});
  const [conversationComplete, setConversationComplete] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      resetForm();
      
      // Load suggestions if in suggest mode
      if (mode === 'suggest') {
        loadSuggestions();
      }
      
      // Start chat with greeting if in dialogue mode
      if (mode === 'dialogue') {
        setChatMessages([{
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: "Hey! 🐸 Let's design a new skill together. What kind of capability do you want to add? I'll help you structure it properly.",
          timestamp: Date.now(),
        }]);
      }
    }
  }, [isOpen, mode]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, streamingContent]);

  // Focus input when mode switches
  useEffect(() => {
    if (isOpen && mode === 'dialogue' && inputRef.current) {
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

  const loadSuggestions = async () => {
    setLoadingSuggestions(true);
    try {
      // Analyze recent tasks from froggo-db to detect patterns
      const result = await (window as any).clawdbot?.exec?.run('froggo-db task-list --status done --limit 20');
      const tasks = result?.output ? JSON.parse(result.output) : [];

      // Send to AI for pattern analysis
      const prompt = `Analyze these recent completed tasks and suggest 3-5 new skills that would be valuable:

${JSON.stringify(tasks, null, 2)}

Detect patterns in:
- Repetitive workflows that could be automated
- Common tools/technologies being used
- Types of research or analysis being done
- Content creation patterns
- Integration opportunities

For each suggestion, provide:
- name: Clear, action-oriented skill name (e.g., "GitHub PR Review", "Database Schema Analysis")
- reason: Why this skill would be valuable (2-3 sentences)
- category: One of (automation, development, research, content, integration, analysis)
- skillType: One of (code, research, content, general)

Return ONLY a JSON array of suggestions:
\`\`\`json
[{"name": "...", "reason": "...", "category": "...", "skillType": "code"}, ...]
\`\`\``;

      const response = await gateway.sendChat(prompt);
      const suggestions = extractSuggestionsFromResponse(response);
      setSuggestions(suggestions);
    } catch (error) {
      console.error('Failed to load suggestions:', error);
      setSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const extractSuggestionsFromResponse = (response: string): SkillSuggestion[] => {
    const jsonMatch = response.match(/```json\s*(\[[\s\S]*?\])\s*```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1]);
      } catch (e) {
        console.error('Failed to parse suggestions JSON:', e);
      }
    }
    return [];
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !instructions.trim()) return;

    await createSkill({
      name: name.trim(),
      category: category.trim() || 'general',
      description: description.trim() || '',
      instructions: instructions.trim(),
      skillType: detectSkillType(name, instructions),
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

    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setIsStreaming(true);
    setStreamingContent('');

    try {
      const conversationHistory = chatMessages.map(m => `${m.role}: ${m.content}`).join('\n');
      const prompt = `${conversationHistory}\nuser: ${userMessage.content}\n\n---\n\nYou are Froggo 🐸, helping design a new skill for the agent system. Have a natural conversation to gather:

- Skill name (clear, action-oriented, e.g., "GitHub PR Review", "Market Research")
- Category (automation/development/research/content/integration/analysis)
- Description (what the skill does, when to use it)
- Instructions (step-by-step guide for executing the skill)
- Skill type (code/research/content/general) - for smart agent assignment

Ask clarifying questions to understand:
- What problem does this solve?
- What are the inputs/outputs?
- What tools or APIs are needed?
- What's the expected workflow?

After gathering enough info, output the skill in this JSON format:
\`\`\`json
{"skill": {"name": "...", "category": "...", "description": "...", "instructions": "...", "skillType": "code"}, "complete": true}
\`\`\`

Be conversational, friendly, and help structure the skill properly.`;

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
          setChatMessages(prev => [...prev, assistantMessage]);
          setStreamingContent('');
          
          // Try to extract skill data
          const skillData = extractSkillFromResponse(text || streamingContent);
          if (skillData) {
            setExtractedData(skillData);
            if (skillData.name && skillData.instructions) {
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
      setChatMessages(prev => [...prev, {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: 'Oops! Something went wrong. Try again or switch to manual entry.',
        timestamp: Date.now(),
      }]);
    }
  };

  const extractSkillFromResponse = (response: string): ExtractedSkillData | null => {
    const jsonMatch = response.match(/```json\s*(\{[\s\S]*?\})\s*```/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        if (parsed.skill && parsed.complete) {
          return parsed.skill;
        }
      } catch (e) {
        console.error('Failed to parse skill JSON:', e);
      }
    }
    return null;
  };

  const handleCreateFromChat = async () => {
    if (!extractedData.name || !extractedData.instructions) return;

    await createSkill({
      name: extractedData.name,
      category: extractedData.category || 'general',
      description: extractedData.description || '',
      instructions: extractedData.instructions,
      skillType: extractedData.skillType || detectSkillType(extractedData.name, extractedData.instructions),
    });

    resetForm();
    onClose();
  };

  const handleSelectSuggestion = async (suggestion: SkillSuggestion) => {
    setSelectedSuggestion(suggestion);
    
    // Generate full skill instructions using AI
    setLoadingSuggestions(true);
    try {
      const prompt = `Generate detailed step-by-step instructions for this skill:

Skill: ${suggestion.name}
Category: ${suggestion.category}
Why: ${suggestion.reason}

Instructions should be:
- Clear and actionable
- Include specific commands/tools to use
- Reference relevant files or APIs
- Include error handling steps
- Be ready to paste into SKILL.md

Format as markdown with proper headings.`;

      const response = await gateway.sendChat(prompt);
      
      // Auto-fill the manual form with suggestion + generated instructions
      setName(suggestion.name);
      setCategory(suggestion.category);
      setDescription(suggestion.reason);
      setInstructions(response);
      setMode('manual'); // Switch to manual to review/edit
    } catch (error) {
      console.error('Failed to generate instructions:', error);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const createSkill = async (skillData: ExtractedSkillData) => {
    if (!skillData.name || !skillData.instructions) return;

    try {
      // 1. Create skill directory
      const skillSlug = skillData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const skillPath = `~/clawd/skills/${skillSlug}`;
      await (window as any).clawdbot?.exec?.run(`mkdir -p ${skillPath}`);

      // 2. Create SKILL.md
      const skillMd = generateSkillMd(skillData);
      await (window as any).clawdbot?.exec?.run(`cat > ${skillPath}/SKILL.md`, { stdin: skillMd });

      // 3. Track in skill_evolution table
      await (window as any).clawdbot?.exec?.run(
        `sqlite3 ~/clawd/data/froggo.db "INSERT OR REPLACE INTO skill_evolution (skill_name, proficiency, notes) VALUES ('${skillData.name.replace(/'/g, "''")}', 0.1, 'Auto-created via Skills Add Flow')"`
      );

      // 4. Auto-create Kanban implementation task
      const assignedAgent = assignAgentForSkill(skillData.skillType || 'general');
      const taskTitle = `Implement skill: ${skillData.name}`;
      const taskDesc = `${skillData.description || skillData.reason || ''}\n\nSkill location: ${skillPath}/SKILL.md\nReview instructions and implement the skill as described.`;
      
      const taskResult = await (window as any).clawdbot?.exec?.run(
        `froggo-db task-add "${taskTitle}" --project "Skills" --status todo --assigned-to ${assignedAgent} --description "${taskDesc.replace(/"/g, '\\"')}"`
      );

      // 5. Show success notification
      const { showToast } = await import('./Toast');
      showToast('success', 'Skill Created!', `${skillData.name} added and task assigned to ${assignedAgent}`);

      console.log('[SkillModal] Created skill:', {
        name: skillData.name,
        path: skillPath,
        agent: assignedAgent,
        task: taskResult,
      });

    } catch (error) {
      console.error('Failed to create skill:', error);
      const { showToast } = await import('./Toast');
      showToast('error', 'Skill Creation Failed', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const generateSkillMd = (skillData: ExtractedSkillData): string => {
    return `# ${skillData.name}

**Category:** ${skillData.category || 'general'}  
**Type:** ${skillData.skillType || 'general'}

## Description

${skillData.description || 'No description provided.'}

## When to Use

${skillData.description ? 'Use this skill when ' + skillData.description.toLowerCase() : 'Use this skill as needed.'}

## Instructions

${skillData.instructions}

## Notes

- Created: ${new Date().toISOString().split('T')[0]}
- Status: 🟡 Not yet implemented
- Proficiency: 0.1 (initial)

## Related Skills

(To be added)

## Examples

(To be added after implementation)
`;
  };

  const assignAgentForSkill = (skillType: string): string => {
    switch (skillType) {
      case 'code':
        return 'coder';
      case 'research':
        return 'researcher';
      case 'content':
        return 'writer';
      default:
        return 'main';
    }
  };

  const detectSkillType = (name: string, instructions: string): 'code' | 'research' | 'content' | 'general' => {
    const combined = `${name} ${instructions}`.toLowerCase();
    
    if (/code|build|implement|develop|debug|test|deploy|api|function|script/i.test(combined)) {
      return 'code';
    }
    if (/research|analyze|investigate|compare|study|explore|evaluate/i.test(combined)) {
      return 'research';
    }
    if (/write|draft|content|tweet|post|article|blog|documentation/i.test(combined)) {
      return 'content';
    }
    
    return 'general';
  };

  const resetForm = () => {
    setName('');
    setCategory('');
    setDescription('');
    setInstructions('');
    setChatMessages([]);
    setChatInput('');
    setExtractedData({});
    setConversationComplete(false);
    setSuggestions([]);
    setSelectedSuggestion(null);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="glass-modal rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-clawd-border">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Brain className="text-clawd-accent" size={24} />
              <h2 className="text-xl font-semibold">Add New Skill</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-clawd-border rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Mode Selector */}
          <div className="flex gap-2">
            <button
              onClick={() => setMode('suggest')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border transition-all ${
                mode === 'suggest'
                  ? 'bg-clawd-accent text-white border-clawd-accent shadow-lg shadow-clawd-accent/20'
                  : 'bg-clawd-surface border-clawd-border hover:border-clawd-accent/50'
              }`}
            >
              <Lightbulb size={18} />
              <span className="font-medium">Suggest</span>
              <Sparkles size={14} className={mode === 'suggest' ? 'animate-pulse' : 'opacity-50'} />
            </button>
            <button
              onClick={() => setMode('dialogue')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border transition-all ${
                mode === 'dialogue'
                  ? 'bg-clawd-accent text-white border-clawd-accent shadow-lg shadow-clawd-accent/20'
                  : 'bg-clawd-surface border-clawd-border hover:border-clawd-accent/50'
              }`}
            >
              <MessageSquare size={18} />
              <span className="font-medium">Dialogue</span>
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
              <span className="font-medium">Manual</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {mode === 'suggest' ? (
            // Suggest Mode
            <div className="p-6 space-y-4 overflow-y-auto h-full">
              <div className="bg-clawd-surface border border-clawd-border rounded-xl p-4 mb-4">
                <div className="flex items-start gap-3">
                  <Search className="text-clawd-accent mt-1" size={20} />
                  <div>
                    <h3 className="font-semibold mb-1">Analyzing your workflow...</h3>
                    <p className="text-sm text-clawd-text-dim">
                      Based on your recent tasks, here are some skills that could boost your productivity.
                    </p>
                  </div>
                </div>
              </div>

              {loadingSuggestions ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="animate-spin text-clawd-accent" size={32} />
                  <span className="ml-3 text-clawd-text-dim">Analyzing patterns...</span>
                </div>
              ) : suggestions.length > 0 ? (
                <div className="space-y-3">
                  {suggestions.map((suggestion, idx) => (
                    <div
                      key={idx}
                      className="bg-clawd-surface border border-clawd-border rounded-xl p-4 hover:border-clawd-accent/50 transition-all cursor-pointer group"
                      onClick={() => handleSelectSuggestion(suggestion)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {suggestion.skillType === 'code' && <Code size={16} className="text-blue-400" />}
                            {suggestion.skillType === 'research' && <Search size={16} className="text-purple-400" />}
                            {suggestion.skillType === 'content' && <Edit3 size={16} className="text-green-400" />}
                            <h4 className="font-semibold">{suggestion.name}</h4>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-clawd-border text-clawd-text-dim">
                              {suggestion.category}
                            </span>
                          </div>
                          <p className="text-sm text-clawd-text-dim">{suggestion.reason}</p>
                        </div>
                        <Sparkles 
                          size={20} 
                          className="text-clawd-accent opacity-0 group-hover:opacity-100 transition-opacity ml-3 mt-1" 
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-clawd-text-dim">
                  <Lightbulb size={48} className="mx-auto mb-4 opacity-50" />
                  <p>No suggestions yet. Complete some tasks first!</p>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-clawd-border">
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg border border-clawd-border hover:bg-clawd-border transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={loadSuggestions}
                  disabled={loadingSuggestions}
                  className="px-4 py-2 rounded-lg bg-clawd-accent text-white hover:bg-clawd-accent-dim transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {loadingSuggestions ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                  Refresh Suggestions
                </button>
              </div>
            </div>
          ) : mode === 'dialogue' ? (
            // Dialogue Mode
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

              {/* Extracted Skill Preview */}
              {conversationComplete && extractedData.name && (
                <div className="px-6 pb-4">
                  <div className="bg-clawd-accent/10 border border-clawd-accent/30 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle size={16} className="text-clawd-accent" />
                      <span className="font-semibold text-sm">Skill Ready!</span>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div><strong>Name:</strong> {extractedData.name}</div>
                      <div><strong>Category:</strong> {extractedData.category}</div>
                      {extractedData.description && <div><strong>Description:</strong> {extractedData.description.slice(0, 100)}...</div>}
                      <div><strong>Type:</strong> {extractedData.skillType}</div>
                    </div>
                    <button
                      onClick={handleCreateFromChat}
                      className="mt-3 w-full px-4 py-2 bg-clawd-accent text-white rounded-lg hover:bg-clawd-accent-dim transition-colors font-medium"
                    >
                      Create Skill & Implementation Task
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
                    placeholder="Describe the skill you want to add..."
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
                  Press <kbd className="px-1.5 py-0.5 bg-clawd-border rounded">Enter</kbd> to send, <kbd className="px-1.5 py-0.5 bg-clawd-border rounded">Shift+Enter</kbd> for new line
                </div>
              </div>
            </div>
          ) : (
            // Manual Mode
            <form onSubmit={handleManualSubmit} className="p-6 space-y-4 overflow-y-auto h-full">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-clawd-text-dim mb-1">Skill Name *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g., GitHub PR Review"
                    className="w-full bg-clawd-bg border border-clawd-border rounded-lg px-3 py-2 focus:outline-none focus:border-clawd-accent"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm text-clawd-text-dim mb-1">Category</label>
                  <input
                    type="text"
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    placeholder="e.g., automation, research"
                    className="w-full bg-clawd-bg border border-clawd-border rounded-lg px-3 py-2 focus:outline-none focus:border-clawd-accent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-clawd-text-dim mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="What does this skill do? When should it be used?"
                  rows={2}
                  className="w-full bg-clawd-bg border border-clawd-border rounded-lg px-3 py-2 focus:outline-none focus:border-clawd-accent resize-none"
                />
              </div>

              <div>
                <label className="block text-sm text-clawd-text-dim mb-1">Instructions *</label>
                <textarea
                  value={instructions}
                  onChange={e => setInstructions(e.target.value)}
                  placeholder="Step-by-step instructions for executing this skill. Include commands, tools, and workflows."
                  rows={12}
                  className="w-full bg-clawd-bg border border-clawd-border rounded-lg px-3 py-2 focus:outline-none focus:border-clawd-accent resize-none font-mono text-sm"
                />
                <div className="text-xs text-clawd-text-dim mt-1">
                  Tip: Use markdown formatting. This will be saved to SKILL.md
                </div>
              </div>

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
                  disabled={!name.trim() || !instructions.trim()}
                  className="px-4 py-2 rounded-lg bg-clawd-accent text-white hover:bg-clawd-accent-dim transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <CheckCircle size={18} />
                  Create Skill & Task
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
