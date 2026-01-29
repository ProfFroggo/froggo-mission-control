import { useState, useEffect, useRef } from 'react';
import { MessageSquare, Upload, Edit3, User, Briefcase, Phone, Mail, MapPin, FileText, Sparkles, Loader2, Send, CheckCircle, AlertCircle } from 'lucide-react';
import { gateway } from '../lib/gateway';
import { useStore } from '../store/store';
import BaseModal, { BaseModalHeader, BaseModalBody, BaseModalFooter, BaseModalButton } from './BaseModal';

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ModalMode = 'dialogue' | 'upload' | 'manual';
type ContactType = 'personal' | 'professional';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface ExtractedContactData {
  name?: string;
  relationship?: string;
  role?: string;
  context?: string;
  email?: string;
  phone?: string;
  location?: string;
  company?: string;
  notes?: string;
  type?: ContactType;
}

interface ParsedEntity {
  name: string;
  relationship?: string;
  role?: string;
  context?: string;
  confidence: number;
}

export default function ContactModal({ isOpen, onClose }: ContactModalProps) {
  const { addTask } = useStore();
  
  // Mode selection
  const [mode, setMode] = useState<ModalMode>('dialogue');
  
  // Manual form state
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState('');
  const [role, setRole] = useState('');
  const [context, setContext] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [company, setCompany] = useState('');
  const [notes, setNotes] = useState('');
  const [contactType, setContactType] = useState<ContactType>('personal');

  // Dialogue mode state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [extractedData, setExtractedData] = useState<ExtractedContactData>({});
  const [conversationComplete, setConversationComplete] = useState(false);
  
  // Upload mode state
  const [uploadedContent, setUploadedContent] = useState('');
  const [parsedEntities, setParsedEntities] = useState<ParsedEntity[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<number | null>(null);

  // Status tracking
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [saveMessage, setSaveMessage] = useState('');
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      resetForm();
      if (mode === 'dialogue') {
        setChatMessages([{
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: "Hey! 🐸 Tell me about someone you'd like to add to your contacts. I can help you organize personal and professional relationships. Who should we add?",
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

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const contactData: ExtractedContactData = {
      name: name.trim(),
      relationship: relationship.trim() || undefined,
      role: role.trim() || undefined,
      context: context.trim() || undefined,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      location: location.trim() || undefined,
      company: company.trim() || undefined,
      notes: notes.trim() || undefined,
      type: contactType,
    };

    await saveContact(contactData);
  };

  const handleDialogueSubmit = async () => {
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
      const prompt = `${conversationHistory}\nuser: ${userMessage.content}\n\n---\n\nYou are Froggo 🐸, helping add a contact to the knowledge base. Have a natural conversation to gather:\n- Name (full name)\n- Relationship (family, friend, colleague, contact, client, etc)\n- Role/Title (if professional)\n- Context (how we know them, what they do, why they're important)\n- Contact info (email, phone, location if mentioned)\n- Company (if professional contact)\n- Any other relevant details\n\nAsk clarifying questions naturally. When you have enough info, output in this JSON format:\n\`\`\`json\n{"contact": {"name": "...", "relationship": "...", "role": "...", "context": "...", "email": "...", "phone": "...", "location": "...", "company": "...", "type": "personal|professional"}, "complete": true}\n\`\`\`\n\nBe conversational, friendly, and thorough.`;

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
          
          // Try to extract contact data
          const contactData = extractContactFromResponse(text || streamingContent);
          if (contactData) {
            setExtractedData(contactData);
            if (contactData.name) {
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

  const extractContactFromResponse = (response: string): ExtractedContactData | null => {
    const jsonMatch = response.match(/```json\s*(\{[\s\S]*?\})\s*```/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        if (parsed.contact && parsed.complete) {
          return parsed.contact;
        }
      } catch (e) {
        console.error('Failed to parse contact JSON:', e);
      }
    }
    return null;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file type
    if (!file.name.endsWith('.txt') && !file.name.endsWith('.md')) {
      setSaveStatus('error');
      setSaveMessage('Please upload a .txt or .md file');
      setTimeout(() => setSaveStatus('idle'), 3000);
      return;
    }

    // Read file content
    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      setUploadedContent(content);
      await parseEntitiesFromContent(content);
    };
    reader.readAsText(file);
  };

  const parseEntitiesFromContent = async (content: string) => {
    setIsParsing(true);
    setParsedEntities([]);

    try {
      // Use gateway to parse entities
      const prompt = `Parse the following text and extract all people/contacts mentioned. For each person, extract: name, relationship/role, and any context about them.

Text:
${content}

Return a JSON array of entities:
\`\`\`json
{"entities": [
  {"name": "...", "relationship": "...", "role": "...", "context": "...", "confidence": 0.9}
]}
\`\`\`

Be thorough but only include real people, not generic references.`;

      const unsubscribe = gateway.on('chat', (data: any) => {
        const text = data.message?.content?.[0]?.text || data.content || data.delta || '';
        
        if (data.state === 'final' || data._event === 'end') {
          setIsParsing(false);
          
          // Extract entities from response
          const jsonMatch = text.match(/```json\s*(\{[\s\S]*?\})\s*```/);
          if (jsonMatch) {
            try {
              const parsed = JSON.parse(jsonMatch[1]);
              if (parsed.entities && Array.isArray(parsed.entities)) {
                setParsedEntities(parsed.entities);
              }
            } catch (e) {
              console.error('Failed to parse entities:', e);
              setSaveStatus('error');
              setSaveMessage('Failed to parse file content');
              setTimeout(() => setSaveStatus('idle'), 3000);
            }
          }
          
          unsubscribe();
        }
      });

      await gateway.sendChatStreaming(prompt);

    } catch (error) {
      console.error('Parse error:', error);
      setIsParsing(false);
      setSaveStatus('error');
      setSaveMessage('Failed to parse file');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  const handleSaveFromUpload = async () => {
    if (selectedEntity === null || !parsedEntities[selectedEntity]) return;

    const entity = parsedEntities[selectedEntity];
    const contactData: ExtractedContactData = {
      name: entity.name,
      relationship: entity.relationship,
      role: entity.role,
      context: entity.context,
      type: entity.role ? 'professional' : 'personal',
    };

    await saveContact(contactData);
  };

  const handleCreateFromDialogue = async () => {
    if (!extractedData.name) return;
    await saveContact(extractedData);
  };

  const saveContact = async (contactData: ExtractedContactData) => {
    setSaveStatus('saving');
    setSaveMessage('Saving contact...');

    try {
      // Determine file location
      const fileName = contactData.type === 'professional' ? 'contacts.md' : 'people.md';
      const filePath = `memory/${fileName}`;

      // Format contact entry
      const timestamp = new Date().toISOString().split('T')[0];
      const entry = formatContactEntry(contactData, timestamp);

      // Append to file using IPC
      const result = await (window as any).clawdbot?.fs?.append(filePath, entry);
      
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to append to file');
      }

      // Add to knowledge graph
      await addToKnowledgeGraph(contactData);

      // Log fact to froggo-db
      await logContactFact(contactData);

      // Check if complex processing needed
      const needsComplexProcessing = checkIfComplexProcessing(contactData);
      if (needsComplexProcessing) {
        await createProcessingTask(contactData);
      }

      setSaveStatus('success');
      setSaveMessage(`✓ ${contactData.name} added to ${fileName}`);
      
      setTimeout(() => {
        resetForm();
        onClose();
      }, 2000);

    } catch (error) {
      console.error('Save error:', error);
      setSaveStatus('error');
      setSaveMessage('Failed to save contact');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  const formatContactEntry = (data: ExtractedContactData, timestamp: string): string => {
    let entry = `\n## ${data.name}\n`;
    entry += `*Added: ${timestamp}*\n\n`;
    
    if (data.relationship) entry += `- **Relationship:** ${data.relationship}\n`;
    if (data.role) entry += `- **Role:** ${data.role}\n`;
    if (data.company) entry += `- **Company:** ${data.company}\n`;
    if (data.email) entry += `- **Email:** ${data.email}\n`;
    if (data.phone) entry += `- **Phone:** ${data.phone}\n`;
    if (data.location) entry += `- **Location:** ${data.location}\n`;
    if (data.context) entry += `\n${data.context}\n`;
    if (data.notes) entry += `\n**Notes:** ${data.notes}\n`;
    
    entry += '\n---\n';
    return entry;
  };

  const addToKnowledgeGraph = async (data: ExtractedContactData) => {
    try {
      const result = await (window as any).clawdbot?.db?.exec(
        `INSERT INTO knowledge_nodes (type, name, description) VALUES (?, ?, ?)`,
        ['person', data.name, data.context || data.relationship || '']
      );
      console.log('[ContactModal] Added to knowledge graph:', result);
    } catch (error) {
      console.error('[ContactModal] Failed to add to knowledge graph:', error);
    }
  };

  const logContactFact = async (data: ExtractedContactData) => {
    try {
      const factText = `Contact: ${data.name}${data.relationship ? ` (${data.relationship})` : ''}${data.role ? ` - ${data.role}` : ''}${data.company ? ` at ${data.company}` : ''}`;
      const result = await (window as any).clawdbot?.db?.exec(
        `INSERT INTO facts (category, subject, content, source) VALUES (?, ?, ?, ?)`,
        ['person', data.name, factText, 'contact-modal']
      );
      console.log('[ContactModal] Logged fact:', result);
    } catch (error) {
      console.error('[ContactModal] Failed to log fact:', error);
    }
  };

  const checkIfComplexProcessing = (data: ExtractedContactData): boolean => {
    // Complex if has company but no role, or has extensive context, or missing key info
    const hasCompanyNoRole = !!data.company && !data.role;
    const hasExtensiveContext = (data.context?.length || 0) > 200;
    const missingInfo = !data.email && !data.phone;
    
    return hasCompanyNoRole || hasExtensiveContext || (missingInfo && !!data.company);
  };

  const createProcessingTask = async (data: ExtractedContactData) => {
    try {
      const title = `Research and complete contact info: ${data.name}`;
      const description = `Contact needs additional processing:\n- Company: ${data.company || 'N/A'}\n- Role: ${data.role || 'Missing'}\n- Email: ${data.email || 'Missing'}\n- Phone: ${data.phone || 'Missing'}\n\nResearch and complete the profile.`;
      
      addTask({
        title,
        description,
        project: 'Contacts',
        status: 'todo',
        priority: 'p2',
        assignedTo: 'researcher',
      });

      console.log('[ContactModal] Created processing task for', data.name);
    } catch (error) {
      console.error('[ContactModal] Failed to create task:', error);
    }
  };

  const resetForm = () => {
    setName('');
    setRelationship('');
    setRole('');
    setContext('');
    setEmail('');
    setPhone('');
    setLocation('');
    setCompany('');
    setNotes('');
    setContactType('personal');
    setChatMessages([]);
    setChatInput('');
    setExtractedData({});
    setConversationComplete(false);
    setUploadedContent('');
    setParsedEntities([]);
    setSelectedEntity(null);
    setSaveStatus('idle');
    setSaveMessage('');
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      maxHeight="90vh"
      ariaLabel="Add Contact / Person"
      closeButtonPosition="header"
      preventBackdropClose={saveStatus === 'saving'}
    >
      <BaseModalHeader
        title="Add Contact / Person"
        icon={<User size={24} className="text-clawd-accent" />}
        onClose={onClose}
      />

      {/* Mode Selector - Still in a custom section */}
      <div className="px-6 pt-6">
        <div className="flex gap-2">
            <button
              onClick={() => setMode('dialogue')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border transition-all ${
                mode === 'dialogue'
                  ? 'bg-clawd-accent text-white border-clawd-accent shadow-lg shadow-clawd-accent/20'
                  : 'bg-clawd-surface border-clawd-border hover:border-clawd-accent/50'
              }`}
            >
              <MessageSquare size={16} />
              <span className="font-medium">Dialogue</span>
              <Sparkles size={14} className={mode === 'dialogue' ? 'animate-pulse' : 'opacity-50'} />
            </button>
            <button
              onClick={() => setMode('upload')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border transition-all ${
                mode === 'upload'
                  ? 'bg-clawd-accent text-white border-clawd-accent shadow-lg shadow-clawd-accent/20'
                  : 'bg-clawd-surface border-clawd-border hover:border-clawd-accent/50'
              }`}
            >
              <Upload size={16} />
              <span className="font-medium">Upload</span>
            </button>
            <button
              onClick={() => setMode('manual')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border transition-all ${
                mode === 'manual'
                  ? 'bg-clawd-accent text-white border-clawd-accent shadow-lg shadow-clawd-accent/20'
                  : 'bg-clawd-surface border-clawd-border hover:border-clawd-accent/50'
              }`}
            >
              <Edit3 size={16} />
              <span className="font-medium">Manual</span>
            </button>
          </div>
        </div>

      {/* Content */}
      <BaseModalBody noPadding className="flex-1 min-h-0">
          {mode === 'dialogue' ? (
            // Dialogue Mode
            <div className="flex flex-col h-full">
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

              {/* Extracted Contact Preview */}
              {conversationComplete && extractedData.name && (
                <div className="px-6 pb-4">
                  <div className="bg-clawd-accent/10 border border-clawd-accent/30 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles size={16} className="text-clawd-accent" />
                      <span className="font-semibold text-sm">Contact Ready!</span>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div><strong>Name:</strong> {extractedData.name}</div>
                      {extractedData.relationship && <div><strong>Relationship:</strong> {extractedData.relationship}</div>}
                      {extractedData.role && <div><strong>Role:</strong> {extractedData.role}</div>}
                      {extractedData.company && <div><strong>Company:</strong> {extractedData.company}</div>}
                      {extractedData.email && <div><strong>Email:</strong> {extractedData.email}</div>}
                      {extractedData.context && <div><strong>Context:</strong> {extractedData.context.slice(0, 100)}...</div>}
                      <div><strong>Type:</strong> {extractedData.type === 'professional' ? '💼 Professional' : '👤 Personal'}</div>
                    </div>
                    <button
                      onClick={handleCreateFromDialogue}
                      disabled={saveStatus === 'saving'}
                      className="mt-3 w-full px-4 py-2 bg-clawd-accent text-white rounded-lg hover:bg-clawd-accent-dim transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {saveStatus === 'saving' ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <CheckCircle size={16} />
                          Save Contact
                        </>
                      )}
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
                        handleDialogueSubmit();
                      }
                    }}
                    placeholder="Tell me about this person..."
                    rows={2}
                    disabled={isStreaming || conversationComplete || saveStatus === 'saving'}
                    className="flex-1 bg-clawd-bg border border-clawd-border rounded-lg px-3 py-2 focus:outline-none focus:border-clawd-accent resize-none disabled:opacity-50"
                  />
                  <button
                    onClick={handleDialogueSubmit}
                    disabled={!chatInput.trim() || isStreaming || conversationComplete || saveStatus === 'saving'}
                    className="px-4 py-2 bg-clawd-accent text-white rounded-lg hover:bg-clawd-accent-dim transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isStreaming ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  </button>
                </div>
              </div>
            </div>
          ) : mode === 'upload' ? (
            // Upload Mode
            <div className="p-6 space-y-4 overflow-y-auto h-full">
              <div className="text-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.md"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="mx-auto flex items-center gap-2 px-6 py-3 bg-clawd-surface border border-clawd-border rounded-xl hover:border-clawd-accent/50 transition-colors"
                >
                  <Upload size={20} />
                  <span>Upload Text/Markdown File</span>
                </button>
                <p className="text-xs text-clawd-text-dim mt-2">
                  Upload a .txt or .md file containing contact information
                </p>
              </div>

              {uploadedContent && (
                <div className="bg-clawd-surface border border-clawd-border rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText size={16} className="text-clawd-accent" />
                    <span className="font-semibold text-sm">Uploaded Content</span>
                  </div>
                  <div className="text-xs text-clawd-text-dim max-h-32 overflow-y-auto">
                    {uploadedContent.slice(0, 500)}...
                  </div>
                </div>
              )}

              {isParsing && (
                <div className="flex items-center justify-center gap-2 py-8">
                  <Loader2 size={24} className="animate-spin text-clawd-accent" />
                  <span className="text-clawd-text-dim">Parsing entities...</span>
                </div>
              )}

              {parsedEntities.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <User size={16} className="text-clawd-accent" />
                    Found {parsedEntities.length} {parsedEntities.length === 1 ? 'Contact' : 'Contacts'}
                  </h3>
                  <div className="space-y-2">
                    {parsedEntities.map((entity, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedEntity(idx)}
                        className={`w-full text-left p-4 rounded-xl border transition-all ${
                          selectedEntity === idx
                            ? 'border-clawd-accent bg-clawd-accent/10'
                            : 'border-clawd-border hover:border-clawd-accent/50'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="font-semibold">{entity.name}</div>
                            {entity.relationship && (
                              <div className="text-sm text-clawd-text-dim">{entity.relationship}</div>
                            )}
                            {entity.role && (
                              <div className="text-xs text-clawd-accent mt-1">{entity.role}</div>
                            )}
                            {entity.context && (
                              <div className="text-xs text-clawd-text-dim mt-1 line-clamp-2">
                                {entity.context}
                              </div>
                            )}
                          </div>
                          <div className="text-xs text-clawd-text-dim ml-4">
                            {Math.round(entity.confidence * 100)}% confidence
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>

                  {selectedEntity !== null && (
                    <button
                      onClick={handleSaveFromUpload}
                      disabled={saveStatus === 'saving'}
                      className="w-full mt-4 px-4 py-3 bg-clawd-accent text-white rounded-lg hover:bg-clawd-accent-dim transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {saveStatus === 'saving' ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <CheckCircle size={16} />
                          Save Selected Contact
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            // Manual Mode
            <form onSubmit={handleManualSubmit} className="p-6 space-y-4 overflow-y-auto h-full">
              {/* Contact Type */}
              <div>
                <label className="block text-sm text-clawd-text-dim mb-2">Contact Type</label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setContactType('personal')}
                    className={`flex-1 p-3 rounded-lg border text-sm flex items-center justify-center gap-2 transition-colors ${
                      contactType === 'personal'
                        ? 'border-clawd-accent bg-clawd-accent/10 text-clawd-accent'
                        : 'border-clawd-border hover:border-clawd-accent/50'
                    }`}
                  >
                    <User size={16} />
                    Personal
                  </button>
                  <button
                    type="button"
                    onClick={() => setContactType('professional')}
                    className={`flex-1 p-3 rounded-lg border text-sm flex items-center justify-center gap-2 transition-colors ${
                      contactType === 'professional'
                        ? 'border-clawd-accent bg-clawd-accent/10 text-clawd-accent'
                        : 'border-clawd-border hover:border-clawd-accent/50'
                    }`}
                  >
                    <Briefcase size={16} />
                    Professional
                  </button>
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm text-clawd-text-dim mb-1">Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Full name"
                  className="w-full bg-clawd-bg border border-clawd-border rounded-lg px-3 py-2 focus:outline-none focus:border-clawd-accent"
                  autoFocus
                />
              </div>

              {/* Relationship & Role */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-clawd-text-dim mb-1">Relationship</label>
                  <input
                    type="text"
                    value={relationship}
                    onChange={e => setRelationship(e.target.value)}
                    placeholder="friend, colleague, client..."
                    className="w-full bg-clawd-bg border border-clawd-border rounded-lg px-3 py-2 focus:outline-none focus:border-clawd-accent"
                  />
                </div>
                <div>
                  <label className="block text-sm text-clawd-text-dim mb-1">Role/Title</label>
                  <input
                    type="text"
                    value={role}
                    onChange={e => setRole(e.target.value)}
                    placeholder="CEO, Engineer, Designer..."
                    className="w-full bg-clawd-bg border border-clawd-border rounded-lg px-3 py-2 focus:outline-none focus:border-clawd-accent"
                  />
                </div>
              </div>

              {/* Company & Location */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-clawd-text-dim mb-1 flex items-center gap-1">
                    <Briefcase size={14} /> Company
                  </label>
                  <input
                    type="text"
                    value={company}
                    onChange={e => setCompany(e.target.value)}
                    placeholder="Company name"
                    className="w-full bg-clawd-bg border border-clawd-border rounded-lg px-3 py-2 focus:outline-none focus:border-clawd-accent"
                  />
                </div>
                <div>
                  <label className="block text-sm text-clawd-text-dim mb-1 flex items-center gap-1">
                    <MapPin size={14} /> Location
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                    placeholder="City, Country"
                    className="w-full bg-clawd-bg border border-clawd-border rounded-lg px-3 py-2 focus:outline-none focus:border-clawd-accent"
                  />
                </div>
              </div>

              {/* Email & Phone */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-clawd-text-dim mb-1 flex items-center gap-1">
                    <Mail size={14} /> Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="email@example.com"
                    className="w-full bg-clawd-bg border border-clawd-border rounded-lg px-3 py-2 focus:outline-none focus:border-clawd-accent"
                  />
                </div>
                <div>
                  <label className="block text-sm text-clawd-text-dim mb-1 flex items-center gap-1">
                    <Phone size={14} /> Phone
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+1234567890"
                    className="w-full bg-clawd-bg border border-clawd-border rounded-lg px-3 py-2 focus:outline-none focus:border-clawd-accent"
                  />
                </div>
              </div>

              {/* Context */}
              <div>
                <label className="block text-sm text-clawd-text-dim mb-1">Context</label>
                <textarea
                  value={context}
                  onChange={e => setContext(e.target.value)}
                  placeholder="How you know them, what they do, why they're important..."
                  rows={3}
                  className="w-full bg-clawd-bg border border-clawd-border rounded-lg px-3 py-2 focus:outline-none focus:border-clawd-accent resize-none"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm text-clawd-text-dim mb-1">Notes</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Any additional notes or details..."
                  rows={2}
                  className="w-full bg-clawd-bg border border-clawd-border rounded-lg px-3 py-2 focus:outline-none focus:border-clawd-accent resize-none"
                />
              </div>

              {/* Submit Footer - inside form */}
              <BaseModalFooter>
                <BaseModalButton onClick={onClose} disabled={saveStatus === 'saving'}>
                  Cancel
                </BaseModalButton>
                <BaseModalButton
                  variant="primary"
                  type="submit"
                  disabled={!name.trim() || saveStatus === 'saving'}
                  loading={saveStatus === 'saving'}
                  icon={saveStatus !== 'saving' ? <CheckCircle size={16} /> : undefined}
                >
                  {saveStatus === 'saving' ? 'Saving...' : 'Save Contact'}
                </BaseModalButton>
              </BaseModalFooter>
            </form>
          )}
        </BaseModalBody>

        {/* Status Message - Positioned absolutely over modal */}
        {saveStatus !== 'idle' && (
          <div className={`absolute bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded-xl shadow-lg flex items-center gap-2 z-10 ${
            saveStatus === 'success' ? 'bg-green-500/20 border border-green-500/50 text-green-400' :
            saveStatus === 'error' ? 'bg-red-500/20 border border-red-500/50 text-red-400' :
            'bg-clawd-surface border border-clawd-border'
          }`}>
            {saveStatus === 'success' ? <CheckCircle size={16} /> :
             saveStatus === 'error' ? <AlertCircle size={16} /> :
             <Loader2 size={16} className="animate-spin" />}
            <span className="text-sm font-medium">{saveMessage}</span>
          </div>
        )}
      </BaseModal>
  );
}
