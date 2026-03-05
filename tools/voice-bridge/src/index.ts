// index.ts
// Mission Control Voice Bridge — Gemini Live API session manager.
// Runs as a standalone Node.js process alongside the Next.js app.

import { WebSocketServer, WebSocket } from 'ws';
import { loadAgentPersonalities, getDefaultPersonality, AgentPersonality } from './personality.js';
import { VOICE_FUNCTIONS } from './tools.js';

const PORT = parseInt(process.env.VOICE_BRIDGE_PORT || '8765', 10);
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
const GEMINI_MODEL = 'gemini-2.5-flash-native-audio-preview';

interface VoiceSession {
  ws: WebSocket;
  agentId: string;
  personality: AgentPersonality;
  startedAt: number;
}

const sessions = new Map<string, VoiceSession>();
const personalities = loadAgentPersonalities();

const wss = new WebSocketServer({ port: PORT });

console.log(`[voice-bridge] Listening on ws://localhost:${PORT}`);

wss.on('connection', (ws) => {
  const sessionId = Math.random().toString(36).slice(2);
  const personality = getDefaultPersonality();

  sessions.set(sessionId, { ws, agentId: 'mission-control', personality, startedAt: Date.now() });

  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data.toString());
      await handleMessage(sessionId, msg);
    } catch (err) {
      send(ws, { type: 'error', message: String(err) });
    }
  });

  ws.on('close', () => {
    sessions.delete(sessionId);
    console.log(`[voice-bridge] Session ${sessionId} closed`);
  });

  send(ws, { type: 'connected', sessionId, agent: personality.id, agentName: personality.name });
  console.log(`[voice-bridge] Session ${sessionId} connected`);
});

async function handleMessage(sessionId: string, msg: Record<string, unknown>) {
  const session = sessions.get(sessionId);
  if (!session) return;

  switch (msg.type) {
    case 'switch_agent': {
      const agentId = msg.agentId as string;
      const p = personalities.get(agentId);
      if (!p) {
        send(session.ws, { type: 'error', message: `Unknown agent: ${agentId}` });
        return;
      }
      session.agentId = agentId;
      session.personality = p;
      sessions.set(sessionId, session);
      send(session.ws, { type: 'agent_switched', agentId, agentName: p.name });
      break;
    }

    case 'text_input': {
      // Non-streaming text route for testing
      const response = await callGeminiText(session.personality, msg.text as string);
      send(session.ws, { type: 'text_response', text: response });
      break;
    }

    case 'function_result': {
      // Client executed a function call and is returning the result
      send(session.ws, { type: 'function_ack', callId: msg.callId });
      break;
    }

    case 'ping': {
      send(session.ws, { type: 'pong' });
      break;
    }

    default:
      send(session.ws, { type: 'error', message: `Unknown message type: ${msg.type}` });
  }
}

async function callGeminiText(personality: AgentPersonality, text: string): Promise<string> {
  if (!GEMINI_API_KEY) return '[Voice bridge: no Gemini API key configured]';

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const body = {
    system_instruction: { parts: [{ text: personality.systemInstruction }] },
    contents: [{ role: 'user', parts: [{ text }] }],
    tools: [{ function_declarations: VOICE_FUNCTIONS }],
    generation_config: { temperature: 0.7, max_output_tokens: 256 },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) return `[Gemini error: ${res.status}]`;

  const json = await res.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return json.candidates?.[0]?.content?.parts?.[0]?.text || '[no response]';
}

function send(ws: WebSocket, data: Record<string, unknown>) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}
