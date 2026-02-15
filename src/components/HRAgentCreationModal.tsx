import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Send, Loader2, Check } from 'lucide-react';
import { showToast } from './Toast';
import { useStore } from '../store/store';

interface HRAgentCreationModalProps {
  onClose: () => void;
  onAgentCreated?: (agent: CreatedAgent) => void;
}

interface CreatedAgent {
  id: string;
  name: string;
  emoji: string;
  role: string;
  color: string;
  capabilities: string[];
  personality: string;
}

interface Message {
  role: 'hr' | 'user' | 'system';
  content: string;
  timestamp: number;
}

// HR agent creation conversation stages
type Stage = 'greeting' | 'name' | 'role' | 'style' | 'skills' | 'personality' | 'review' | 'creating' | 'done';

const STAGE_PROMPTS: Record<Stage, string> = {
  greeting: '',
  name: "What should we call this new team member?",
  role: "What will they specialize in? (e.g., DevOps, QA Tester, Designer, Data Analyst...)",
  style: "How should they work? Meticulous and thorough? Fast and pragmatic? Creative and exploratory?",
  skills: "What specific skills do they need? (list a few, e.g., Docker, Kubernetes, CI/CD)",
  personality: "Any personality traits? (e.g., patient, direct, witty, formal) — or I can suggest some based on the role!",
  review: '',
  creating: '',
  done: '',
};

const HR_RESPONSES: Record<string, string[]> = {
  greeting: [
    "Hey! 🎓 Ready to add someone new to the team? Let's build them together.",
    "I'll walk you through creating a new agent. It'll just take a minute!",
  ],
  name_ack: [
    "Great name! I like it.",
    "Nice choice!",
    "Perfect — solid name.",
  ],
  role_ack: [
    "Excellent focus area. We could use that on the team.",
    "Good call — that's a gap we should fill.",
    "Smart. Let's build around that specialty.",
  ],
  style_ack: [
    "Got it — that'll shape how they approach tasks.",
    "Makes sense for the role. I'll bake that in.",
  ],
  skills_ack: [
    "Solid skill set. I'll make sure they're proficient in those.",
    "Good picks. Those will be their core competencies.",
  ],
  personality_auto: [
    "I'll craft a personality that fits the role perfectly.",
    "Leave it to me — I know what works for this kind of agent.",
  ],
};

function pickRandom(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Color palette for new agents
const AGENT_COLORS = [
  '#E91E63', '#00BCD4', '#8BC34A', '#FF5722', '#3F51B5',
  '#009688', '#CDDC39', '#795548', '#607D8B', '#673AB7',
];

export default function HRAgentCreationModal({ onClose, onAgentCreated }: HRAgentCreationModalProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [stage, setStage] = useState<Stage>('greeting');
  const [isClosing, setIsClosing] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Collected agent data
  const [agentData, setAgentData] = useState({
    name: '',
    role: '',
    style: '',
    skills: [] as string[],
    personality: '',
    emoji: '🤖',
    color: AGENT_COLORS[Math.floor(Math.random() * AGENT_COLORS.length)],
  });

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  // Start conversation
  useEffect(() => {
    const timer = setTimeout(() => {
      addHRMessage(pickRandom(HR_RESPONSES.greeting));
      setTimeout(() => {
        addHRMessage(STAGE_PROMPTS.name);
        setStage('name');
      }, 800);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const addHRMessage = (content: string) => {
    setMessages(prev => [...prev, { role: 'hr', content, timestamp: Date.now() }]);
  };

  const addUserMessage = (content: string) => {
    setMessages(prev => [...prev, { role: 'user', content, timestamp: Date.now() }]);
  };

  const addSystemMessage = (content: string) => {
    setMessages(prev => [...prev, { role: 'system', content, timestamp: Date.now() }]);
  };

  const simulateTyping = (callback: () => void, delay = 600) => {
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      callback();
    }, delay);
  };

  const handleSend = () => {
    if (!input.trim() || stage === 'creating' || stage === 'done') return;
    const text = input.trim();
    setInput('');
    addUserMessage(text);

    switch (stage) {
      case 'name':
        handleName(text);
        break;
      case 'role':
        handleRole(text);
        break;
      case 'style':
        handleStyle(text);
        break;
      case 'skills':
        handleSkills(text);
        break;
      case 'personality':
        handlePersonality(text);
        break;
      case 'review':
        handleReview(text);
        break;
    }
  };

  const handleName = (text: string) => {
    const name = text.replace(/[^a-zA-Z0-9\s-_]/g, '').trim();
    setAgentData(prev => ({ ...prev, name }));
    simulateTyping(() => {
      addHRMessage(pickRandom(HR_RESPONSES.name_ack));
      setTimeout(() => {
        addHRMessage(STAGE_PROMPTS.role);
        setStage('role');
      }, 500);
    });
  };

  const handleRole = (text: string) => {
    setAgentData(prev => ({ ...prev, role: text }));
    // Auto-suggest emoji based on role
    const emojiMap: Record<string, string> = {
      devops: '🔧', qa: '🧪', test: '🧪', design: '🎨', data: '📊',
      security: '🔒', ml: '🧠', ai: '🧠', mobile: '📱', cloud: '☁️',
      frontend: '🖥️', backend: '⚙️', database: '🗄️', support: '🎧',
    };
    const lower = text.toLowerCase();
    const emoji = Object.entries(emojiMap).find(([k]) => lower.includes(k))?.[1] || '🤖';
    setAgentData(prev => ({ ...prev, emoji }));

    simulateTyping(() => {
      addHRMessage(pickRandom(HR_RESPONSES.role_ack));
      setTimeout(() => {
        addHRMessage(STAGE_PROMPTS.style);
        setStage('style');
      }, 500);
    });
  };

  const handleStyle = (text: string) => {
    setAgentData(prev => ({ ...prev, style: text }));
    simulateTyping(() => {
      addHRMessage(pickRandom(HR_RESPONSES.style_ack));
      setTimeout(() => {
        addHRMessage(STAGE_PROMPTS.skills);
        setStage('skills');
      }, 500);
    });
  };

  const handleSkills = (text: string) => {
    const skills = text.split(/[,;]/).map(s => s.trim()).filter(Boolean);
    setAgentData(prev => ({ ...prev, skills }));
    simulateTyping(() => {
      addHRMessage(pickRandom(HR_RESPONSES.skills_ack));
      setTimeout(() => {
        addHRMessage(STAGE_PROMPTS.personality);
        setStage('personality');
      }, 500);
    });
  };

  const handlePersonality = (text: string) => {
    const isAuto = text.toLowerCase().includes('suggest') || text.toLowerCase().includes('you choose') || text.toLowerCase().includes('auto') || text.trim() === '';
    if (isAuto) {
      // Generate personality from role/style
      const personality = `${agentData.style}. Specializes in ${agentData.role}. Reliable and focused.`;
      setAgentData(prev => ({ ...prev, personality }));
      simulateTyping(() => {
        addHRMessage(pickRandom(HR_RESPONSES.personality_auto));
        showReview();
      }, 400);
    } else {
      setAgentData(prev => ({ ...prev, personality: text }));
      simulateTyping(() => {
        addHRMessage("Love it — personality locked in.");
        showReview();
      }, 400);
    }
  };

  const showReview = () => {
    setTimeout(() => {
      setStage('review');
      const reviewText = `Here's what I've got:\n\n` +
        `**${agentData.emoji} ${agentData.name}**\n` +
        `**Role:** ${agentData.role}\n` +
        `**Style:** ${agentData.style}\n` +
        `**Skills:** ${agentData.skills.join(', ')}\n` +
        `**Personality:** ${agentData.personality || 'Auto-generated'}\n\n` +
        `Look good? Say **"create"** to bring them to life, or tell me what to change.`;
      addHRMessage(reviewText);
    }, 600);
  };

  const handleReview = (text: string) => {
    const lower = text.toLowerCase();
    if (lower.includes('create') || lower.includes('yes') || lower.includes('go') || lower.includes('ship') || lower.includes('do it') || lower.includes('looks good')) {
      createAgent();
    } else {
      addHRMessage("No problem — what would you like to change? (name, role, style, skills, or personality)");
    }
  };

  const createAgent = async () => {
    setStage('creating');
    addSystemMessage('🔨 Running full onboarding script...');

    try {
      const agentId = agentData.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const personality = agentData.personality || `${agentData.style}. Specializes in ${agentData.role}. Focused and reliable.`;

      const config = {
        id: agentId,
        name: agentData.name,
        role: agentData.role,
        emoji: agentData.emoji,
        color: agentData.color,
        personality,
        voice: 'Puck',
      };

      addSystemMessage('⚙️ Creating workspace, DB entries, auth profiles, patching dashboard...');

      const result = await (window as any).clawdbot.agents.create(config);

      if (!result.success) {
        throw new Error(result.error || 'Onboarding script failed');
      }

      addSystemMessage('✅ Onboarding script completed!');

      // Refresh agent list from gateway
      useStore.getState().fetchAgents();

      const createdAgent: CreatedAgent = {
        id: agentId,
        name: agentData.name,
        emoji: agentData.emoji,
        role: agentData.role,
        color: agentData.color,
        capabilities: agentData.skills,
        personality,
      };

      setStage('done');
      addHRMessage(
        `🎉 **Welcome to the team, ${agentData.name}!**\n\n` +
        `${agentData.emoji} ${agentData.name} has been fully onboarded:\n` +
        `• Workspace created at ~/clawd-${agentId}/\n` +
        `• Registered in openclaw.json + froggo.db\n` +
        `• Auth profiles & model config set up\n` +
        `• Dashboard patched (themes, selector, voices)\n` +
        `• Gateway restarted\n` +
        `• Onboarding task created with subtask checklist\n\n` +
        `Remaining: headshot generation + first training session.\n` +
        `You can close this and find them in the Agents panel!`
      );

      onAgentCreated?.(createdAgent);
      showToast(`${agentData.emoji} ${agentData.name} created!`, 'success');

    } catch (err: any) {
      setStage('review');
      addHRMessage(`Hmm, something went wrong: ${err.message}. Want to try again? Say "create" to retry.`);
      showToast('Agent creation failed', 'error');
    }
  };

  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  const handleClose = () => {
    setIsClosing(true);
    closeTimeoutRef.current = setTimeout(onClose, 200);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${isClosing ? 'animate-fadeOut' : 'animate-fadeIn'}`}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} role="button" tabIndex={-1} aria-label="Close agent creation" />
      <div className={`relative w-full max-w-lg bg-clawd-bg border border-teal-500/30 rounded-2xl shadow-2xl shadow-teal-500/10 flex flex-col max-h-[80vh] ${isClosing ? 'animate-scaleOut' : 'animate-scaleIn'}`}>
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-clawd-border">
          <div className="w-10 h-10 rounded-full bg-teal-500/20 flex items-center justify-center text-xl">🎓</div>
          <div className="flex-1">
            <h2 className="font-bold text-clawd-text">HR — Agent Creator</h2>
            <p className="text-xs text-teal-400">Building your next team member</p>
          </div>
          {/* Stage indicator */}
          <div className="flex gap-1">
            {(['name', 'role', 'style', 'skills', 'personality', 'review'] as Stage[]).map((s, i) => (
              <div key={s} className={`w-2 h-2 rounded-full transition-colors ${
                stage === s ? 'bg-teal-400' : 
                (['name', 'role', 'style', 'skills', 'personality', 'review'].indexOf(stage) > i || stage === 'creating' || stage === 'done') 
                  ? 'bg-teal-400/40' : 'bg-clawd-border'
              }`} title={s} />
            ))}
          </div>
          <button onClick={handleClose} className="p-1 text-clawd-text-dim hover:text-clawd-text rounded-lg hover:bg-clawd-surface transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[300px]">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'hr' && (
                <div className="w-7 h-7 rounded-full bg-teal-500/20 flex items-center justify-center text-sm mr-2 flex-shrink-0 mt-0.5">🎓</div>
              )}
              <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm whitespace-pre-wrap ${
                msg.role === 'user' 
                  ? 'bg-blue-500/20 text-blue-100 rounded-br-md' 
                  : msg.role === 'system'
                    ? 'bg-clawd-surface text-clawd-text-dim italic text-xs'
                    : 'bg-clawd-surface text-clawd-text rounded-bl-md'
              }`}>
                {/* Render bold text */}
                {msg.content.split(/(\*\*[^*]+\*\*)/).map((part, j) => 
                  part.startsWith('**') && part.endsWith('**') 
                    ? <strong key={j} className="font-semibold">{part.slice(2, -2)}</strong>
                    : <span key={j}>{part}</span>
                )}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="w-7 h-7 rounded-full bg-teal-500/20 flex items-center justify-center text-sm mr-2">🎓</div>
              <div className="bg-clawd-surface px-4 py-2 rounded-xl">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-teal-400/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-teal-400/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-teal-400/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-3 border-t border-clawd-border">
          {stage === 'done' ? (
            <button onClick={handleClose}
              className="w-full py-2.5 bg-teal-500 text-white font-medium rounded-xl hover:bg-teal-600 transition-colors flex items-center justify-center gap-2">
              <Check size={16} /> Done — View Agents
            </button>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={stage === 'creating' ? 'Creating agent...' : 'Type your response...'}
                disabled={stage === 'creating'}
                className="flex-1 bg-clawd-surface border border-clawd-border rounded-xl px-3 py-2 text-sm text-clawd-text placeholder-clawd-text-dim focus:outline-none focus:border-teal-500/50 disabled:opacity-50"
                autoFocus
              />
              <button onClick={handleSend}
                disabled={!input.trim() || stage === 'creating'}
                className="p-2 bg-teal-500 text-white rounded-xl hover:bg-teal-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                {stage === 'creating' ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
