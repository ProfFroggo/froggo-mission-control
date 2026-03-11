// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { validateAgentId } from '@/lib/validateId';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { getDb } from '@/lib/database';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const HOME = homedir();

type Params = { params: Promise<{ id: string }> };

// ─── SVG fallback ─────────────────────────────────────────────────────────────

function buildSvgAvatar(emoji: string, color: string, name: string): string {
  const hex = color.replace('#', '').padEnd(6, '0');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const lighter = `rgb(${Math.min(255, r + 60)},${Math.min(255, g + 60)},${Math.min(255, b + 60)})`;
  const darker  = `rgb(${Math.max(0, r - 50)},${Math.max(0, g - 50)},${Math.max(0, b - 50)})`;
  const initials = name.trim().split(/\s+/).map(w => w[0]?.toUpperCase() || '').join('').slice(0, 2);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <defs>
    <radialGradient id="bg" cx="35%" cy="30%" r="80%">
      <stop offset="0%" stop-color="${lighter}"/>
      <stop offset="100%" stop-color="${darker}"/>
    </radialGradient>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${color}" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
    </radialGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="${darker}" flood-opacity="0.5"/>
    </filter>
  </defs>
  <!-- Background circle -->
  <circle cx="128" cy="128" r="128" fill="url(#bg)"/>
  <!-- Inner glow -->
  <circle cx="128" cy="128" r="100" fill="url(#glow)"/>
  <!-- Subtle texture ring -->
  <circle cx="128" cy="128" r="118" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1.5"/>
  <!-- Main emoji -->
  <text x="128" y="152" font-size="100" text-anchor="middle" dominant-baseline="middle"
    font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif"
    filter="url(#shadow)">${emoji}</text>
  <!-- Name initials watermark -->
  <text x="128" y="218" font-size="18" font-weight="800" text-anchor="middle"
    fill="rgba(255,255,255,0.45)" font-family="system-ui, -apple-system, sans-serif"
    letter-spacing="4">${initials}</text>
</svg>`;
}

// ─── DALL-E 3 generation ──────────────────────────────────────────────────────

async function generateDallEAvatar(name: string, role: string, emoji: string): Promise<Buffer | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const prompt = `Pixar 3D animated character portrait of a friendly AI assistant named "${name}" who works as a "${role}". Expressive cartoon face, large round eyes, smooth skin, soft studio lighting, vivid saturated colors. The character looks helpful, approachable, and slightly whimsical. Square composition, clean gradient background. No text, no labels. Professional high quality render.`;

  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt,
      size: '1024x1024',
      quality: 'standard',
      n: 1,
      response_format: 'b64_json',
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`DALL-E 3 error ${res.status}: ${err.slice(0, 120)}`);
  }

  const data = await res.json() as { data: Array<{ b64_json: string }> };
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error('DALL-E 3 returned no image data');
  return Buffer.from(b64, 'base64');
}

// ─── Route ────────────────────────────────────────────────────────────────────

// POST /api/agents/[id]/avatar/generate
// Attempts DALL-E 3 Pixar-style generation if OPENAI_API_KEY is set.
// Always falls back to a styled SVG avatar.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const guard = validateAgentId(id);
    if (guard) return guard;

    const body = await req.json().catch(() => ({}));
    const emoji = String(body.emoji ?? '🤖');
    const color = String(body.color ?? '#00BCD4');
    const name  = String(body.name  ?? id);
    const role  = String(body.role  ?? '');

    const assetsDir = join(HOME, 'mission-control', 'agents', id, 'assets');
    mkdirSync(assetsDir, { recursive: true });

    let avatarPath: string;
    let method: 'dalle3' | 'svg' = 'svg';
    let svgData: string | null = null;

    // Try DALL-E 3 first
    try {
      const pngBuffer = await generateDallEAvatar(name, role, emoji);
      if (pngBuffer) {
        avatarPath = join(assetsDir, 'avatar.png');
        writeFileSync(avatarPath, pngBuffer);
        method = 'dalle3';
      } else {
        throw new Error('No OPENAI_API_KEY — falling back to SVG');
      }
    } catch {
      // SVG fallback
      svgData = buildSvgAvatar(emoji, color, name);
      avatarPath = join(assetsDir, 'avatar.svg');
      writeFileSync(avatarPath, svgData, 'utf-8');
    }

    // Update catalog_agents avatar pointer
    try {
      const db = getDb();
      try {
        db.prepare(`UPDATE catalog_agents SET avatar = ?, updatedAt = ? WHERE id = ?`).run(avatarPath, Date.now(), id);
      } catch {
        db.prepare(`UPDATE catalog_agents SET avatar = ?, updated_at = ? WHERE id = ?`).run(avatarPath, Date.now(), id);
      }
    } catch { /* non-critical */ }

    return NextResponse.json({ path: avatarPath, method, svg: svgData });
  } catch (error) {
    console.error('POST /api/agents/[id]/avatar/generate error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
