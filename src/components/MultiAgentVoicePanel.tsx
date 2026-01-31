import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic, MicOff, Phone, PhoneOff, Video, VideoOff, Monitor, MonitorOff,
  User, MessageSquare, Settings, ChevronDown, Activity,
  Brain, FileText, Search, Users, Crown, Smile, Ear
} from 'lucide-react';
import { useStore } from '../store/store';
import MeetingTranscribe from './MeetingTranscribe';
import MarkdownMessage from './MarkdownMessage';
import { MultiAgentVoiceSystem, AgentType, AGENT_CONFIGS } from '../lib/multiAgentVoice';
import { logVoiceAction } from '../services/voiceLogService';

interface VoiceMessage {
  role: 'user' | 'assistant';
  content: string;
  agent?: AgentType;
  timestamp: number;
}

const AGENT_ICONS: Record<AgentType, React.ElementType> = {
  coder: Brain,
  writer: FileText,
  researcher: Search,
  hr: Users,
  chief: Crown,
  froggo: Smile
};

const AGENT_COLORS: Record<AgentType, string> = {
  coder: 'text-blue-400',
  writer: 'text-purple-400',
  researcher: 'text-green-400',
  hr: 'text-yellow-400',
  chief: 'text-red-400',
  froggo: 'text-emerald-400'
};

type PanelTab = 'voice' | 'scribe';

export default function MultiAgentVoicePanel() {
  const { addActivity } = useStore();

  const [activeTab, setActiveTab] = useState<PanelTab>('voice');
  const [voiceSystem, setVoiceSystem] = useState<MultiAgentVoiceSystem | null>(null);
  const [currentAgent, setCurrentAgent] = useState<AgentType>('froggo');
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const [messages, setMessages] = useState<VoiceMessage[]>(() => {
    try {
      const saved = localStorage.getItem('froggo-multiagent-voice-history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [screenShareEnabled, setScreenShareEnabled] = useState(false);
  const [webcamEnabled, setWebcamEnabled] = useState(false);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [webcamStream, setWebcamStream] = useState<MediaStream | null>(null);

  const [showAgentSelector, setShowAgentSelector] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const screenFrameIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const webcamFrameIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize voice system
  useEffect(() => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || localStorage.getItem('gemini_api_key');

    if (!apiKey || apiKey === 'your_key_here') {
      setStatusMessage('Please set your Gemini API key in Settings');
      return;
    }

    const system = new MultiAgentVoiceSystem(apiKey);

    system.onMessage((agent, role, content) => {
      console.log('[MultiAgent]', agent, role, content);
      const message: VoiceMessage = {
        role,
        content,
        agent: role === 'assistant' ? agent : undefined,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, message]);
      logVoiceAction(agent, role === 'user' ? 'user_input' : 'agent_response', { content });
    });

    system.onAgentSwitch((from, to) => {
      console.log('[MultiAgent] Switched:', from, '→', to);
      setCurrentAgent(to);
      setStatusMessage(`Switched to ${AGENT_CONFIGS[to].name}`);
      addActivity({
        type: 'system',
        message: `🎭 Switched to ${AGENT_CONFIGS[to].name}`,
        timestamp: Date.now()
      });
      logVoiceAction(to, 'agent_switch', { from, to });
    });

    system.onStatus((status) => {
      console.log('[MultiAgent] Status:', status);
      setStatusMessage(status);
    });

    setVoiceSystem(system);

    return () => {
      system.cleanup();
    };
  }, [addActivity]);

  // Persist messages
  useEffect(() => {
    try {
      localStorage.setItem('froggo-multiagent-voice-history', JSON.stringify(messages));
    } catch (e) {
      console.error('[MultiAgent] Failed to save history:', e);
    }
  }, [messages]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const connect = useCallback(async () => {
    if (!voiceSystem) {
      setStatusMessage('Voice system not initialized');
      return;
    }
    try {
      setStatusMessage('Connecting...');
      await voiceSystem.switchAgent(currentAgent);
      setIsConnected(true);
      setStatusMessage('Connected');
      addActivity({
        type: 'system',
        message: `🎙️ Connected to ${AGENT_CONFIGS[currentAgent].name}`,
        timestamp: Date.now()
      });
      logVoiceAction(currentAgent, 'session_start', {});
    } catch (error) {
      console.error('[MultiAgent] Failed to connect:', error);
      setStatusMessage('Connection failed');
      setIsConnected(false);
    }
  }, [voiceSystem, currentAgent, addActivity]);

  const disconnect = useCallback(async () => {
    if (!voiceSystem) return;
    await stopListening();
    await stopScreenShare();
    await stopWebcam();
    await voiceSystem.cleanup();
    setIsConnected(false);
    setStatusMessage('Disconnected');
    logVoiceAction(currentAgent, 'session_end', {});
  }, [voiceSystem, currentAgent]);

  const startListening = useCallback(async () => {
    if (!voiceSystem || !isConnected) {
      setStatusMessage('Not connected');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 16000 }
      });
      audioStreamRef.current = stream;
      await voiceSystem.startListening(stream);
      setIsListening(true);
      setStatusMessage('Listening...');
      logVoiceAction(currentAgent, 'listening_start', {});
    } catch (error) {
      console.error('[MultiAgent] Failed to start listening:', error);
      setStatusMessage('Microphone access denied');
    }
  }, [voiceSystem, isConnected, currentAgent]);

  const stopListening = useCallback(async () => {
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }
    setIsListening(false);
    setStatusMessage('Stopped listening');
    logVoiceAction(currentAgent, 'listening_stop', {});
  }, [currentAgent]);

  const toggleListening = useCallback(async () => {
    if (isListening) await stopListening();
    else await startListening();
  }, [isListening, startListening, stopListening]);

  const startScreenShare = useCallback(async () => {
    if (!voiceSystem || !isConnected) { setStatusMessage('Not connected'); return; }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 1 } });
      setScreenStream(stream);
      setScreenShareEnabled(true);

      const captureFrame = async () => {
        if (!stream.active) { await stopScreenShare(); return; }
        const video = document.createElement('video');
        video.srcObject = stream;
        video.play();
        await new Promise(resolve => { video.onloadedmetadata = resolve; });
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(video, 0, 0);
        const base64 = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
        await voiceSystem.sendVideoFrame('screen', base64);
      };
      screenFrameIntervalRef.current = setInterval(captureFrame, 1000);
      setStatusMessage('Screen sharing enabled');
      logVoiceAction(currentAgent, 'screen_share_start', {});
    } catch (error) {
      console.error('[MultiAgent] Failed to share screen:', error);
      setStatusMessage('Screen share denied');
    }
  }, [voiceSystem, isConnected, currentAgent]);

  const stopScreenShare = useCallback(async () => {
    if (screenFrameIntervalRef.current) { clearInterval(screenFrameIntervalRef.current); screenFrameIntervalRef.current = null; }
    if (screenStream) { screenStream.getTracks().forEach(track => track.stop()); setScreenStream(null); }
    setScreenShareEnabled(false);
    setStatusMessage('Screen sharing stopped');
    logVoiceAction(currentAgent, 'screen_share_stop', {});
  }, [screenStream, currentAgent]);

  const toggleScreenShare = useCallback(async () => {
    if (screenShareEnabled) await stopScreenShare();
    else await startScreenShare();
  }, [screenShareEnabled, startScreenShare, stopScreenShare]);

  const startWebcam = useCallback(async () => {
    if (!voiceSystem || !isConnected) { setStatusMessage('Not connected'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      setWebcamStream(stream);
      setWebcamEnabled(true);

      const captureFrame = async () => {
        const video = document.createElement('video');
        video.srcObject = stream;
        video.play();
        await new Promise(resolve => { video.onloadedmetadata = resolve; });
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(video, 0, 0);
        const base64 = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
        await voiceSystem.sendVideoFrame('webcam', base64);
      };
      webcamFrameIntervalRef.current = setInterval(captureFrame, 1000);
      setStatusMessage('Webcam enabled');
      logVoiceAction(currentAgent, 'webcam_start', {});
    } catch (error) {
      console.error('[MultiAgent] Failed to start webcam:', error);
      setStatusMessage('Webcam access denied');
    }
  }, [voiceSystem, isConnected, currentAgent]);

  const stopWebcam = useCallback(async () => {
    if (webcamFrameIntervalRef.current) { clearInterval(webcamFrameIntervalRef.current); webcamFrameIntervalRef.current = null; }
    if (webcamStream) { webcamStream.getTracks().forEach(track => track.stop()); setWebcamStream(null); }
    setWebcamEnabled(false);
    setStatusMessage('Webcam stopped');
    logVoiceAction(currentAgent, 'webcam_stop', {});
  }, [webcamStream, currentAgent]);

  const toggleWebcam = useCallback(async () => {
    if (webcamEnabled) await stopWebcam();
    else await startWebcam();
  }, [webcamEnabled, startWebcam, stopWebcam]);

  const switchAgent = useCallback(async (newAgent: AgentType) => {
    if (!voiceSystem || !isConnected || newAgent === currentAgent) return;
    try {
      await voiceSystem.switchAgent(newAgent);
      setShowAgentSelector(false);
    } catch (error) {
      console.error('[MultiAgent] Failed to switch agent:', error);
    }
  }, [voiceSystem, isConnected, currentAgent]);

  const clearHistory = useCallback(() => {
    setMessages([]);
    localStorage.removeItem('froggo-multiagent-voice-history');
    setStatusMessage('History cleared');
  }, []);

  const AgentIcon = AGENT_ICONS[currentAgent];

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white">
      {/* Header with Tabs */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center space-x-3">
          {/* Tab switcher */}
          <div className="flex bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('voice')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 ${
                activeTab === 'voice'
                  ? 'bg-emerald-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Activity className="w-4 h-4" />
              Voice Chat
            </button>
            <button
              onClick={() => setActiveTab('scribe')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 ${
                activeTab === 'scribe'
                  ? 'bg-emerald-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Ear className="w-4 h-4" />
              Meeting Scribe
            </button>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {activeTab === 'voice' && (
            <>
              <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                isConnected ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 text-gray-400'
              }`}>
                {isConnected ? 'Connected' : 'Disconnected'}
              </div>
              <button onClick={() => setShowSettings(!showSettings)} className="p-2 hover:bg-gray-700 rounded transition-colors" title="Settings">
                <Settings className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Meeting Scribe Tab */}
      {activeTab === 'scribe' && <MeetingTranscribe />}

      {activeTab === 'voice' && (<>
      {/* Agent Selector */}
      <div className="p-4 border-b border-gray-700">
        <div className="relative">
          <button
            onClick={() => setShowAgentSelector(!showAgentSelector)}
            disabled={!isConnected}
            className="w-full flex items-center justify-between p-3 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-center space-x-3">
              <AgentIcon className={`w-5 h-5 ${AGENT_COLORS[currentAgent]}`} />
              <div className="text-left">
                <div className="font-medium">{AGENT_CONFIGS[currentAgent].name}</div>
                <div className="text-xs text-gray-400">{AGENT_CONFIGS[currentAgent].description}</div>
              </div>
            </div>
            <ChevronDown className={`w-4 h-4 transition-transform ${showAgentSelector ? 'rotate-180' : ''}`} />
          </button>

          {showAgentSelector && (
            <div className="absolute top-full mt-2 w-full bg-gray-800 rounded-lg shadow-xl border border-gray-700 z-10 overflow-hidden">
              {(Object.keys(AGENT_CONFIGS) as AgentType[]).map((agent) => {
                const Icon = AGENT_ICONS[agent];
                const config = AGENT_CONFIGS[agent];
                return (
                  <button
                    key={agent}
                    onClick={() => switchAgent(agent)}
                    className={`w-full flex items-center space-x-3 p-3 hover:bg-gray-700 transition-colors ${
                      agent === currentAgent ? 'bg-gray-700/50' : ''
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${AGENT_COLORS[agent]}`} />
                    <div className="text-left flex-1">
                      <div className="font-medium">{config.name}</div>
                      <div className="text-xs text-gray-400">{config.description}</div>
                    </div>
                    {agent === currentAgent && <div className="w-2 h-2 bg-green-400 rounded-full" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <AgentIcon className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-sm">No messages yet</p>
            <p className="text-xs mt-2">Click Connect and start talking</p>
          </div>
        ) : (
          <>
            {messages.map((msg, idx) => {
              const MsgIcon = msg.agent ? AGENT_ICONS[msg.agent] : User;
              const msgColor = msg.agent ? AGENT_COLORS[msg.agent] : 'text-gray-400';
              return (
                <div key={idx} className={`flex space-x-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    msg.role === 'user' ? 'bg-blue-500/20' : 'bg-gray-700'
                  }`}>
                    <MsgIcon className={`w-4 h-4 ${msg.role === 'user' ? 'text-blue-400' : msgColor}`} />
                  </div>
                  <div className={`flex-1 ${msg.role === 'user' ? 'text-right' : ''}`}>
                    <div className="text-xs text-gray-500 mb-1">
                      {msg.role === 'user' ? 'You' : AGENT_CONFIGS[msg.agent!].name}
                      {' • '}
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </div>
                    <div className={`inline-block px-4 py-2 rounded-lg ${
                      msg.role === 'user'
                        ? 'bg-blue-500/20 text-blue-100'
                        : 'bg-gray-800 text-gray-100'
                    }`}>
                      <MarkdownMessage content={msg.content} />
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Status bar */}
      {statusMessage && (
        <div className="px-4 py-2 bg-gray-800 border-t border-gray-700 text-sm text-gray-400">
          {statusMessage}
        </div>
      )}

      {/* Controls */}
      <div className="p-4 border-t border-gray-700 bg-gray-800">
        {!isConnected ? (
          <button
            onClick={connect}
            disabled={!voiceSystem}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            <Phone className="w-5 h-5" />
            <span>Connect to {AGENT_CONFIGS[currentAgent].name}</span>
          </button>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={toggleListening}
                className={`py-3 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2 ${
                  isListening ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                <span>{isListening ? 'Stop' : 'Talk'}</span>
              </button>
              <button
                onClick={disconnect}
                className="py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
              >
                <PhoneOff className="w-5 h-5" />
                <span>Disconnect</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={toggleScreenShare}
                className={`py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center space-x-2 ${
                  screenShareEnabled ? 'bg-purple-600 hover:bg-purple-700' : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                {screenShareEnabled ? <MonitorOff className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
                <span>Screen</span>
              </button>
              <button
                onClick={toggleWebcam}
                className={`py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center space-x-2 ${
                  webcamEnabled ? 'bg-pink-600 hover:bg-pink-700' : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                {webcamEnabled ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                <span>Webcam</span>
              </button>
            </div>

            <button
              onClick={clearHistory}
              className="w-full py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors flex items-center justify-center space-x-2"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Clear History</span>
            </button>
          </div>
        )}
      </div>

      {/* Settings modal */}
      {showSettings && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center p-4 z-20">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">🐸 Voice Settings</h3>
              <button onClick={() => setShowSettings(false)} className="p-1 hover:bg-gray-700 rounded transition-colors">
                <Settings className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Gemini API Key</label>
                <input
                  type="password"
                  placeholder="Enter your API key"
                  defaultValue={localStorage.getItem('gemini_api_key') || ''}
                  onChange={(e) => localStorage.setItem('gemini_api_key', e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-emerald-500 outline-none"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Get your key from{' '}
                  <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">
                    Google AI Studio
                  </a>
                </p>
              </div>
              <div className="pt-4 border-t border-gray-700">
                <h4 className="text-sm font-medium mb-2">Agent Voices</h4>
                <div className="space-y-2 text-sm">
                  {(Object.keys(AGENT_CONFIGS) as AgentType[]).map((agent) => {
                    const Icon = AGENT_ICONS[agent];
                    return (
                      <div key={agent} className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Icon className={`w-4 h-4 ${AGENT_COLORS[agent]}`} />
                          <span>{AGENT_CONFIGS[agent].name}</span>
                        </div>
                        <span className="text-gray-400">{AGENT_CONFIGS[agent].voice}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      </>)}
    </div>
  );
}
