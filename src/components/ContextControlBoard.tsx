import { useState, useEffect, useCallback } from 'react';
import { Brain, FileText, Bot, Sparkles, Edit3, Save, Plus, MessageSquare, ChevronRight, Book, User, Wrench } from 'lucide-react';
import { showToast } from './Toast';
import SkillsTab from './SkillsTab';
import NodesTab from './NodesTab';

interface ContextFile {
  name: string;
  path: string;
  icon: any;
  description: string;
  content?: string;
}

interface Skill {
  name: string;
  description: string;
  location: string;
  enabled: boolean;
}

interface Agent {
  id: string;
  name: string;
  role: string;
  model: string;
  status: 'active' | 'idle' | 'disabled';
}

const contextFiles: ContextFile[] = [
  { name: 'SOUL.md', path: '/Users/worker/clawd/SOUL.md', icon: Brain, description: 'Personality and identity' },
  { name: 'MEMORY.md', path: '/Users/worker/clawd/MEMORY.md', icon: Book, description: 'Long-term memories' },
  { name: 'USER.md', path: '/Users/worker/clawd/USER.md', icon: User, description: 'User information' },
  { name: 'AGENTS.md', path: '/Users/worker/clawd/AGENTS.md', icon: Bot, description: 'Agent system config' },
  { name: 'TOOLS.md', path: '/Users/worker/clawd/TOOLS.md', icon: Wrench, description: 'Tool notes' },
];

export default function ContextControlBoard() {
  const [activeTab, setActiveTab] = useState<'context' | 'skills' | 'agents' | 'chat' | 'nodes'>('context');
  const [selectedFile, setSelectedFile] = useState<ContextFile | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [_skills, setSkills] = useState<Skill[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<{ role: string; content: string }[]>([]);

  const loadFile = useCallback(async (file: ContextFile) => {
    setSelectedFile(file);
    setLoading(true);
    try {
      if (!(window as any).clawdbot) {
        showToast('error', 'API not ready', 'Clawdbot APIs not available');
        setLoading(false);
        return;
      }
      const result = await (window as any).clawdbot?.exec?.run(`cat "${file.path}" 2>/dev/null || echo "File not found"`);
      const content = result?.stdout || '';
      setFileContent(content);
      setOriginalContent(content);
      setEditing(false);
    } catch (e) {
      showToast('error', 'Failed to load file', String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const saveFile = async () => {
    if (!selectedFile) return;
    setSaving(true);
    try {
      // Escape content for shell
  //     const __escaped = fileContent.replace(/'/g, "'\\''");
      await (window as any).clawdbot?.exec?.run(`cat > "${selectedFile.path}" << 'EOFCONTENTMARKER'\n${fileContent}\nEOFCONTENTMARKER`);
      setOriginalContent(fileContent);
      setEditing(false);
      showToast('success', 'Saved', selectedFile.name);
    } catch (e) {
      showToast('error', 'Failed to save', String(e));
    } finally {
      setSaving(false);
    }
  };

  const loadSkills = useCallback(async () => {
    setLoading(true);
    try {
      // List skills from skill directory
      const result = await (window as any).clawdbot?.exec?.run(
        'ls -1 /opt/homebrew/lib/node_modules/clawdbot/skills 2>/dev/null || echo ""'
      );
      if (result?.stdout) {
        const skillNames = result.stdout.trim().split('\n').filter(Boolean);
        const loadedSkills: Skill[] = skillNames.map((name: string) => ({
          name,
          description: '',
          location: `/opt/homebrew/lib/node_modules/clawdbot/skills/${name}/SKILL.md`,
          enabled: true,
        }));
        setSkills(loadedSkills);
      }
    } catch (e) {
      console.error('Failed to load skills:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAgents = useCallback(async () => {
    setLoading(true);
    try {
      // Load from agents directory
      const result = await (window as any).clawdbot?.exec?.run(
        'ls -1 ~/clawd/agents 2>/dev/null || echo ""'
      );
      if (result?.stdout) {
        const agentDirs = result.stdout.trim().split('\n').filter(Boolean);
        const loadedAgents: Agent[] = agentDirs.map((dir: string) => ({
          id: dir,
          name: dir.charAt(0).toUpperCase() + dir.slice(1).replace(/-/g, ' '),
          role: 'Custom Agent',
          model: 'claude-sonnet',
          status: 'idle' as const,
        }));
        setAgents(loadedAgents);
      }
    } catch (e) {
      console.error('Failed to load agents:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'skills') loadSkills();
    if (activeTab === 'agents') loadAgents();
  }, [activeTab, loadSkills, loadAgents]);

  const handleChat = async () => {
    if (!chatMessage.trim()) return;
    const userMessage = chatMessage;
    setChatMessage('');
    setChatHistory(prev => [...prev, { role: 'user', content: userMessage }]);
    
    try {
      // Send to gateway with context focus
      const response = await fetch('http://localhost:18789/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `[CONTEXT_DISCUSSION] ${userMessage}`,
          sessionKey: 'web:context-board',
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setChatHistory(prev => [...prev, { role: 'assistant', content: data.reply || 'No response' }]);
      }
    } catch (e) {
      setChatHistory(prev => [...prev, { role: 'assistant', content: 'Failed to get response' }]);
    }
  };

  const hasChanges = fileContent !== originalContent;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-clawd-border bg-clawd-surface">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-purple-500/20 rounded-xl">
            <Sparkles size={24} className="text-purple-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Context Control</h1>
            <p className="text-sm text-clawd-text-dim">
              Manage AI personality, memory, skills, and agents
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {(['context', 'skills', 'agents', 'nodes', 'chat'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-clawd-accent text-white'
                  : 'bg-clawd-border text-clawd-text-dim hover:text-clawd-text'
              }`}
            >
              {tab === 'context' && '📁 Context Files'}
              {tab === 'skills' && '🛠️ Skills'}
              {tab === 'agents' && '🤖 Agents'}
              {tab === 'nodes' && '📡 Nodes'}
              {tab === 'chat' && '💬 Chat'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex">
        {/* Context Files Tab */}
        {activeTab === 'context' && (
          <>
            {/* File List */}
            <div className="w-64 border-r border-clawd-border bg-clawd-bg p-4">
              <div className="text-xs text-clawd-text-dim uppercase tracking-wide mb-3">Context Files</div>
              <div className="space-y-1">
                {contextFiles.map((file) => {
                  const Icon = file.icon;
                  const isSelected = selectedFile?.name === file.name;
                  return (
                    <button
                      key={file.name}
                      onClick={() => loadFile(file)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors ${
                        isSelected ? 'bg-clawd-accent/10 border border-clawd-accent/30' : 'hover:bg-clawd-border'
                      }`}
                    >
                      <Icon size={16} className={isSelected ? 'text-clawd-accent' : 'text-clawd-text-dim'} />
                      <div>
                        <div className="text-sm font-medium">{file.name}</div>
                        <div className="text-xs text-clawd-text-dim">{file.description}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* File Editor */}
            <div className="flex-1 flex flex-col">
              {selectedFile ? (
                <>
                  <div className="p-4 border-b border-clawd-border flex items-center justify-between bg-clawd-surface">
                    <div className="flex items-center gap-2">
                      <FileText size={16} className="text-clawd-accent" />
                      <span className="font-medium">{selectedFile.name}</span>
                      {hasChanges && <span className="text-xs text-yellow-400">• Unsaved</span>}
                    </div>
                    <div className="flex gap-2">
                      {editing ? (
                        <>
                          <button
                            onClick={() => { setFileContent(originalContent); setEditing(false); }}
                            className="px-3 py-1.5 text-sm text-clawd-text-dim hover:text-clawd-text"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={saveFile}
                            disabled={saving || !hasChanges}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-clawd-accent text-white rounded-lg text-sm disabled:opacity-50"
                          >
                            <Save size={14} />
                            {saving ? 'Saving...' : 'Save'}
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setEditing(true)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-clawd-border text-clawd-text rounded-lg text-sm hover:bg-clawd-border/80"
                        >
                          <Edit3 size={14} />
                          Edit
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex-1 overflow-auto p-4 bg-clawd-bg">
                    {loading ? (
                      <div className="flex items-center justify-center h-full text-clawd-text-dim">Loading...</div>
                    ) : editing ? (
                      <textarea
                        value={fileContent}
                        onChange={(e) => setFileContent(e.target.value)}
                        className="w-full h-full bg-transparent font-mono text-sm resize-none focus:outline-none"
                        spellCheck={false}
                      />
                    ) : (
                      <pre className="font-mono text-sm whitespace-pre-wrap">{fileContent}</pre>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-clawd-text-dim">
                  Select a file to view or edit
                </div>
              )}
            </div>
          </>
        )}

        {/* Skills Tab */}
        {activeTab === 'skills' && <SkillsTab />}

        {/* Nodes Tab */}
        {activeTab === 'nodes' && <NodesTab />}

        {/* Agents Tab */}
        {activeTab === 'agents' && (
          <div className="flex-1 overflow-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-clawd-text-dim">{agents.length} agents configured</div>
              <button 
                onClick={() => showToast('info', 'Create agent feature coming soon')}
                className="flex items-center gap-2 px-3 py-1.5 bg-clawd-accent text-white rounded-lg text-sm"
              >
                <Plus size={14} />
                New Agent
              </button>
            </div>
            <div className="space-y-3">
              {agents.map((agent) => (
                <div
                  key={agent.id}
                  className="p-4 bg-clawd-surface border border-clawd-border rounded-xl flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-clawd-border rounded-full flex items-center justify-center">
                      <Bot size={20} className="text-clawd-text-dim" />
                    </div>
                    <div>
                      <div className="font-medium">{agent.name}</div>
                      <div className="text-sm text-clawd-text-dim">{agent.role} • {agent.model}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      agent.status === 'active' ? 'bg-green-500/20 text-green-400' :
                      agent.status === 'idle' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {agent.status}
                    </span>
                    <ChevronRight size={16} className="text-clawd-text-dim" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Chat Tab */}
        {activeTab === 'chat' && (
          <div className="flex-1 flex flex-col">
            <div className="flex-1 overflow-auto p-6">
              {chatHistory.length === 0 ? (
                <div className="text-center text-clawd-text-dim py-12">
                  <MessageSquare size={48} className="mx-auto opacity-20 mb-4" />
                  <p>Chat about context, memory, or agent configuration</p>
                  <p className="text-sm">e.g., "Update SOUL.md to be more casual"</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {chatHistory.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] p-3 rounded-xl ${
                        msg.role === 'user' 
                          ? 'bg-clawd-accent text-white' 
                          : 'bg-clawd-surface border border-clawd-border'
                      }`}>
                        {msg.content}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-clawd-border bg-clawd-surface">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleChat()}
                  placeholder="Ask about context configuration..."
                  className="flex-1 bg-clawd-bg border border-clawd-border rounded-xl px-4 py-2 focus:outline-none focus:border-clawd-accent"
                />
                <button
                  onClick={handleChat}
                  disabled={!chatMessage.trim()}
                  className="px-4 py-2 bg-clawd-accent text-white rounded-xl disabled:opacity-50"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
