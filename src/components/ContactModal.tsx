import { useState, useEffect, useRef } from 'react';
import { MessageSquare, Upload, Edit3, User, Briefcase, Phone, Mail, MapPin, FileText, Sparkles, Send, CheckCircle, AlertCircle } from 'lucide-react';
import { Button, IconButton, Spinner, TextArea, TextField, Flex } from '@radix-ui/themes';
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
  const focusTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const statusTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      resetForm();
      if (mode === 'dialogue') {
        setChatMessages([{
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: "Hey! Tell me about someone you'd like to add to your contacts. I can help you organize personal and professional relationships. Who should we add?",
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
      focusTimeoutRef.current = setTimeout(() => inputRef.current?.focus(), 100);
    }
    return () => {
      if (focusTimeoutRef.current) {
        clearTimeout(focusTimeoutRef.current);
      }
    };
  }, [isOpen, mode]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (focusTimeoutRef.current) clearTimeout(focusTimeoutRef.current);
      if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
    };
  }, []);

  // Helper to set status with auto-clear
  const setStatusWithTimeout = (status: 'idle' | 'saving' | 'success' | 'error', delay = 3000) => {
    if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
    setSaveStatus(status);
    if (status !== 'idle' && status !== 'saving') {
      statusTimeoutRef.current = setTimeout(() => setSaveStatus('idle'), delay);
    }
  };

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
      const prompt = `${conversationHistory}\nuser: ${userMessage.content}\n\n---\n\nYou are Mission Control, helping add a contact to the knowledge base. Have a natural conversation to gather:\n- Name (full name)\n- Relationship (family, friend, colleague, contact, client, etc)\n- Role/Title (if professional)\n- Context (how we know them, what they do, why they're important)\n- Contact info (email, phone, location if mentioned)\n- Company (if professional contact)\n- Any other relevant details\n\nAsk clarifying questions naturally. When you have enough info, output in this JSON format:\n\`\`\`json\n{"contact": {"name": "...", "relationship": "...", "role": "...", "context": "...", "email": "...", "phone": "...", "location": "...", "company": "...", "type": "personal|professional"}, "complete": true}\n\`\`\`\n\nBe conversational, friendly, and thorough.`;

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

  const extractContactFromResponse = (response: string): ExtractedContactData | null => {
    const jsonMatch = response.match(/```json\s*(\{[\s\S]*?\})\s*```/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        if (parsed.contact && parsed.complete) {
          return parsed.contact;
        }
      } catch (e) {
        // 'Failed to parse contact JSON:', e;
      }
    }
    return null;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file type
    if (!file.name.endsWith('.txt') && !file.name.endsWith('.md')) {
      setStatusWithTimeout('error');
      setSaveMessage('Please upload a .txt or .md file');
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
              // 'Failed to parse entities:', e;
              setStatusWithTimeout('error');
              setSaveMessage('Failed to parse file content');
            }
          }
          
          unsubscribe();
        }
      });

      await gateway.sendChatStreaming(prompt);

    } catch (error) {
      // 'Parse error:', error;
      setIsParsing(false);
      setStatusWithTimeout('error');
      setSaveMessage('Failed to parse file');
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

      // Append to file via REST API
      const appendRes = await fetch('/api/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'append', path: filePath, content: entry }),
      });
      if (!appendRes.ok) {
        throw new Error('Failed to append to file');
      }

      // Add to knowledge graph
      await addToKnowledgeGraph(contactData);

      // Log fact to mission-control-db
      await logContactFact(contactData);

      // Check if complex processing needed
      const needsComplexProcessing = checkIfComplexProcessing(contactData);
      if (needsComplexProcessing) {
        await createProcessingTask(contactData);
      }

      setSaveStatus('success');
      setSaveMessage(`✓ ${contactData.name} added to ${fileName}`);
      
      statusTimeoutRef.current = setTimeout(() => {
        resetForm();
        onClose();
      }, 2000);

    } catch (error) {
      // 'Save error:', error;
      setStatusWithTimeout('error');
      setSaveMessage('Failed to save contact');
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
      await fetch('/api/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'db-exec',
          sql: 'INSERT INTO knowledge_nodes (type, name, description) VALUES (?, ?, ?)',
          params: ['person', data.name, data.context || data.relationship || ''],
        }),
      });
    } catch (error) {
      // '[ContactModal] Failed to add to knowledge graph:', error;
    }
  };

  const logContactFact = async (data: ExtractedContactData) => {
    try {
      const factText = `Contact: ${data.name}${data.relationship ? ` (${data.relationship})` : ''}${data.role ? ` - ${data.role}` : ''}${data.company ? ` at ${data.company}` : ''}`;
      await fetch('/api/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'db-exec',
          sql: 'INSERT INTO facts (category, subject, content, source) VALUES (?, ?, ?, ?)',
          params: ['person', data.name, factText, 'contact-modal'],
        }),
      });
    } catch (error) {
      // '[ContactModal] Failed to log fact:', error;
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
    } catch (error) {
      // '[ContactModal] Failed to create task:', error;
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
        icon={<User size={24} className="text-[--accent-11]" />}
        onClose={onClose}
      />

      {/* Mode Selector */}
      <div className="px-6 pt-6">
        <div className="flex items-center gap-0.5 p-1 rounded-lg bg-mission-control-bg border border-mission-control-border">
          <button type="button" onClick={() => setMode('dialogue')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex-1 justify-center ${
              mode === 'dialogue' ? 'bg-mission-control-accent/10 text-mission-control-accent' : 'text-mission-control-text-dim hover:text-mission-control-text'
            }`}>
            <MessageSquare size={16} />
            <span className="font-medium">Dialogue</span>
            <Sparkles size={14} className={mode === 'dialogue' ? 'animate-pulse' : 'opacity-50'} />
          </button>
          <button type="button" onClick={() => setMode('upload')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex-1 justify-center ${
              mode === 'upload' ? 'bg-mission-control-accent/10 text-mission-control-accent' : 'text-mission-control-text-dim hover:text-mission-control-text'
            }`}>
            <Upload size={16} />
            <span className="font-medium">Upload</span>
          </button>
          <button type="button" onClick={() => setMode('manual')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex-1 justify-center ${
              mode === 'manual' ? 'bg-mission-control-accent/10 text-mission-control-accent' : 'text-mission-control-text-dim hover:text-mission-control-text'
            }`}>
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
                  <Flex
                    key={msg.id}
                    className={msg.role === 'user' ? 'justify-end' : 'justify-start'}
                  >
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

              {/* Extracted Contact Preview */}
              {conversationComplete && extractedData.name && (
                <div className="px-6 pb-4">
                  <div className="bg-[--accent-3] border border-[--accent-6] rounded-2xl p-4">
                    <Flex align="center" gap="2" className="mb-2">
                      <Sparkles size={16} className="text-[--accent-11]" />
                      <span className="font-semibold text-sm">Contact Ready!</span>
                    </Flex>
                    <div className="space-y-1 text-sm">
                      <div><strong>Name:</strong> {extractedData.name}</div>
                      {extractedData.relationship && <div><strong>Relationship:</strong> {extractedData.relationship}</div>}
                      {extractedData.role && <div><strong>Role:</strong> {extractedData.role}</div>}
                      {extractedData.company && <div><strong>Company:</strong> {extractedData.company}</div>}
                      {extractedData.email && <div><strong>Email:</strong> {extractedData.email}</div>}
                      {extractedData.context && <div><strong>Context:</strong> {extractedData.context.slice(0, 100)}...</div>}
                      <Flex align="center" gap="1"><strong>Type:</strong> {extractedData.type === 'professional' ? <span className="inline-flex items-center gap-1"><Briefcase size={14} /> Professional</span> : <span className="inline-flex items-center gap-1"><User size={14} /> Personal</span>}</Flex>
                    </div>
                    <Button
                      onClick={handleCreateFromDialogue}
                      disabled={saveStatus === 'saving'}
                      variant="solid"
                      color="violet"
                      size="2"
                      className="mt-3 w-full"
                    >
                      {saveStatus === 'saving' ? (
                        <><Spinner /> Saving...</>
                      ) : (
                        <><CheckCircle size={16} /> Save Contact</>
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* Chat Input */}
              <div className="p-6 border-t border-mission-control-border">
                <Flex gap="3">
                  <TextArea
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
                    aria-label="Chat message input"
                    rows={2}
                    disabled={isStreaming || conversationComplete || saveStatus === 'saving'}
                    size="2"
                    className="flex-1 resize-none"
                  />
                  <IconButton
                    onClick={handleDialogueSubmit}
                    disabled={!chatInput.trim() || isStreaming || conversationComplete || saveStatus === 'saving'}
                    variant="solid"
                    color="violet"
                    size="3"
                  >
                    {isStreaming ? <Spinner /> : <Send size={16} />}
                  </IconButton>
                </Flex>
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
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  variant="soft"
                  color="gray"
                  size="3"
                >
                  <Upload size={20} />
                  <span>Upload Text/Markdown File</span>
                </Button>
                <p className="text-xs text-mission-control-text-dim mt-2">
                  Upload a .txt or .md file containing contact information
                </p>
              </div>

              {uploadedContent && (
                <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl p-4">
                  <Flex align="center" gap="2" className="mb-2">
                    <FileText size={16} className="text-[--accent-11]" />
                    <span className="font-semibold text-sm">Uploaded Content</span>
                  </Flex>
                  <div className="text-xs text-mission-control-text-dim max-h-32 overflow-y-auto">
                    {uploadedContent.slice(0, 500)}...
                  </div>
                </div>
              )}

              {isParsing && (
                <Flex align="center" justify="center" gap="2" className="py-8">
                  <Spinner size="3" />
                  <span className="text-mission-control-text-dim">Parsing entities...</span>
                </Flex>
              )}

              {parsedEntities.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <User size={16} className="text-[--accent-11]" />
                    Found {parsedEntities.length} {parsedEntities.length === 1 ? 'Contact' : 'Contacts'}
                  </h3>
                  <div className="space-y-2">
                    {parsedEntities.map((entity, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedEntity(idx)}
                        className={`w-full text-left p-4 rounded-lg border transition-colors ${
                          selectedEntity === idx
                            ? 'border-[--accent-9] bg-[--accent-3]'
                            : 'border-mission-control-border hover:border-[--accent-8]/50'
                        }`}
                      >
                        <Flex align="start" justify="between">
                          <div className="flex-1">
                            <div className="font-semibold">{entity.name}</div>
                            {entity.relationship && (
                              <div className="text-sm text-mission-control-text-dim">{entity.relationship}</div>
                            )}
                            {entity.role && (
                              <div className="text-xs text-[--accent-11] mt-1">{entity.role}</div>
                            )}
                            {entity.context && (
                              <div className="text-xs text-mission-control-text-dim mt-1 line-clamp-2">
                                {entity.context}
                              </div>
                            )}
                          </div>
                          <div className="text-xs text-mission-control-text-dim ml-4">
                            {Math.round(entity.confidence * 100)}% confidence
                          </div>
                        </Flex>
                      </button>
                    ))}
                  </div>

                  {selectedEntity !== null && (
                    <Button
                      onClick={handleSaveFromUpload}
                      disabled={saveStatus === 'saving'}
                      variant="solid"
                      color="violet"
                      size="3"
                      className="w-full mt-4"
                    >
                      {saveStatus === 'saving' ? (
                        <><Spinner /> Saving...</>
                      ) : (
                        <><CheckCircle size={16} /> Save Selected Contact</>
                      )}
                    </Button>
                  )}
                </div>
              )}
            </div>
          ) : (
            // Manual Mode
            <form onSubmit={handleManualSubmit} className="p-6 space-y-4 overflow-y-auto h-full">
              {/* Contact Type */}
              <div role="group" aria-labelledby="contact-type-label">
                <span id="contact-type-label" className="block text-sm text-mission-control-text-dim mb-2">Contact Type</span>
                <div className="flex items-center gap-0.5 p-1 rounded-lg bg-mission-control-bg border border-mission-control-border" role="radiogroup" aria-label="Contact type selection">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={contactType === 'personal'}
                    onClick={() => setContactType('personal')}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex-1 justify-center ${
                      contactType === 'personal' ? 'bg-mission-control-accent/10 text-mission-control-accent' : 'text-mission-control-text-dim hover:text-mission-control-text'
                    }`}
                  >
                    <User size={16} />
                    Personal
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={contactType === 'professional'}
                    onClick={() => setContactType('professional')}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex-1 justify-center ${
                      contactType === 'professional' ? 'bg-mission-control-accent/10 text-mission-control-accent' : 'text-mission-control-text-dim hover:text-mission-control-text'
                    }`}
                  >
                    <Briefcase size={16} />
                    Professional
                  </button>
                </div>
              </div>

              {/* Name */}
              <div>
                <label htmlFor="contact-name" className="block text-sm text-mission-control-text-dim mb-1">Name *</label>
                <TextField.Root
                  id="contact-name"
                  size="2"
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Full name"
                  aria-label="Contact name"
                  className="w-full"
                />
              </div>

              {/* Relationship & Role */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="contact-relationship" className="block text-sm text-mission-control-text-dim mb-1">Relationship</label>
                  <TextField.Root
                    id="contact-relationship"
                    size="2"
                    type="text"
                    value={relationship}
                    onChange={e => setRelationship(e.target.value)}
                    placeholder="friend, colleague, client..."
                    aria-label="Contact relationship"
                    className="w-full"
                  />
                </div>
                <div>
                  <label htmlFor="contact-role" className="block text-sm text-mission-control-text-dim mb-1">Role/Title</label>
                  <TextField.Root
                    id="contact-role"
                    size="2"
                    type="text"
                    value={role}
                    onChange={e => setRole(e.target.value)}
                    placeholder="CEO, Engineer, Designer..."
                    aria-label="Contact role or title"
                    className="w-full"
                  />
                </div>
              </div>

              {/* Company & Location */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="contact-company" className="block text-sm text-mission-control-text-dim mb-1 flex items-center gap-1">
                    <Briefcase size={14} /> Company
                  </label>
                  <TextField.Root
                    id="contact-company"
                    size="2"
                    type="text"
                    value={company}
                    onChange={e => setCompany(e.target.value)}
                    placeholder="Company name"
                    aria-label="Contact company"
                    className="w-full"
                  />
                </div>
                <div>
                  <label htmlFor="contact-location" className="block text-sm text-mission-control-text-dim mb-1 flex items-center gap-1">
                    <MapPin size={14} /> Location
                  </label>
                  <TextField.Root
                    id="contact-location"
                    size="2"
                    type="text"
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                    placeholder="City, Country"
                    aria-label="Contact location"
                    className="w-full"
                  />
                </div>
              </div>

              {/* Email & Phone */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="contact-email" className="block text-sm text-mission-control-text-dim mb-1 flex items-center gap-1">
                    <Mail size={14} /> Email
                  </label>
                  <TextField.Root
                    id="contact-email"
                    size="2"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="email@example.com"
                    aria-label="Contact email"
                    className="w-full"
                  />
                </div>
                <div>
                  <label htmlFor="contact-phone" className="block text-sm text-mission-control-text-dim mb-1 flex items-center gap-1">
                    <Phone size={14} /> Phone
                  </label>
                  <TextField.Root
                    id="contact-phone"
                    size="2"
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+1234567890"
                    aria-label="Contact phone"
                    className="w-full"
                  />
                </div>
              </div>

              {/* Context */}
              <div>
                <label htmlFor="contact-context" className="block text-sm text-mission-control-text-dim mb-1">Context</label>
                <TextArea
                  id="contact-context"
                  value={context}
                  onChange={e => setContext(e.target.value)}
                  placeholder="How you know them, what they do, why they're important..."
                  aria-label="Contact context"
                  rows={3}
                  size="2"
                  className="w-full resize-none"
                />
              </div>

              {/* Notes */}
              <div>
                <label htmlFor="contact-notes" className="block text-sm text-mission-control-text-dim mb-1">Notes</label>
                <TextArea
                  id="contact-notes"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Any additional notes or details..."
                  aria-label="Contact notes"
                  rows={2}
                  size="2"
                  className="w-full resize-none"
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
          <div className={`absolute bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 z-10 ${
            saveStatus === 'success' ? 'bg-[var(--color-success)]/10 border border-[var(--color-success)]/30 text-[var(--color-success)]' :
            saveStatus === 'error' ? 'bg-[var(--color-error)]/10 border border-[var(--color-error)]/30 text-[var(--color-error)]' :
            'bg-mission-control-surface border border-mission-control-border'
          }`}>
            {saveStatus === 'success' ? <CheckCircle size={16} /> :
             saveStatus === 'error' ? <AlertCircle size={16} /> :
             <Spinner />}
            <span className="text-sm font-medium">{saveMessage}</span>
          </div>
        )}
      </BaseModal>
  );
}
