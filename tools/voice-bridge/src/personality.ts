// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// personality.ts
// Loads agent SOUL.md files and builds Gemini system instructions + voice map.

import fs from 'fs';
import path from 'path';

const AGENTS_DIR = path.join(
  process.env.PROJECT_DIR || path.join(process.env.HOME!, 'git', 'mission-control-nextjs'),
  '.claude', 'agents'
);

export interface AgentPersonality {
  id: string;
  name: string;
  description: string;
  systemInstruction: string;
  voiceStyle: 'neutral' | 'confident' | 'analytical' | 'creative' | 'supportive';
}

// Voice style map — matches Gemini's prebuilt voice characteristics
const VOICE_STYLE_MAP: Record<string, AgentPersonality['voiceStyle']> = {
  'mission-control': 'confident',
  'chief':           'confident',
  'clara':           'analytical',
  'senior-coder':    'analytical',
  'coder':           'analytical',
  'researcher':      'analytical',
  'writer':          'neutral',
  'designer':        'creative',
  'social-manager':  'creative',
  'growth-director': 'confident',
  'hr':              'supportive',
  'inbox':           'neutral',
  'voice':           'neutral',
  'discord-manager': 'supportive',
  'finance-manager': 'analytical',
};

function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const result: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const [key, ...rest] = line.split(':');
    if (key && rest.length) result[key.trim()] = rest.join(':').trim();
  }
  return result;
}

export function loadAgentPersonalities(): Map<string, AgentPersonality> {
  const personalities = new Map<string, AgentPersonality>();

  if (!fs.existsSync(AGENTS_DIR)) return personalities;

  for (const file of fs.readdirSync(AGENTS_DIR)) {
    if (!file.endsWith('.md')) continue;
    const agentId = file.replace('.md', '');
    const content = fs.readFileSync(path.join(AGENTS_DIR, file), 'utf8');
    const meta = parseFrontmatter(content);

    // Strip frontmatter to get body
    const body = content.replace(/^---\n[\s\S]*?\n---\n?/, '').trim();

    const name = meta.name || agentId;
    const description = meta.description || '';

    personalities.set(agentId, {
      id:               agentId,
      name,
      description,
      systemInstruction: buildSystemInstruction(name, description, body),
      voiceStyle:        VOICE_STYLE_MAP[agentId] || 'neutral',
    });
  }

  return personalities;
}

function buildSystemInstruction(name: string, description: string, body: string): string {
  return `You are ${name} — ${description}

You are operating as a voice interface. Keep responses concise and conversational (1-3 sentences max unless the user explicitly asks for detail). You can be asked to perform tasks, answer questions, or route work to other agents.

${body.slice(0, 800)}

When you cannot complete a task directly, say "I'll route that to [agent name]" and use the delegate_to_claude function.`;
}

export function getDefaultPersonality(): AgentPersonality {
  return {
    id:               'mission-control',
    name:             'Mission Control',
    description:      'Main orchestrator',
    systemInstruction: 'You are Mission Control, the main AI orchestrator. Help the user route tasks, check status, and coordinate work. Keep responses brief and actionable.',
    voiceStyle:        'confident',
  };
}
