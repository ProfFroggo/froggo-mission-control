// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

// Built-in module catalog
const BUILTIN_MODULES = [
  { id: 'finance', name: 'Finance', version: '1.0.0', author: 'Mission Control', description: 'Budget tracking and financial overview.', category: 'finance', icon: 'DollarSign', verified: true, downloads: 0, sha256: '', manifestUrl: '', packageUrl: '' },
  { id: 'analytics', name: 'Analytics', version: '1.0.0', author: 'Mission Control', description: 'Token usage, agent activity, and task stats.', category: 'analytics', icon: 'BarChart2', verified: true, downloads: 0, sha256: '', manifestUrl: '', packageUrl: '' },
  { id: 'calendar', name: 'Calendar', version: '1.0.0', author: 'Mission Control', description: 'Schedule management and event tracking.', category: 'productivity', icon: 'Calendar', verified: true, downloads: 0, sha256: '', manifestUrl: '', packageUrl: '' },
  { id: 'inbox', name: 'Inbox', version: '1.0.0', author: 'Mission Control', description: 'Unified message inbox.', category: 'communications', icon: 'Inbox', verified: true, downloads: 0, sha256: '', manifestUrl: '', packageUrl: '' },
  { id: 'library', name: 'Library', version: '1.0.0', author: 'Mission Control', description: 'File and knowledge library.', category: 'productivity', icon: 'BookOpen', verified: true, downloads: 0, sha256: '', manifestUrl: '', packageUrl: '' },
  { id: 'voice', name: 'Voice Chat', version: '1.0.0', author: 'Mission Control', description: 'Voice-based agent interaction.', category: 'communications', icon: 'Mic', verified: true, downloads: 0, sha256: '', manifestUrl: '', packageUrl: '' },
];

export async function GET() {
  try {
    const db = getDb();
    const installed = db.prepare('SELECT module_id, enabled FROM module_state').all() as { module_id: string; enabled: number }[];
    const installedMap = Object.fromEntries(installed.map(r => [r.module_id, r.enabled === 1]));

    const modules = BUILTIN_MODULES.map(m => ({
      ...m,
      builtin: true,
      installed: installedMap[m.id] !== undefined,
    }));

    return NextResponse.json({ modules });
  } catch {
    return NextResponse.json({ modules: BUILTIN_MODULES.map(m => ({ ...m, builtin: true, installed: false })) });
  }
}
