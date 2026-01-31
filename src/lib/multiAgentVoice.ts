/**
 * Multi-Agent Voice System for Froggo Dashboard
 * Ported from Ox, adapted with Froggo as 6th agent + Gemini transcription
 */

import { GoogleGenAI, Modality } from '@google/genai';

export type AgentType = 'coder' | 'writer' | 'researcher' | 'hr' | 'chief' | 'froggo';

export interface AgentConfig {
  id: AgentType;
  name: string;
  voice: string;
  pitch: number;
  rate: number;
  description: string;
  systemInstruction: string;
}

export interface SharedContext {
  conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
    agent?: AgentType;
    timestamp: number;
  }>;
  activeScreen: string | null;
  webcamFeed: string | null;
  activeTasks: Array<{
    id: string;
    title: string;
    status: string;
  }>;
  agentActions: Array<{
    agent: AgentType;
    action: string;
    timestamp: number;
  }>;
}

export interface AgentSession {
  agent: AgentType;
  config: AgentConfig;
  liveSession: any | null;
  isActive: boolean;
}

export const AGENT_CONFIGS: Record<AgentType, AgentConfig> = {
  coder: {
    id: 'coder',
    name: 'Coder',
    voice: 'Charon',
    pitch: 0.9,
    rate: 1.0,
    description: 'Senior engineer for code review and debugging',
    systemInstruction: `You are Coder, a senior software engineer with deep technical expertise.

Your capabilities:
- Code review and analysis
- Debugging and problem-solving
- Architecture recommendations
- Can see the user's screen when shared (code editor, terminal, browser)
- Can create tasks in the Kanban system

When the user shares their screen, you can see their code, terminal output, and development environment.
Provide concise, actionable technical advice. Reference specific lines of code you see.

Keep responses brief for voice - around 2-3 sentences unless asked for more detail.`
  },

  writer: {
    id: 'writer',
    name: 'Writer',
    voice: 'Kore',
    pitch: 1.1,
    rate: 0.95,
    description: 'Content specialist for writing and documentation',
    systemInstruction: `You are Writer, a skilled content creator and communicator.

Your capabilities:
- Writing tweets, blog posts, documentation
- Editing and improving content
- Creating clear technical explanations
- Can see documents and content on screen when shared

You have access to the conversation context, so you know what was discussed with other agents.
Create engaging, clear content that matches the user's voice and goals.

Keep responses brief for voice - read drafts aloud concisely.`
  },

  researcher: {
    id: 'researcher',
    name: 'Researcher',
    voice: 'Zephyr',
    pitch: 1.0,
    rate: 1.05,
    description: 'Information gatherer and analyst',
    systemInstruction: `You are Researcher, a thorough information specialist.

Your capabilities:
- Finding and synthesizing information
- Analyzing documentation and resources
- Summarizing complex topics
- Can see research materials on screen when shared

You have access to prior conversation context from other agents.
Provide well-researched, accurate information in a clear format.

Keep responses brief for voice - summarize key findings.`
  },

  hr: {
    id: 'hr',
    name: 'HR',
    voice: 'Fenrir',
    pitch: 0.95,
    rate: 1.0,
    description: 'Task manager and agent coordinator',
    systemInstruction: `You are HR (High-level Routing), an orchestration manager.

Your capabilities:
- Creating and assigning tasks
- Coordinating between other agents
- Managing workflow and priorities
- Can see the Kanban board on screen when shared

You have full context of what other agents are working on.
Make quick, decisive task management decisions.

Keep responses brief and action-oriented.`
  },

  chief: {
    id: 'chief',
    name: 'Chief',
    voice: 'Charon',
    pitch: 0.85,
    rate: 0.9,
    description: 'Strategic advisor and decision maker',
    systemInstruction: `You are Chief, a strategic advisor who sees the big picture.

Your capabilities:
- High-level planning and strategy
- Making complex decisions
- Analyzing trade-offs and priorities
- Can see project overview on screen when shared

You have access to all conversation context and agent actions.
Provide thoughtful strategic guidance.

Keep responses brief but insightful - focus on the 'why' and 'what matters most'.`
  },

  froggo: {
    id: 'froggo',
    name: 'Froggo',
    voice: 'Puck',
    pitch: 1.0,
    rate: 1.0,
    description: 'Main orchestrator and dashboard conductor',
    systemInstruction: `You are Froggo 🐸, the main orchestrator of the Froggo Dashboard multi-agent system.

Your capabilities:
- Orchestrating and delegating work across all agents (Coder, Writer, Researcher, HR, Chief)
- Providing a friendly, approachable interface for the user
- Summarizing cross-agent activity and progress
- Making routing decisions about which agent should handle a request
- Managing meeting transcriptions and voice sessions
- Can see all shared context including screen, webcam, and conversation history

You are the default agent users connect to first. When a request is better handled by a specialist,
suggest switching: "This sounds like a job for Coder - want me to hand off?"

Your personality is warm, helpful, and slightly playful (you're a frog after all 🐸).
Keep responses brief for voice - 2-3 sentences unless the user asks for more.`
  }
};

export class MultiAgentVoiceSystem {
  private apiKey: string;
  private sessions: Map<AgentType, AgentSession>;
  private currentAgent: AgentType | null;
  private sharedContext: SharedContext;
  private ai: any;

  // Audio contexts
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;

  // Callbacks
  private onMessageCallback?: (agent: AgentType, role: 'user' | 'assistant', content: string) => void;
  private onAgentSwitchCallback?: (from: AgentType | null, to: AgentType) => void;
  private onStatusCallback?: (status: string) => void;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.ai = new GoogleGenAI({ apiKey });
    this.sessions = new Map();
    this.currentAgent = null;
    this.sharedContext = {
      conversationHistory: [],
      activeScreen: null,
      webcamFeed: null,
      activeTasks: [],
      agentActions: []
    };

    for (const agent of Object.keys(AGENT_CONFIGS) as AgentType[]) {
      this.sessions.set(agent, {
        agent,
        config: AGENT_CONFIGS[agent],
        liveSession: null,
        isActive: false
      });
    }
  }

  onMessage(callback: (agent: AgentType, role: 'user' | 'assistant', content: string) => void) {
    this.onMessageCallback = callback;
  }

  onAgentSwitch(callback: (from: AgentType | null, to: AgentType) => void) {
    this.onAgentSwitchCallback = callback;
  }

  onStatus(callback: (status: string) => void) {
    this.onStatusCallback = callback;
  }

  private buildSystemInstruction(agent: AgentType): string {
    const config = AGENT_CONFIGS[agent];
    const contextSummary = this.buildContextSummary();
    return `${config.systemInstruction}\n\n${contextSummary}`;
  }

  private buildContextSummary(): string {
    const recentHistory = this.sharedContext.conversationHistory.slice(-10);
    const recentActions = this.sharedContext.agentActions.slice(-5);

    let summary = '';

    if (recentHistory.length > 0) {
      summary += `\nRecent conversation:\n`;
      summary += recentHistory.map(m =>
        `${m.agent ? `[${m.agent}]` : '[User]'}: ${m.content}`
      ).join('\n');
    }

    if (this.sharedContext.activeTasks.length > 0) {
      summary += `\n\nActive tasks:\n`;
      summary += this.sharedContext.activeTasks.map(t =>
        `- ${t.title} (${t.status})`
      ).join('\n');
    }

    if (recentActions.length > 0) {
      summary += `\n\nRecent agent actions:\n`;
      summary += recentActions.map(a =>
        `- ${a.agent}: ${a.action}`
      ).join('\n');
    }

    return summary;
  }

  async switchAgent(to: AgentType): Promise<void> {
    const from = this.currentAgent;

    if (this.currentAgent && this.sessions.get(this.currentAgent)?.liveSession) {
      const currentSession = this.sessions.get(this.currentAgent)!;
      if (currentSession.liveSession) {
        try {
          currentSession.liveSession.close();
        } catch (error) {
          console.error('[MultiAgent] Error closing session:', error);
        }
        currentSession.liveSession = null;
        currentSession.isActive = false;
      }
    }

    const newSession = this.sessions.get(to)!;
    this.onStatusCallback?.(`Connecting to ${newSession.config.name}...`);

    try {
      await this.startAgent(to);
      this.currentAgent = to;
      this.onAgentSwitchCallback?.(from, to);
    } catch (error) {
      console.error(`Failed to switch to ${to}:`, error);
      this.onStatusCallback?.(`Failed to connect to ${newSession.config.name}`);
      throw error;
    }
  }

  private async startAgent(agent: AgentType): Promise<void> {
    const session = this.sessions.get(agent)!;
    const config = session.config;

    if (!this.inputAudioContext) {
      this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    }
    if (!this.outputAudioContext) {
      this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }

    const liveSession = await this.ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-12-2025',
      callbacks: {
        onopen: () => {
          session.isActive = true;
          this.onStatusCallback?.(`Connected to ${config.name}`);
        },
        onmessage: (message: any) => {
          if (message.serverContent?.outputTranscription) {
            const text = message.serverContent.outputTranscription.text;
            this.onMessageCallback?.(agent, 'assistant', text);
            this.sharedContext.conversationHistory.push({
              role: 'assistant',
              content: text,
              agent,
              timestamp: Date.now()
            });
          }

          if (message.serverContent?.inputTranscription) {
            const text = message.serverContent.inputTranscription.text;
            this.onMessageCallback?.(agent, 'user', text);
            this.sharedContext.conversationHistory.push({
              role: 'user',
              content: text,
              timestamp: Date.now()
            });
          }

          const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
          if (base64Audio && this.outputAudioContext) {
            this.playAudio(base64Audio);
          }
        },
        onerror: (error: any) => {
          console.error(`Live session error (${agent}):`, error);
          this.onStatusCallback?.(`Error: ${error.message || 'Connection failed'}`);
        },
        onclose: () => {
          session.isActive = false;
          session.liveSession = null;
          this.onStatusCallback?.(`Disconnected from ${config.name}`);
        }
      },
      config: {
        responseModalities: [Modality.AUDIO],
        systemInstruction: this.buildSystemInstruction(agent),
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: config.voice }
          }
        },
        outputAudioTranscription: {},
        inputAudioTranscription: {}
      }
    });

    session.liveSession = liveSession;
  }

  private async playAudio(base64Audio: string): Promise<void> {
    if (!this.outputAudioContext) return;

    try {
      const binaryString = atob(base64Audio);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const dataInt16 = new Int16Array(bytes.buffer);
      const frameCount = dataInt16.length;
      const buffer = this.outputAudioContext.createBuffer(1, frameCount, 24000);
      const channelData = buffer.getChannelData(0);

      for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i] / 32768.0;
      }

      const source = this.outputAudioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(this.outputAudioContext.destination);
      source.start();
    } catch (error) {
      console.error('Failed to play audio:', error);
    }
  }

  async startListening(stream: MediaStream): Promise<void> {
    if (!this.currentAgent) {
      throw new Error('No agent selected');
    }

    const session = this.sessions.get(this.currentAgent)!;
    if (!session.liveSession || !this.inputAudioContext) {
      throw new Error('Session not ready');
    }

    const source = this.inputAudioContext.createMediaStreamSource(stream);
    const scriptProcessor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);

    scriptProcessor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      const pcmBlob = this.createPCMBlob(inputData);
      session.liveSession?.sendRealtimeInput({ media: pcmBlob });
    };

    source.connect(scriptProcessor);
    scriptProcessor.connect(this.inputAudioContext.destination);
  }

  private createPCMBlob(data: Float32Array): { data: string; mimeType: string } {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
      int16[i] = data[i] * 32768;
    }

    let binary = '';
    const bytes = new Uint8Array(int16.buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }

    return {
      data: btoa(binary),
      mimeType: 'audio/pcm;rate=16000'
    };
  }

  async sendVideoFrame(type: 'screen' | 'webcam', base64Frame: string): Promise<void> {
    if (!this.currentAgent) return;

    const session = this.sessions.get(this.currentAgent)!;
    if (!session.liveSession) return;

    if (type === 'screen') {
      this.sharedContext.activeScreen = base64Frame;
    } else {
      this.sharedContext.webcamFeed = base64Frame;
    }

    session.liveSession.sendRealtimeInput({
      media: {
        mimeType: 'image/jpeg',
        data: base64Frame
      }
    });
  }

  logAgentAction(agent: AgentType, action: string): void {
    this.sharedContext.agentActions.push({
      agent,
      action,
      timestamp: Date.now()
    });
  }

  updateActiveTasks(tasks: Array<{ id: string; title: string; status: string }>): void {
    this.sharedContext.activeTasks = tasks;
  }

  getCurrentAgent(): AgentType | null {
    return this.currentAgent;
  }

  getSharedContext(): SharedContext {
    return this.sharedContext;
  }

  /** Export full conversation history for meeting transcription */
  exportTranscript(): SharedContext['conversationHistory'] {
    return [...this.sharedContext.conversationHistory];
  }

  async cleanup(): Promise<void> {
    for (const [, session] of this.sessions) {
      if (session.liveSession) {
        try {
          session.liveSession.close();
        } catch (error) {
          console.error('[MultiAgent] Error closing session during cleanup:', error);
        }
        session.liveSession = null;
        session.isActive = false;
      }
    }

    if (this.inputAudioContext && this.inputAudioContext.state !== 'closed') {
      try { await this.inputAudioContext.close(); } catch {}
    }
    if (this.outputAudioContext && this.outputAudioContext.state !== 'closed') {
      try { await this.outputAudioContext.close(); } catch {}
    }

    this.inputAudioContext = null;
    this.outputAudioContext = null;
    this.currentAgent = null;
  }
}

/**
 * Gemini-based meeting transcription service
 * Uses Gemini's audio understanding for post-session transcription
 */
export class GeminiTranscriptionService {
  private ai: any;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  /**
   * Transcribe an audio blob using Gemini's multimodal capabilities
   */
  async transcribeAudio(audioBlob: Blob, mimeType: string = 'audio/webm'): Promise<string> {
    const base64 = await this.blobToBase64(audioBlob);

    const response = await this.ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{
        parts: [
          {
            inlineData: {
              mimeType,
              data: base64
            }
          },
          {
            text: 'Transcribe this audio accurately. Include speaker labels if multiple speakers are detected. Format as a clean transcript with timestamps where possible.'
          }
        ]
      }]
    });

    return response.text || '';
  }

  /**
   * Summarize a meeting transcript using Gemini
   */
  async summarizeMeeting(transcript: string): Promise<{
    summary: string;
    actionItems: string[];
    keyDecisions: string[];
    participants: string[];
  }> {
    const response = await this.ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{
        parts: [{
          text: `Analyze this meeting transcript and provide a structured summary.

Transcript:
${transcript}

Respond in this exact JSON format:
{
  "summary": "Brief 2-3 sentence summary of the meeting",
  "actionItems": ["action item 1", "action item 2"],
  "keyDecisions": ["decision 1", "decision 2"],
  "participants": ["participant names detected"]
}`
        }]
      }]
    });

    try {
      const text = response.text || '{}';
      const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
      return JSON.parse(cleaned);
    } catch {
      return {
        summary: response.text || 'Failed to generate summary',
        actionItems: [],
        keyDecisions: [],
        participants: []
      };
    }
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1] || '');
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}
