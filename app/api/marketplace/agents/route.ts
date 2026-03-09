// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextResponse } from 'next/server';

// Marketplace agent catalog — installable agents, not local running agents
const MARKETPLACE_AGENTS = [
  {
    id: 'writer-agent',
    name: 'Writer',
    version: '1.0.0',
    author: 'Mission Control',
    description: 'Writes content, drafts, and copy across formats.',
    category: 'productivity',
    downloads: 0,
    verified: true,
    sha256: '',
    icon: 'PenLine',
    tags: ['writing', 'content'],
    manifestUrl: '',
    packageUrl: '',
    installed: false,
    builtin: true,
    agent: { agentId: 'writer', soulPreview: 'A writing specialist agent.' },
  },
  {
    id: 'researcher-agent',
    name: 'Researcher',
    version: '1.0.0',
    author: 'Mission Control',
    description: 'Researches topics, finds sources, and synthesizes information.',
    category: 'productivity',
    downloads: 0,
    verified: true,
    sha256: '',
    icon: 'BookOpen',
    tags: ['research', 'analysis'],
    manifestUrl: '',
    packageUrl: '',
    installed: false,
    builtin: true,
    agent: { agentId: 'researcher', soulPreview: 'A research specialist agent.' },
  },
];

export async function GET() {
  return NextResponse.json({ agents: MARKETPLACE_AGENTS });
}
