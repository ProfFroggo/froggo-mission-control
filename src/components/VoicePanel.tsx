import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Mic, MicOff, Volume2, VolumeX, Phone, PhoneOff, Loader2, 
  MessageSquare, WifiOff, Zap, Brain, ListTodo, Clock, FileText,
  Download, ChevronRight, Calendar, Send, X, Trash2
} from 'lucide-react';
import MarkdownMessage from './MarkdownMessage';
import { gateway, ConnectionState } from '../lib/gateway';
import { useStore } from '../store/store';
import { voiceService } from '../lib/voiceService';
import type { Model, KaldiRecognizer } from 'vosk-browser';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface ActionItem {
  type: 'schedule' | 'message' | 'email' | 'task' | 'general';
  text: string;
  confidence: number;
}

interface PastMeeting {
  filename: string;
  filepath: string;
  date: Date;
  time: string;
  transcript: string[];
  actionItems: string[];
  tasksCreated: string[];
  rawContent: string;
}

// Action item detection patterns - expanded for better detection
const ACTION_PATTERNS = {
  schedule: /\b(schedule|meeting|calendar|appointment|at \d|tomorrow|next week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
  message: /\b(message|text|send|tell|notify|ping|slack|whatsapp|telegram|discord)\b/i,
  email: /\b(email|mail|send.*to|write.*to)\b/i,
  task: /\b(action item|todo|task|remind|reminder|don't forget|remember to|need to|needs to|have to|has to|should|will|going to|gotta|must|follow up|follow-up|followup)\b/i,
};

// More specific action item extraction patterns
const TASK_EXTRACTION_PATTERNS = [
  /action item[:\s]+(.+?)(?:\.|$)/gi,
  /todo[:\s]+(.+?)(?:\.|$)/gi,
  /task[:\s]+(.+?)(?:\.|$)/gi,
  /(?:i|we)\s+(?:need to|have to|should|will|must)\s+(.+?)(?:\.|$)/gi,
  /(?:you|they)\s+(?:need to|should|will|must)\s+(.+?)(?:\.|$)/gi,
  /follow up (?:on|with)\s+(.+?)(?:\.|$)/gi,
  /don't forget (?:to\s+)?(.+?)(?:\.|$)/gi,
  /remember to\s+(.+?)(?:\.|$)/gi,
];

// OpenAI Whisper API for high-quality transcription
const OPENAI_API_KEY = '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';

// Transcribe audio blob via Whisper API
async function transcribeWithWhisper(audioBlob: Blob, mimeType?: string): Promise<string> {
  // Determine file extension from mimeType
  let ext = 'webm';
  if (mimeType?.includes('mp4')) ext = 'mp4';
  else if (mimeType?.includes('ogg')) ext = 'ogg';
  else if (mimeType?.includes('wav')) ext = 'wav';
  
  const formData = new FormData();
  formData.append('file', audioBlob, `audio.${ext}`);
  formData.append('model', 'whisper-1');
  formData.append('language', 'en');
  formData.append('prompt', 'Speaker: Kevin MacArthur. Topics: AI, software, crypto, perps trading, onchain, Bitso, Froggo, Clawdbot, Kanban, Dashboard, Solana.');
  
  try {
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
      body: formData
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.text || '';
    } else {
      console.error('[Whisper] API error:', response.status, await response.text());
    }
  } catch (err) {
    console.error('[Whisper] Error:', err);
  }
  return '';
}

type TabType = 'voice' | 'meetings';

export default function VoicePanel() {
  console.log('[Voice] VoicePanel component rendering');
  
  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('voice');
  
  // Global state from store
  const { 
    isMuted, 
    toggleMuted,
    isMeetingActive, 
    setMeetingActive,
    addActivity 
  } = useStore();
  
  // Core state
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [connectionState, setConnectionState] = useState<ConnectionState>(gateway.getState());
  
  // Vosk state
  const [modelLoading, setModelLoading] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const [partialTranscript, setPartialTranscript] = useState('');
  const [currentTranscript, setCurrentTranscript] = useState('');
  
  // Mode state
  const [conversationMode, setConversationMode] = useState(false);
  const conversationModeRef = useRef(false);
  
  // Refs for mute state
  const isMutedRef = useRef(isMuted);
  
  // Conversation history (with localStorage persistence)
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem('froggo-voice-history');
      if (saved) {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch {}
    return [];
  });
  
  // Meeting mode state
  const [meetingTranscript, setMeetingTranscript] = useState<string[]>([]);
  const [meetingActionItems, setMeetingActionItems] = useState<ActionItem[]>([]);
  const [meetingEndSummary, setMeetingEndSummary] = useState<{
    savedPath: string | null;
    tasksCreated: number;
    extractedTasks: string[];
  } | null>(null);
  
  // Past meetings state
  const [pastMeetings, setPastMeetings] = useState<PastMeeting[]>([]);
  const [loadingPastMeetings, setLoadingPastMeetings] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<PastMeeting | null>(null);
  
  // AI Chat about meeting
  const [meetingChatInput, setMeetingChatInput] = useState('');
  const [meetingChatMessages, setMeetingChatMessages] = useState<Message[]>([]);
  const [meetingChatProcessing, setMeetingChatProcessing] = useState(false);
  
  // Audio state
  const [audioLevel, setAudioLevel] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  
  // Refs
  const modelRef = useRef<Model | null>(null);
  const recognizerRef = useRef<KaldiRecognizer | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const meetingTranscriptEndRef = useRef<HTMLDivElement>(null);
  const listeningRef = useRef<boolean>(false);
  
  // Whisper transcription refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const whisperIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Speech accumulation buffer (to avoid cutting off mid-sentence)
  const speechBufferRef = useRef<string[]>([]);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Keep mute ref in sync
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);
  
  // Settings
  const SAMPLE_RATE = 16000;
  const SILENCE_TIMEOUT_MS = 2500;
  const SENTENCE_END_TIMEOUT_MS = 1200;

  const connected = connectionState === 'connected';

  // Load Vosk model via voiceService
  useEffect(() => {
    const unsubscribe = voiceService.subscribe((state, message) => {
      console.log('[VoicePanel] voiceService state:', state, message);
      
      if (state === 'ready') {
        setModelLoaded(true);
        setModelLoading(false);
        setStatusMessage('');
      } else if (state === 'loading') {
        setModelLoading(true);
        setStatusMessage(message || 'Loading...');
      } else if (state === 'error') {
        setModelError(message || 'Failed to load model');
        setModelLoading(false);
      }
    });
    
    if (voiceService.isReady()) {
      setModelLoaded(true);
      setModelLoading(false);
    }
    
    return () => {
      unsubscribe();
      if (recognizerRef.current) {
        try { recognizerRef.current.remove(); } catch {}
        recognizerRef.current = null;
      }
      if (modelRef.current) {
        try { modelRef.current.terminate(); } catch {}
        modelRef.current = null;
      }
    };
  }, []);

  // Cleanup mic/audio on window close
  useEffect(() => {
    const cleanup = () => {
      console.log('[Voice] Window closing - releasing mic/audio...');
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          track.stop();
          console.log('[Voice] Stopped track:', track.kind);
        });
        streamRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
    };
    
    window.addEventListener('beforeunload', cleanup);
    window.addEventListener('unload', cleanup);
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && listeningRef.current) {
        console.log('[Voice] App hidden while listening - keeping mic for now');
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('beforeunload', cleanup);
      window.removeEventListener('unload', cleanup);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      cleanup();
    };
  }, []);

  // Track gateway state
  useEffect(() => {
    const unsub = gateway.on('stateChange', ({ state }: { state: ConnectionState }) => {
      setConnectionState(state);
    });
    setConnectionState(gateway.getState());
    return () => { unsub(); };
  }, []);

  // Persist messages to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('froggo-voice-history', JSON.stringify(messages));
    } catch (e) {
      console.error('[Voice] Failed to save history:', e);
    }
  }, [messages]);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // Auto-scroll meeting transcript
  useEffect(() => {
    meetingTranscriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [meetingTranscript]);

  // Load past meetings when Meetings tab is selected
  useEffect(() => {
    if (activeTab === 'meetings') {
      loadPastMeetings();
    }
  }, [activeTab]);

  // Load past meetings from ~/clawd/meetings/*.md
  const loadPastMeetings = useCallback(async () => {
    if (!window.clawdbot?.exec?.run) {
      console.error('[Meetings] exec.run not available');
      return;
    }
    
    setLoadingPastMeetings(true);
    try {
      // Get list of meeting files
      const listResult = await window.clawdbot.exec.run('ls -1 $HOME/clawd/meetings/*.md 2>/dev/null || echo ""');
      if (!listResult.success || !listResult.stdout.trim()) {
        setPastMeetings([]);
        setLoadingPastMeetings(false);
        return;
      }
      
      const files = listResult.stdout.trim().split('\n').filter(f => f);
      const meetings: PastMeeting[] = [];
      
      for (const filepath of files) {
        try {
          const readResult = await window.clawdbot.exec.run(`cat "${filepath}"`);
          if (!readResult.success) continue;
          
          const content = readResult.stdout;
          const filename = filepath.split('/').pop() || '';
          
          // Parse meeting metadata from filename (YYYY-MM-DD-HHmm.md)
          const match = filename.match(/(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})\.md/);
          let date = new Date();
          let time = '';
          
          if (match) {
            date = new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]), parseInt(match[4]), parseInt(match[5]));
            time = `${match[4]}:${match[5]}`;
          }
          
          // Parse transcript from content
          const transcriptMatch = content.match(/## Transcript\n\n([\s\S]*?)(?=\n##|---|\n*$)/);
          const transcript: string[] = [];
          if (transcriptMatch) {
            const lines = transcriptMatch[1].split('\n');
            for (const line of lines) {
              const cleanLine = line.replace(/^>\s*/, '').trim();
              if (cleanLine) transcript.push(cleanLine);
            }
          }
          
          // Parse action items
          const actionItemsMatch = content.match(/## Action Items Detected\n\n([\s\S]*?)(?=\n##|---|\n*$)/);
          const actionItems: string[] = [];
          if (actionItemsMatch) {
            const lines = actionItemsMatch[1].split('\n');
            for (const line of lines) {
              const itemMatch = line.match(/- \[.\] \*\*\[(\w+)\]\*\* (.+)/);
              if (itemMatch) {
                actionItems.push(`[${itemMatch[1]}] ${itemMatch[2]}`);
              }
            }
          }
          
          // Parse tasks created
          const tasksMatch = content.match(/## Tasks to Create\n\n([\s\S]*?)(?=\n##|---|\n*$)/);
          const tasksCreated: string[] = [];
          if (tasksMatch) {
            const lines = tasksMatch[1].split('\n');
            for (const line of lines) {
              const taskMatch = line.match(/- \[.\] (.+)/);
              if (taskMatch) {
                tasksCreated.push(taskMatch[1]);
              }
            }
          }
          
          meetings.push({
            filename,
            filepath,
            date,
            time,
            transcript,
            actionItems,
            tasksCreated,
            rawContent: content,
          });
        } catch (err) {
          console.error('[Meetings] Error parsing file:', filepath, err);
        }
      }
      
      // Sort by date, newest first
      meetings.sort((a, b) => b.date.getTime() - a.date.getTime());
      setPastMeetings(meetings);
    } catch (err) {
      console.error('[Meetings] Error loading past meetings:', err);
    } finally {
      setLoadingPastMeetings(false);
    }
  }, []);

  // Speak text using ElevenLabs TTS
  const speak = useCallback(async (text: string): Promise<void> => {
    if (!voiceEnabled || !text) return;
    
    const skipPhrases = /^(on it|got it|sure|ok|okay|yes|yep|done|noted|ack|👍|✅|🐸)\s*[.!]?\s*$/i;
    if (skipPhrases.test(text.trim())) {
      console.log('[TTS] Skipping filler ack:', text);
      return;
    }
    
    const clean = text
      .replace(/```[\s\S]*?```/g, 'code block')
      .replace(/`[^`]+`/g, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/#+\s*/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[<>]/g, '')
      .replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F000}-\u{1F02F}]|[\u{1F0A0}-\u{1F0FF}]|[\u{1F100}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]/gu, '')
      .replace(/(\d{1,2}):00\b/g, (_, h) => {
        const hour = parseInt(h);
        const hours = ['twelve', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
        return hours[hour % 12] || h;
      })
      .replace(/(\d{1,2}):30\b/g, (_, h) => {
        const hour = parseInt(h);
        const hours = ['twelve', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
        return `half past ${hours[hour % 12] || h}`;
      })
      .replace(/(\d{1,2}):(\d{2})\b/g, (_, h, m) => {
        const hour = parseInt(h);
        const hours = ['twelve', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
        return `${hours[hour % 12] || h} ${m}`;
      })
      .replace(/^\s*[-•]\s*/gm, '')
      .replace(/\s*[—–]\s*/g, ', ')
      .replace(/\n+/g, '. ')
      .replace(/\s+/g, ' ')
      .replace(/\.\s*\./g, '.')
      .replace(/,\s*,/g, ',')
      .trim()
      .slice(0, 800);
    
    setSpeaking(true);
    
    try {
      if (window.clawdbot?.voice?.speak) {
        const result = await window.clawdbot.voice.speak(clean, 'Brian');
        
        if (result.success && result.path) {
          return new Promise<void>((resolve) => {
            const audio = new Audio(`file://${result.path}`);
            audio.onended = () => {
              setSpeaking(false);
              resolve();
            };
            audio.onerror = () => {
              console.error('[Voice] Audio playback error');
              setSpeaking(false);
              resolve();
            };
            audio.play();
          });
        }
      }
      
      // Fallback to Web Speech API
      return new Promise<void>((resolve) => {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(clean);
        utterance.rate = 1.1;
        utterance.pitch = 1.0;
        
        const voices = window.speechSynthesis.getVoices();
        const preferred = voices.find(v => 
          v.name.includes('Samantha') || 
          v.name.includes('Karen') || 
          v.name.includes('Daniel') ||
          (v.lang === 'en-US' && v.localService)
        );
        if (preferred) utterance.voice = preferred;
        
        utterance.onend = () => {
          setSpeaking(false);
          resolve();
        };
        utterance.onerror = () => {
          setSpeaking(false);
          resolve();
        };
        
        window.speechSynthesis.speak(utterance);
      });
    } catch (err) {
      console.error('[Voice] TTS error:', err);
      setSpeaking(false);
    }
  }, [voiceEnabled]);

  // Detect action items in text
  const detectActionItems = useCallback((text: string): ActionItem[] => {
    const items: ActionItem[] = [];
    
    // Use TASK_EXTRACTION_PATTERNS to get specific action items, not just flag whole text
    for (const pattern of TASK_EXTRACTION_PATTERNS) {
      let match;
      pattern.lastIndex = 0;
      while ((match = pattern.exec(text)) !== null) {
        const extractedText = match[1]?.trim();
        if (extractedText && extractedText.length > 3 && extractedText.length < 200) {
          // Determine type based on the pattern
          let type: ActionItem['type'] = 'task';
          if (/schedule|meeting|calendar/i.test(text)) type = 'schedule';
          else if (/message|email|reply|send/i.test(text)) type = 'message';
          else if (/follow up/i.test(text)) type = 'task';
          
          // Avoid duplicates
          if (!items.some(i => i.text.toLowerCase() === extractedText.toLowerCase())) {
            items.push({
              type,
              text: extractedText,
              confidence: 0.8,
            });
          }
        }
      }
    }
    
    return items;
  }, []);

  // Extract specific tasks from action items for task creation
  const extractTasksFromText = useCallback((text: string): string[] => {
    const tasks: string[] = [];
    
    for (const pattern of TASK_EXTRACTION_PATTERNS) {
      let match;
      pattern.lastIndex = 0;
      while ((match = pattern.exec(text)) !== null) {
        const task = match[1]?.trim();
        if (task && task.length > 3 && task.length < 200) {
          if (!tasks.some(t => t.toLowerCase() === task.toLowerCase())) {
            tasks.push(task);
          }
        }
      }
    }
    
    return tasks;
  }, []);

  // Save meeting transcript to markdown file
  const saveMeetingToFile = useCallback(async (transcript: string[], actionItems: ActionItem[]): Promise<string | null> => {
    if (!window.clawdbot?.exec?.run) {
      console.error('[Meeting] exec.run not available');
      return null;
    }
    
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toTimeString().slice(0, 5).replace(':', '');
    const filename = `${dateStr}-${timeStr}.md`;
    const filepath = `$HOME/clawd/meetings/${filename}`;
    
    const lines: string[] = [
      `# Meeting Notes - ${now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`,
      ``,
      `**Time:** ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`,
      ``,
      `## Transcript`,
      ``,
      ...transcript.map(line => `> ${line}`),
      ``,
    ];
    
    if (actionItems.length > 0) {
      lines.push(`## Action Items Detected`);
      lines.push(``);
      actionItems.forEach((item) => {
        lines.push(`- [ ] **[${item.type}]** ${item.text}`);
      });
      lines.push(``);
    }
    
    const fullText = transcript.join(' ');
    const extractedTasks = extractTasksFromText(fullText);
    if (extractedTasks.length > 0) {
      lines.push(`## Tasks to Create`);
      lines.push(``);
      extractedTasks.forEach(task => {
        lines.push(`- [ ] ${task}`);
      });
      lines.push(``);
    }
    
    lines.push(`---`);
    lines.push(`*Generated by Froggo Voice Assistant*`);
    
    const content = lines.join('\n');
    const base64Content = btoa(unescape(encodeURIComponent(content)));
    const cmd = `mkdir -p $HOME/clawd/meetings && echo "${base64Content}" | base64 -d > "${filepath}"`;
    
    try {
      const result = await window.clawdbot.exec.run(cmd);
      if (result.success) {
        console.log('[Meeting] Saved transcript to:', filepath);
        return filepath;
      } else {
        console.error('[Meeting] Failed to save:', result.stderr);
        return null;
      }
    } catch (err) {
      console.error('[Meeting] Error saving file:', err);
      return null;
    }
  }, [extractTasksFromText]);

  // Create tasks from detected action items in transcript
  const createTasksFromMeeting = useCallback(async (transcript: string[]): Promise<{ count: number; tasks: string[] }> => {
    if (!window.clawdbot?.tasks?.sync) {
      console.error('[Meeting] tasks.sync not available');
      return { count: 0, tasks: [] };
    }
    
    const fullText = transcript.join(' ');
    const extractedTasks = extractTasksFromText(fullText);
    
    let created = 0;
    const createdTasks: string[] = [];
    
    for (const taskText of extractedTasks) {
      const taskId = `meeting-${Date.now()}-${created}`;
      
      let title = taskText;
      title = title.charAt(0).toUpperCase() + title.slice(1);
      title = title.replace(/[,;:]$/, '').trim();
      
      try {
        const result = await window.clawdbot.tasks.sync({
          id: taskId,
          title: title,
          status: 'todo',
          project: 'Meetings',
          description: `From meeting on ${new Date().toLocaleDateString()}`,
        });
        
        if (result.success) {
          console.log('[Meeting] Created task:', title);
          created++;
          createdTasks.push(title);
        } else {
          console.error('[Meeting] Failed to create task:', result.error);
        }
      } catch (err) {
        console.error('[Meeting] Error creating task:', err);
      }
    }
    
    return { count: created, tasks: createdTasks };
  }, [extractTasksFromText]);

  // Send command to gateway and get response
  const sendCommand = useCallback(async (command: string): Promise<string | null> => {
    if (!connected || !command.trim()) return null;
    
    setProcessing(true);
    
    const userMsg: Message = { role: 'user', content: command, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    addActivity({ type: 'chat', message: `🎤 ${command}`, timestamp: Date.now() });
    
    try {
      const result = await gateway.sendChat(`[VOICE] ${command}`);
      
      if (result?.content && result.content !== 'NO_REPLY') {
        const assistantMsg: Message = { 
          role: 'assistant', 
          content: result.content, 
          timestamp: Date.now() 
        };
        setMessages(prev => [...prev, assistantMsg]);
        return result.content;
      }
      return null;
    } catch (e: any) {
      console.error('[Voice] Command error:', e);
      const errorMsg: Message = {
        role: 'assistant',
        content: `Sorry, something went wrong: ${e.message}`,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMsg]);
      return null;
    } finally {
      setProcessing(false);
    }
  }, [connected, addActivity]);

  // Handle completed utterance
  const handleUtterance = useCallback(async (text: string) => {
    console.log('[Voice] handleUtterance called:', { text, isMeetingActive, processing });
    if (!text.trim() || processing) return;
    
    setStatusMessage('Processing...');
    setCurrentTranscript(text);
    setPartialTranscript('');
    
    if (isMeetingActive) {
      // Add raw transcript immediately for responsiveness
      console.log('[Voice] Meeting transcript adding:', text);
      setMeetingTranscript(prev => [...prev, text]);
      
      // AI cleanup via Gemini (free, fast) with context
      const cleanupViaGemini = async (rawText: string) => {
        try {
          const GEMINI_KEY = 'AIzaSyAryVt2xhugisz03eraIhTMhXO6cKMYUGY';
          const prompt = `TASK: Fix transcription errors. Return ONLY corrected text.

VOCABULARY: perps, Froggo, Clawdbot, Bitso, Kanban, Dashboard, Opus, Sonnet, Claude

RULES:
- NO preamble like "Okay" or "Here is"
- NO explanation
- NO "Let me" or "I'll"
- ONLY output the corrected transcript

INPUT:
${rawText}

OUTPUT:`;

          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { 
                  maxOutputTokens: 512,
                  temperature: 0.1
                }
              })
            }
          );
          if (response.ok) {
            const data = await response.json();
            let cleaned = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
            if (cleaned) {
              // Strip any preamble Gemini might add despite instructions
              cleaned = cleaned
                .replace(/^(Okay|OK|Sure|Here'?s?|Let me|I'll|I will)[^.]*\.\s*/i, '')
                .replace(/^(The |This )?(corrected|cleaned|fixed) (text|transcript)[^.]*:\s*/i, '')
                .trim();
              return cleaned;
            }
          }
        } catch (err) {
          console.error('[Voice] Gemini cleanup failed:', err);
        }
        return rawText;
      };
      
      cleanupViaGemini(text).then((cleanedText: string) => {
        if (cleanedText && cleanedText !== text) {
          console.log('[Voice] AI cleaned:', text, '→', cleanedText);
          setMeetingTranscript(prev => {
            const updated = [...prev];
            const idx = updated.indexOf(text);
            if (idx !== -1) {
              updated[idx] = cleanedText;
            }
            return updated;
          });
          
          // Detect action items from CLEANED text
          const actions = detectActionItems(cleanedText);
          if (actions.length > 0) {
            setMeetingActionItems(prev => [...prev, ...actions]);
          }
        } else {
          // No cleanup needed, detect from original
          const actions = detectActionItems(text);
          if (actions.length > 0) {
            setMeetingActionItems(prev => [...prev, ...actions]);
          }
        }
      });
      
      setStatusMessage('Meeting mode active...');
    } else if (conversationModeRef.current) {
      listeningRef.current = false;
      setStatusMessage('Cleaning up...');
      
      // Clean up transcript with AI before sending (fire and don't wait too long)
      let cleanedText = text;
      if ((window as any).clawdbot?.ai?.generateContent) {
        try {
          const result = await Promise.race([
            (window as any).clawdbot.ai.generateContent(text, 'cleanup'),
            new Promise(resolve => setTimeout(() => resolve(null), 2000)) // 2s timeout
          ]) as any;
          
          if (result?.success && result.cleaned && result.cleaned !== text) {
            console.log('[Voice] AI cleaned (conversation):', text, '→', result.cleaned);
            cleanedText = result.cleaned;
            setCurrentTranscript(cleanedText); // Update displayed transcript
          }
        } catch (err) {
          console.error('[Voice] AI cleanup failed (conversation):', err);
        }
      }
      
      setStatusMessage('Thinking...');
      const response = await sendCommand(cleanedText);
      
      if (response) {
        setStatusMessage('Speaking...');
        await speak(response);
      }
      
      if (conversationModeRef.current) {
        listeningRef.current = true;
        setStatusMessage('Listening...');
      }
    }
  }, [conversationMode, isMeetingActive, sendCommand, speak, processing, detectActionItems]);

  // Start listening with vosk-browser
  const startListening = useCallback(async () => {
    // Use ref for immediate check (state might be stale)
    if (!voiceService.isReady() || listening || listeningRef.current) {
      console.log('[Voice] Skipping start - already listening or not ready');
      return;
    }
    
    // Set ref immediately to prevent race conditions
    listeningRef.current = true;
    
    console.log('[Voice] Starting vosk-browser streaming...');
    setStatusMessage('Initializing...');
    
    try {
      const recognizer = voiceService.createRecognizer(SAMPLE_RATE);
      if (!recognizer) throw new Error('Failed to create recognizer');
      recognizerRef.current = recognizer;
      
      recognizer.on('partialresult', (message: any) => {
        const partial = message.result?.partial || '';
        if (partial) setPartialTranscript(partial);
      });
      
      recognizer.on('result', (message: any) => {
        const text = message.result?.text || '';
        if (text.trim()) {
          console.log('[Voice] Fragment:', text);
          
          speechBufferRef.current.push(text);
          const accumulated = speechBufferRef.current.join(' ');
          setCurrentTranscript(accumulated);
          
          if (silenceTimeoutRef.current) {
            clearTimeout(silenceTimeoutRef.current);
          }
          
          const endsWithPunctuation = /[.?!][\s]*$/.test(accumulated.trim());
          const timeout = endsWithPunctuation ? SENTENCE_END_TIMEOUT_MS : SILENCE_TIMEOUT_MS;
          
          silenceTimeoutRef.current = setTimeout(() => {
            const fullText = speechBufferRef.current.join(' ').trim();
            if (fullText) {
              console.log('[Voice] Processing after silence:', fullText);
              speechBufferRef.current = [];
              setCurrentTranscript('');
              handleUtterance(fullText);
            }
          }, timeout);
        }
      });
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: true, 
          noiseSuppression: true,
          sampleRate: SAMPLE_RATE,
          channelCount: 1,
        } 
      });
      streamRef.current = stream;
      
      audioContextRef.current = new AudioContext({ sampleRate: SAMPLE_RATE });
      
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      
      const source = audioContextRef.current.createMediaStreamSource(stream);
      
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);
      
      const workletCode = `
        class VoiceProcessor extends AudioWorkletProcessor {
          constructor() {
            super();
            this.bufferSize = 4096;
            this.buffer = new Float32Array(this.bufferSize);
            this.bufferIndex = 0;
          }
          process(inputs) {
            const input = inputs[0];
            if (input && input[0]) {
              const inputData = input[0];
              for (let i = 0; i < inputData.length; i++) {
                this.buffer[this.bufferIndex++] = inputData[i];
                if (this.bufferIndex >= this.bufferSize) {
                  this.port.postMessage({ type: 'audio', data: this.buffer.slice() });
                  this.bufferIndex = 0;
                }
              }
            }
            return true;
          }
        }
        registerProcessor('voice-processor', VoiceProcessor);
      `;
      const blob = new Blob([workletCode], { type: 'application/javascript' });
      const workletUrl = URL.createObjectURL(blob);
      
      // Guard against race condition where audioContext gets closed during async
      if (!audioContextRef.current) {
        console.error('[Voice] AudioContext was closed during setup');
        URL.revokeObjectURL(workletUrl);
        return;
      }
      
      await audioContextRef.current.audioWorklet.addModule(workletUrl);
      URL.revokeObjectURL(workletUrl);
      
      // Another guard after async addModule
      if (!audioContextRef.current) {
        console.error('[Voice] AudioContext was closed after addModule');
        return;
      }
      
      const workletNode = new AudioWorkletNode(audioContextRef.current, 'voice-processor');
      source.connect(workletNode);
      
      workletNode.port.onmessage = (event) => {
        if (!listeningRef.current || !recognizerRef.current) return;
        
        if (isMutedRef.current) {
          setAudioLevel(0);
          return;
        }
        
        if (analyserRef.current) {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);
          const avg = dataArray.reduce((a, b) => a + b) / dataArray.length;
          setAudioLevel(avg / 255);
        }
        
        if (event.data.type === 'audio') {
          try {
            const audioBuffer = audioContextRef.current!.createBuffer(1, event.data.data.length, SAMPLE_RATE);
            audioBuffer.copyToChannel(event.data.data, 0);
            recognizerRef.current.acceptWaveform(audioBuffer);
          } catch (err) {
            console.error('[Voice] acceptWaveform error:', err);
          }
        }
      };
      
      setListening(true);
      listeningRef.current = true;
      setStatusMessage(isMeetingActive ? 'Meeting mode active...' : 'Listening...');
      console.log('[Voice] Vosk-browser streaming started');
      
    } catch (err: any) {
      console.error('[Voice] Failed to start:', err);
      setStatusMessage(`Error: ${err.message}`);
      await stopListening();
    }
  }, [modelLoaded, listening, isMeetingActive, handleUtterance]);

  // Stop listening
  const stopListening = useCallback(async () => {
    console.log('[Voice] Stopping...');
    listeningRef.current = false;
    
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
    speechBufferRef.current = [];
    
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (audioContextRef.current) {
      await audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    if (recognizerRef.current) {
      try { recognizerRef.current.remove(); } catch {}
      recognizerRef.current = null;
    }
    
    setListening(false);
    setAudioLevel(0);
    setPartialTranscript('');
    setCurrentTranscript('');
    setStatusMessage('');
  }, []);

  // Toggle conversation mode
  const toggleConversation = useCallback(async () => {
    if (listening || conversationMode) {
      conversationModeRef.current = false;
      setConversationMode(false);
      await stopListening();
      window.speechSynthesis.cancel();
      setStatusMessage('Stopped');
    } else {
      conversationModeRef.current = true;
      setConversationMode(true);
      setMeetingActive(false);
      await startListening();
    }
  }, [listening, conversationMode, startListening, stopListening, setMeetingActive]);

  // Start meeting
  const startMeeting = useCallback(async () => {
    if (listeningRef.current) {
      console.log('[Meeting] Already listening, skipping start');
      return;
    }
    
    console.log('[Meeting] Starting with Whisper transcription...');
    setStatusMessage('Starting meeting...');
    setConversationMode(false);
    conversationModeRef.current = false;
    setMeetingTranscript([]);
    setMeetingActionItems([]);
    setMeetingEndSummary(null);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { echoCancellation: true, noiseSuppression: true } 
      });
      streamRef.current = stream;
      listeningRef.current = true;
      setListening(true);
      
      const mimeType = MediaRecorder.isTypeSupported('audio/mp4') 
        ? 'audio/mp4' 
        : MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm';
      console.log('[Meeting] Using mimeType:', mimeType);
      
      let processingCount = 0;
      
      // Helper to process transcript with Gemini cleanup
      const processTranscript = (transcript: string, batchNum: number) => {
        if (!transcript?.trim()) return;
        
        console.log('[Whisper] Batch', batchNum, 'result:', transcript.substring(0, 50));
        setMeetingTranscript(prev => [...prev, transcript]);
        
        // Gemini cleanup
        const GEMINI_KEY = 'AIzaSyAryVt2xhugisz03eraIhTMhXO6cKMYUGY';
        fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `Fix transcription errors. Common words: "perps" (perpetual futures), "Froggo", "Clawdbot", "Bitso", "Kanban", "onchain", "Solana".\n\nDO NOT add explanation or context. Output ONLY the corrected text:\n\n${transcript}` }] }],
            generationConfig: { 
              maxOutputTokens: 512,
              temperature: 0.1
            }
          })
        })
        .then(res => res.json())
        .then(data => {
          const cleaned = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (cleaned && cleaned !== transcript) {
            console.log('[Gemini] Cleaned:', cleaned.substring(0, 50));
            setMeetingTranscript(prev => {
              const updated = [...prev];
              const idx = updated.indexOf(transcript);
              if (idx !== -1) updated[idx] = cleaned;
              return updated;
            });
            const actions = detectActionItems(cleaned);
            if (actions.length > 0) setMeetingActionItems(prev => [...prev, ...actions]);
          } else {
            const actions = detectActionItems(transcript);
            if (actions.length > 0) setMeetingActionItems(prev => [...prev, ...actions]);
          }
        })
        .catch(() => {
          const actions = detectActionItems(transcript);
          if (actions.length > 0) setMeetingActionItems(prev => [...prev, ...actions]);
        });
      };
      
      // Create and start a new recorder
      const startNewRecorder = () => {
        if (!streamRef.current) return;
        
        const recorder = new MediaRecorder(streamRef.current, { mimeType });
        mediaRecorderRef.current = recorder;
        audioChunksRef.current = [];
        
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };
        
        recorder.start(1000);
        console.log('[Meeting] New recorder started');
      };
      
      // Stop recorder and process audio
      const stopAndProcess = async () => {
        if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') return;
        
        return new Promise<void>((resolve) => {
          const recorder = mediaRecorderRef.current!;
          
          recorder.onstop = async () => {
            const chunks = [...audioChunksRef.current];
            audioChunksRef.current = [];
            
            if (chunks.length > 0) {
              const audioBlob = new Blob(chunks, { type: mimeType });
              processingCount++;
              const batchNum = processingCount;
              
              console.log('[Whisper] Processing batch', batchNum, 'size:', audioBlob.size);
              
              if (audioBlob.size > 1000) {
                setStatusMessage(`Transcribing ${batchNum}...`);
                const transcript = await transcribeWithWhisper(audioBlob, mimeType);
                processTranscript(transcript, batchNum);
                setStatusMessage('Recording...');
              }
            }
            resolve();
          };
          
          recorder.stop();
        });
      };
      
      // Start first recorder
      startNewRecorder();
      
      // Every 10 seconds: stop current, process, start new
      whisperIntervalRef.current = setInterval(async () => {
        if (!listeningRef.current) return;
        await stopAndProcess();
        if (listeningRef.current && streamRef.current) {
          startNewRecorder();
        }
      }, 10000);
      
      setMeetingActive(true);
      setStatusMessage('Recording...');
      
    } catch (e: any) {
      console.error('[Meeting] Failed to start:', e);
      setStatusMessage('Failed: ' + e.message);
      listeningRef.current = false;
      setListening(false);
    }
  }, [setMeetingActive, detectActionItems]);

  // End meeting
  const endMeeting = useCallback(async () => {
    console.log('[Meeting] Ending...');
    
    // Stop Whisper interval
    if (whisperIntervalRef.current) {
      clearInterval(whisperIntervalRef.current);
      whisperIntervalRef.current = null;
    }
    
    // Process any remaining audio
    if (mediaRecorderRef.current && audioChunksRef.current.length > 0) {
      const usedMimeType = (mediaRecorderRef.current as any)?.usedMimeType || 'audio/webm';
      mediaRecorderRef.current.stop();
      
      // Final transcription of remaining audio
      const audioBlob = new Blob(audioChunksRef.current, { type: usedMimeType });
      audioChunksRef.current = [];
      
      if (audioBlob.size > 1000) {
        setStatusMessage('Final transcription...');
        const transcript = await transcribeWithWhisper(audioBlob, usedMimeType);
        if (transcript.trim()) {
          setMeetingTranscript(prev => [...prev, transcript]);
        }
      }
    }
    
    // Stop mic
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    mediaRecorderRef.current = null;
    listeningRef.current = false;
    setListening(false);
    setMeetingActive(false);
    setConversationMode(false);
    
    if (meetingTranscript.length > 0) {
      setStatusMessage('Saving meeting notes...');
      
      const savedPath = await saveMeetingToFile(meetingTranscript, meetingActionItems);
      const { count: tasksCreated, tasks: extractedTasks } = await createTasksFromMeeting(meetingTranscript);
      
      setMeetingEndSummary({
        savedPath,
        tasksCreated,
        extractedTasks,
      });
      
      if (savedPath || tasksCreated > 0) {
        const messages: string[] = [];
        if (savedPath) messages.push(`Notes saved`);
        if (tasksCreated > 0) messages.push(`${tasksCreated} task${tasksCreated > 1 ? 's' : ''} created`);
        setStatusMessage(messages.join(' • '));
        
        addActivity({ 
          type: 'system', 
          message: `📋 Meeting ended: ${savedPath ? 'transcript saved' : ''} ${tasksCreated > 0 ? `+ ${tasksCreated} tasks` : ''}`.trim(),
          timestamp: Date.now() 
        });
      } else {
        setStatusMessage('Meeting ended.');
      }
      
      // Refresh past meetings list
      loadPastMeetings();
    } else {
      setStatusMessage('Meeting ended (no transcript).');
    }
  }, [meetingTranscript, meetingActionItems, stopListening, setMeetingActive, saveMeetingToFile, createTasksFromMeeting, addActivity, loadPastMeetings]);
  
  // Sync with global meeting state (for TopBar call button)
  const prevMeetingActive = useRef(false);
  const hasInitialized = useRef(false);
  const startListeningRef = useRef(startListening);
  const stopListeningRef = useRef(stopListening);
  startListeningRef.current = startListening;
  stopListeningRef.current = stopListening;
  
  // NOTE: This effect is for when meeting is started from TopBar call button (global state)
  // When started from the Meetings tab Start button, startMeeting() handles everything
  useEffect(() => {
    const startMeetingFromGlobal = async () => {
      console.log('[Meeting] Global sync effect:', { 
        isMeetingActive, 
        prevMeetingActive: prevMeetingActive.current,
        modelLoaded,
        listening: listeningRef.current,
        hasInitialized: hasInitialized.current
      });
      
      // Only start if meeting was activated AND we're not already listening
      // (startMeeting() already calls startListening, so we check listeningRef)
      const shouldStart = isMeetingActive && modelLoaded && !listeningRef.current && !prevMeetingActive.current;
      
      if (shouldStart) {
        console.log('[Meeting] Starting from global state');
        setConversationMode(false);
        // Don't clear transcript here - might race with handleUtterance
        setMeetingEndSummary(null);
        await startListeningRef.current();
        hasInitialized.current = true;
        setActiveTab('meetings');
      } else if (!isMeetingActive && prevMeetingActive.current) {
        console.log('[Meeting] Stopping from global state');
        await stopListeningRef.current();
      }
      prevMeetingActive.current = isMeetingActive;
    };
    startMeetingFromGlobal();
  }, [isMeetingActive, modelLoaded]);

  // Send meeting summary to Froggo
  const sendMeetingSummary = useCallback(async () => {
    const summary = [
      '**Meeting Summary:**',
      '',
      '**Transcript:**',
      meetingTranscript.join(' '),
      '',
      meetingActionItems.length > 0 ? '**Detected Action Items:**' : '',
      ...meetingActionItems.map(a => `- [${a.type}] ${a.text}`),
      '',
      'Please organize these notes and confirm any action items I should follow up on.',
    ].filter(Boolean).join('\n');
    
    const response = await sendCommand(summary);
    if (response) {
      await speak(response);
    }
    
    setMeetingTranscript([]);
    setMeetingActionItems([]);
  }, [meetingTranscript, meetingActionItems, sendCommand, speak]);

  // Export meeting to clipboard
  const exportMeeting = useCallback((meeting: PastMeeting) => {
    navigator.clipboard.writeText(meeting.rawContent);
    setStatusMessage('Meeting exported to clipboard');
    setTimeout(() => setStatusMessage(''), 2000);
  }, []);

  // Ask about meeting (AI chat)
  const askAboutMeeting = useCallback(async (meeting: PastMeeting, question: string) => {
    if (!question.trim()) return;
    
    setMeetingChatProcessing(true);
    
    const userMsg: Message = { role: 'user', content: question, timestamp: Date.now() };
    setMeetingChatMessages(prev => [...prev, userMsg]);
    
    // Check if this is a task creation request
    const isTaskRequest = /\b(create|add|make|new)\s+(a\s+)?(task|todo|ticket|item)\b/i.test(question) ||
                          /\b(task|todo|ticket)\s+(for|about|to)\b/i.test(question);
    
    try {
      if (isTaskRequest && connected) {
        // Route task requests to main agent (Froggo)
        console.log('[Meeting Chat] Task request detected, routing to main agent');
        const taskContext = `Based on this meeting transcript, ${question}\n\nMeeting content:\n${meeting.transcript.join('\n')}`;
        
        const result = await gateway.sendChat(taskContext);
        
        if (result?.content && result.content !== 'NO_REPLY') {
          const assistantMsg: Message = { 
            role: 'assistant', 
            content: result.content, 
            timestamp: Date.now() 
          };
          setMeetingChatMessages(prev => [...prev, assistantMsg]);
        }
      } else {
        // Use Gemini for general meeting questions (fast, cheap)
        const GEMINI_KEY = 'AIzaSyAryVt2xhugisz03eraIhTMhXO6cKMYUGY';
        const prompt = `You are helping Kevin review a meeting transcript. Answer questions about the meeting content.

Meeting from ${meeting.date.toLocaleDateString()}:
${meeting.rawContent}

User question: ${question}

Give a helpful, concise answer based on the meeting content.`;

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { maxOutputTokens: 1024 }
            })
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          const answer = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          
          if (answer) {
            const assistantMsg: Message = { 
              role: 'assistant', 
              content: answer, 
              timestamp: Date.now() 
            };
            setMeetingChatMessages(prev => [...prev, assistantMsg]);
          }
        } else {
          throw new Error('Gemini API error');
        }
      }
    } catch (e: any) {
      console.error('[Meeting Chat] Error:', e);
      const errorMsg: Message = {
        role: 'assistant',
        content: `Sorry, something went wrong: ${e.message}`,
        timestamp: Date.now(),
      };
      setMeetingChatMessages(prev => [...prev, errorMsg]);
    } finally {
      setMeetingChatProcessing(false);
      setMeetingChatInput('');
    }
  }, [connected]);

  const reconnect = () => {
    gateway['reconnectNow']();
  };

  const quickCommands = [
    "What time is it?",
    "Check my calendar",
    "Any new messages?",
    "What's on my todo list?",
  ];

  const getOrbColor = () => {
    if (isMuted) return 'bg-red-500/20 border-red-500';
    if (modelLoading) return 'bg-blue-500/20 border-blue-500';
    if (processing) return 'bg-yellow-500/20 border-yellow-500';
    if (speaking) return 'bg-green-500/20 border-green-500';
    if (listening) return 'bg-clawd-accent/20 border-clawd-accent';
    return 'bg-clawd-surface border-clawd-border hover:border-clawd-accent';
  };

  const getOrbIcon = () => {
    if (isMuted) return <MicOff size={48} className="text-red-500" />;
    if (modelLoading) return <Loader2 size={48} className="animate-spin text-blue-500" />;
    if (processing) return <Loader2 size={48} className="animate-spin text-yellow-500" />;
    if (speaking) return <span className="animate-pulse text-5xl">🗣️</span>;
    if (listening) return <span style={{ transform: `scale(${1 + audioLevel * 0.3})` }} className="text-5xl">🎤</span>;
    return <span className="text-5xl">🐸</span>;
  };

  const canStart = modelLoaded && !modelError && !modelLoading;

  return (
    <div className="h-full flex flex-col">
      {/* Header with Tabs */}
      <div className="border-b border-clawd-border">
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Tabs */}
            <div className="flex bg-clawd-surface rounded-lg p-1">
              <button
                onClick={() => setActiveTab('voice')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  activeTab === 'voice'
                    ? 'bg-clawd-accent text-white'
                    : 'text-clawd-text-dim hover:text-clawd-text'
                }`}
              >
                <Mic size={16} className="inline mr-2" />
                Voice Chat
              </button>
              <button
                onClick={() => setActiveTab('meetings')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  activeTab === 'meetings'
                    ? 'bg-clawd-accent text-white'
                    : 'text-clawd-text-dim hover:text-clawd-text'
                } ${isMeetingActive ? 'ring-2 ring-orange-500 ring-offset-2 ring-offset-clawd-bg' : ''}`}
              >
                <Phone size={16} className="inline mr-2" />
                Meetings
                {isMeetingActive && <span className="ml-2 animate-pulse text-orange-400">●</span>}
              </button>
            </div>
          </div>
          
          <div className="flex gap-2 items-center">
            {/* Status indicators */}
            {modelLoaded && <span title="Real-time Vosk WASM"><Zap size={16} className="text-green-400" /></span>}
            {connectionState !== 'connected' && (
              <span className="text-yellow-400 text-sm">
                {connectionState === 'disconnected' ? 'Offline' : 'Connecting...'}
              </span>
            )}
            
            {/* Mute button */}
            <button
              onClick={toggleMuted}
              className={`p-2 rounded-lg transition-all ${
                isMuted ? 'bg-red-500 text-white' : 'bg-clawd-border text-clawd-text-dim hover:bg-clawd-border/80'
              }`}
              title={isMuted ? 'Unmute (⌘M)' : 'Mute (⌘M)'}
            >
              {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
            <button
              onClick={() => setVoiceEnabled(!voiceEnabled)}
              className={`p-2 rounded-lg transition-all ${
                voiceEnabled ? 'bg-clawd-accent text-white' : 'bg-clawd-border text-clawd-text-dim'
              }`}
              title={voiceEnabled ? 'Voice responses on' : 'Voice responses off'}
            >
              {voiceEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
          </div>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'voice' ? (
        /* Voice Chat Tab */
        <div className="flex-1 overflow-hidden flex">
          {/* Voice Control Panel */}
          <div className="w-80 border-r border-clawd-border p-6 flex flex-col">
            {/* Status Orb */}
            <div className="flex-1 flex items-center justify-center">
              <div className="relative">
                <div 
                  className={`absolute inset-0 rounded-full blur-2xl transition-all duration-300 ${
                    isMuted ? 'bg-red-500/20 scale-110' :
                    modelLoading ? 'bg-blue-500/20 scale-125' :
                    processing ? 'bg-yellow-500/30 scale-150' :
                    speaking ? 'bg-green-500/30 scale-150' :
                    listening ? 'bg-clawd-accent/20' : 'bg-transparent'
                  }`}
                  style={{ transform: listening && !isMuted ? `scale(${1 + audioLevel * 0.5})` : undefined }}
                />
                
                <button
                  onClick={toggleConversation}
                  disabled={!canStart || processing || isMeetingActive || isMuted}
                  className={`relative w-40 h-40 rounded-full flex items-center justify-center transition-all duration-300 border-4 ${getOrbColor()} ${listening && !isMuted ? 'voice-orb-pulse' : ''} ${!canStart || isMeetingActive || isMuted ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {getOrbIcon()}
                </button>
              </div>
            </div>

            {/* Status Text */}
            <div className="text-center mb-6">
              <div className="text-lg font-medium mb-1">
                {isMuted ? '🔇 Muted' :
                 modelLoading ? 'Loading model...' :
                 processing ? 'Processing...' : 
                 speaking ? 'Speaking...' : 
                 listening ? 'Listening...' : 
                 canStart ? 'Tap to start conversation' :
                 'Model not ready'}
              </div>
              {statusMessage && (
                <div className="text-sm text-clawd-text-dim">{statusMessage}</div>
              )}
              {partialTranscript && (
                <div className="text-sm text-clawd-accent mt-2 italic animate-pulse">
                  "{partialTranscript}..."
                </div>
              )}
              {currentTranscript && !partialTranscript && (
                <div className="text-sm text-green-400 mt-2">
                  ✓ "{currentTranscript}"
                </div>
              )}
              {conversationMode && !processing && (
                <div className="text-xs text-clawd-accent mt-2 flex items-center justify-center gap-1">
                  <Zap size={12} />
                  Conversation mode — tap to stop
                </div>
              )}
              {!connected && (
                <div className="text-sm text-red-400 mt-2 flex items-center justify-center gap-2">
                  <WifiOff size={14} />
                  <span>Disconnected</span>
                  <button onClick={reconnect} className="text-clawd-accent hover:underline">
                    Reconnect
                  </button>
                </div>
              )}
            </div>

            {/* Quick Commands */}
            <div className="space-y-2">
              <p className="text-xs text-clawd-text-dim uppercase tracking-wide mb-2">Quick Commands</p>
              {quickCommands.map((cmd, i) => (
                <button
                  key={i}
                  onClick={async () => {
                    const response = await sendCommand(cmd);
                    if (response) await speak(response);
                  }}
                  disabled={!connected || processing}
                  className="w-full text-left px-4 py-2 bg-clawd-surface border border-clawd-border rounded-lg text-sm hover:border-clawd-accent transition-colors disabled:opacity-50"
                >
                  {cmd}
                </button>
              ))}
            </div>
          </div>

          {/* Conversation Panel */}
          <div className="flex-1 flex flex-col">
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-clawd-text-dim">
                  <div className="text-center">
                    <span className="text-6xl mb-4 block">🐸</span>
                    <p className="text-lg font-medium">Click the frog to start</p>
                    <p className="text-sm mt-2">Real-time transcription with Vosk WASM</p>
                    <p className="text-xs mt-4 text-clawd-text-dim">
                      💡 Your words appear as you speak!
                    </p>
                  </div>
                </div>
              ) : (
                messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                        msg.role === 'user'
                          ? 'bg-clawd-accent text-white rounded-br-md'
                          : 'bg-clawd-surface border border-clawd-border rounded-bl-md'
                      }`}
                    >
                      {msg.role === 'assistant' ? (
                        <MarkdownMessage content={msg.content} />
                      ) : (
                        <div className="flex items-center gap-2">
                          <Mic size={14} className="opacity-70" />
                          {msg.content}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
            
            {/* Clear history button */}
            {messages.length > 0 && (
              <div className="p-4 border-t border-clawd-border">
                <button
                  onClick={() => {
                    setMessages([]);
                    localStorage.removeItem('froggo-voice-history');
                  }}
                  className="text-sm text-clawd-text-dim hover:text-red-400 flex items-center gap-1"
                >
                  <Trash2 size={14} />
                  Clear history
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Meetings Tab */
        <div className="flex-1 overflow-hidden flex">
          {/* Meeting Control & Active Meeting Panel */}
          <div className="w-96 border-r border-clawd-border flex flex-col">
            {/* Big Start/End Meeting Button */}
            <div className="p-6 border-b border-clawd-border">
              {isMeetingActive ? (
                <button
                  onClick={endMeeting}
                  className="w-full py-6 bg-red-500 hover:bg-red-600 text-white rounded-xl text-xl font-bold flex items-center justify-center gap-3 transition-all shadow-lg shadow-red-500/20"
                >
                  <PhoneOff size={28} />
                  End Meeting
                </button>
              ) : (
                <button
                  onClick={startMeeting}
                  disabled={modelLoading}
                  className="w-full py-6 bg-green-500 hover:bg-green-600 text-white rounded-xl text-xl font-bold flex items-center justify-center gap-3 transition-all shadow-lg shadow-green-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {modelLoading ? (
                    <>
                      <Loader2 size={28} className="animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <Phone size={28} />
                      Start Meeting
                    </>
                  )}
                </button>
              )}
              
              {isMeetingActive && (
                <div className="mt-4 flex items-center justify-center gap-2 text-orange-400">
                  <span className="animate-pulse">●</span>
                  <span>Recording in progress...</span>
                </div>
              )}
              
              {statusMessage && (
                <div className="mt-2 text-sm text-center text-clawd-text-dim">{statusMessage}</div>
              )}
            </div>
            
            {/* Live Transcript / Meeting End Summary */}
            <div className="flex-1 overflow-y-auto p-4">
              {isMeetingActive ? (
                /* Active Meeting: Live Transcript */
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Brain size={18} className="text-orange-400" />
                    <span className="font-medium">Live Transcript</span>
                  </div>
                  
                  {/* Live partial */}
                  {partialTranscript && (
                    <div className="text-clawd-accent italic animate-pulse mb-2 text-sm">
                      "{partialTranscript}..."
                    </div>
                  )}
                  
                  {meetingTranscript.length === 0 ? (
                    <div className="text-clawd-text-dim text-sm text-center py-8">
                      <Mic size={32} className="mx-auto mb-2 opacity-30" />
                      <p>Transcript will appear here...</p>
                    </div>
                  ) : (
                    <div className="space-y-2 text-sm">
                      {meetingTranscript.map((line, i) => (
                        <p key={i} className="text-clawd-text bg-clawd-surface rounded px-3 py-2">{line}</p>
                      ))}
                      <div ref={meetingTranscriptEndRef} />
                    </div>
                  )}
                </div>
              ) : meetingEndSummary ? (
                /* Meeting Ended: Summary */
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <FileText size={18} className="text-green-400" />
                    <span className="font-medium">Meeting Summary</span>
                  </div>
                  
                  {meetingEndSummary.savedPath && (
                    <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 mb-4">
                      <p className="text-sm text-green-400">✓ Notes saved</p>
                      <p className="text-xs text-clawd-text-dim mt-1">{meetingEndSummary.savedPath.split('/').pop()}</p>
                    </div>
                  )}
                  
                  {meetingEndSummary.tasksCreated > 0 && (
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mb-4">
                      <p className="text-sm text-blue-400">✓ {meetingEndSummary.tasksCreated} task{meetingEndSummary.tasksCreated > 1 ? 's' : ''} created</p>
                      <ul className="text-xs text-clawd-text-dim mt-2 space-y-1">
                        {meetingEndSummary.extractedTasks.map((task, i) => (
                          <li key={i}>• {task}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {/* Keep transcript visible */}
                  {meetingTranscript.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm text-clawd-text-dim mb-2">Transcript:</p>
                      <div className="space-y-1 text-xs max-h-48 overflow-y-auto">
                        {meetingTranscript.map((line, i) => (
                          <p key={i} className="text-clawd-text-dim">{line}</p>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Send summary button */}
                  {(meetingTranscript.length > 0 || meetingActionItems.length > 0) && (
                    <button
                      onClick={sendMeetingSummary}
                      className="w-full mt-4 px-4 py-2 bg-clawd-accent rounded-lg text-sm flex items-center justify-center gap-2 hover:bg-clawd-accent/80"
                    >
                      <MessageSquare size={16} />
                      Send to Froggo
                    </button>
                  )}
                </div>
              ) : (
                /* No active meeting, no summary */
                <div className="text-clawd-text-dim text-sm text-center py-8">
                  <Phone size={32} className="mx-auto mb-2 opacity-30" />
                  <p>Start a meeting to begin transcription</p>
                </div>
              )}
            </div>
            
            {/* Detected Action Items */}
            {(isMeetingActive || meetingEndSummary) && meetingActionItems.length > 0 && (
              <div className="border-t border-clawd-border p-4">
                <div className="flex items-center gap-2 mb-2">
                  <ListTodo size={16} className="text-orange-400" />
                  <span className="text-sm font-medium text-orange-400">Detected Action Items</span>
                </div>
                <ul className="space-y-1 text-xs max-h-32 overflow-y-auto">
                  {meetingActionItems.slice(-5).map((item, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 bg-orange-500/20 rounded text-orange-300 text-[10px]">
                        {item.type}
                      </span>
                      <span className="text-clawd-text-dim truncate">{item.text.slice(0, 50)}...</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Past Meetings Panel */}
          <div className="flex-1 flex flex-col">
            {selectedMeeting ? (
              /* Selected Meeting Detail View */
              <div className="flex-1 flex flex-col">
                {/* Header */}
                <div className="p-4 border-b border-clawd-border flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        setSelectedMeeting(null);
                        setMeetingChatMessages([]);
                      }}
                      className="p-2 hover:bg-clawd-surface rounded-lg"
                    >
                      <X size={18} />
                    </button>
                    <div>
                      <h3 className="font-medium">
                        {selectedMeeting.date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                      </h3>
                      <p className="text-sm text-clawd-text-dim">{selectedMeeting.time}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => exportMeeting(selectedMeeting)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-clawd-surface border border-clawd-border rounded-lg text-sm hover:border-clawd-accent"
                  >
                    <Download size={14} />
                    Export
                  </button>
                </div>
                
                {/* Transcript */}
                <div className="flex-1 overflow-y-auto p-4">
                  <h4 className="text-sm font-medium text-clawd-text-dim mb-2">Transcript</h4>
                  <div className="space-y-2 text-sm mb-6">
                    {selectedMeeting.transcript.map((line, i) => (
                      <p key={i} className="text-clawd-text bg-clawd-surface rounded px-3 py-2">{line}</p>
                    ))}
                  </div>
                  
                  {selectedMeeting.actionItems.length > 0 && (
                    <>
                      <h4 className="text-sm font-medium text-clawd-text-dim mb-2">Action Items</h4>
                      <ul className="space-y-1 text-sm mb-6">
                        {selectedMeeting.actionItems.map((item, i) => (
                          <li key={i} className="text-clawd-text">• {item}</li>
                        ))}
                      </ul>
                    </>
                  )}
                  
                  {selectedMeeting.tasksCreated.length > 0 && (
                    <>
                      <h4 className="text-sm font-medium text-clawd-text-dim mb-2">Tasks Created</h4>
                      <ul className="space-y-1 text-sm">
                        {selectedMeeting.tasksCreated.map((task, i) => (
                          <li key={i} className="text-clawd-text">• {task}</li>
                        ))}
                      </ul>
                    </>
                  )}
                  
                  {/* AI Chat about meeting */}
                  <div className="mt-6 pt-4 border-t border-clawd-border">
                    <h4 className="text-sm font-medium text-clawd-text-dim mb-3 flex items-center gap-2">
                      <Brain size={16} />
                      Ask about this meeting
                    </h4>
                    
                    {/* Chat messages */}
                    {meetingChatMessages.length > 0 && (
                      <div className="space-y-3 mb-4 max-h-48 overflow-y-auto">
                        {meetingChatMessages.map((msg, i) => (
                          <div
                            key={i}
                            className={`text-sm ${
                              msg.role === 'user' 
                                ? 'text-right' 
                                : ''
                            }`}
                          >
                            <span className={`inline-block rounded-lg px-3 py-2 max-w-[90%] ${
                              msg.role === 'user'
                                ? 'bg-clawd-accent text-white'
                                : 'bg-clawd-surface border border-clawd-border'
                            }`}>
                              {msg.role === 'assistant' ? (
                                <MarkdownMessage content={msg.content} />
                              ) : (
                                msg.content
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Chat input */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={meetingChatInput}
                        onChange={(e) => setMeetingChatInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey && meetingChatInput.trim()) {
                            askAboutMeeting(selectedMeeting, meetingChatInput);
                          }
                        }}
                        placeholder="What were the main topics discussed?"
                        className="flex-1 px-3 py-2 bg-clawd-surface border border-clawd-border rounded-lg text-sm focus:outline-none focus:border-clawd-accent"
                        disabled={meetingChatProcessing}
                      />
                      <button
                        onClick={() => askAboutMeeting(selectedMeeting, meetingChatInput)}
                        disabled={!meetingChatInput.trim() || meetingChatProcessing}
                        className="px-3 py-2 bg-clawd-accent rounded-lg hover:bg-clawd-accent/80 disabled:opacity-50"
                      >
                        {meetingChatProcessing ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Send size={16} />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Past Meetings List */
              <div className="flex-1 flex flex-col">
                <div className="p-4 border-b border-clawd-border">
                  <h3 className="font-medium flex items-center gap-2">
                    <Clock size={18} />
                    Past Meetings
                  </h3>
                </div>
                
                <div className="flex-1 overflow-y-auto">
                  {loadingPastMeetings ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 size={24} className="animate-spin text-clawd-text-dim" />
                    </div>
                  ) : pastMeetings.length === 0 ? (
                    <div className="text-clawd-text-dim text-sm text-center py-8">
                      <Calendar size={32} className="mx-auto mb-2 opacity-30" />
                      <p>No past meetings found</p>
                      <p className="text-xs mt-1">Meetings are saved to ~/clawd/meetings/</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-clawd-border">
                      {pastMeetings.map((meeting, i) => (
                        <button
                          key={i}
                          onClick={() => setSelectedMeeting(meeting)}
                          className="w-full p-4 text-left hover:bg-clawd-surface/50 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">
                                {meeting.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                              </p>
                              <p className="text-sm text-clawd-text-dim">{meeting.time}</p>
                            </div>
                            <ChevronRight size={18} className="text-clawd-text-dim" />
                          </div>
                          {meeting.transcript.length > 0 && (
                            <p className="text-sm text-clawd-text-dim mt-2 line-clamp-2">
                              {meeting.transcript[0]}
                            </p>
                          )}
                          <div className="flex gap-2 mt-2">
                            {meeting.actionItems.length > 0 && (
                              <span className="text-xs px-2 py-0.5 bg-orange-500/20 text-orange-300 rounded">
                                {meeting.actionItems.length} action items
                              </span>
                            )}
                            {meeting.tasksCreated.length > 0 && (
                              <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded">
                                {meeting.tasksCreated.length} tasks
                              </span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* Refresh button */}
                <div className="p-4 border-t border-clawd-border">
                  <button
                    onClick={loadPastMeetings}
                    disabled={loadingPastMeetings}
                    className="text-sm text-clawd-text-dim hover:text-clawd-accent flex items-center gap-1"
                  >
                    <Loader2 size={14} className={loadingPastMeetings ? 'animate-spin' : ''} />
                    Refresh
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
