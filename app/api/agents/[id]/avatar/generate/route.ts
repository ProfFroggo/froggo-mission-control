// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { validateAgentId } from '@/lib/validateId';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { getDb } from '@/lib/database';
import sharp from 'sharp';

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
  <circle cx="128" cy="128" r="128" fill="url(#bg)"/>
  <circle cx="128" cy="128" r="100" fill="url(#glow)"/>
  <circle cx="128" cy="128" r="118" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1.5"/>
  <text x="128" y="152" font-size="100" text-anchor="middle" dominant-baseline="middle"
    font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif"
    filter="url(#shadow)">${emoji}</text>
  <text x="128" y="218" font-size="18" font-weight="800" text-anchor="middle"
    fill="rgba(255,255,255,0.45)" font-family="system-ui, -apple-system, sans-serif"
    letter-spacing="4">${initials}</text>
</svg>`;
}

// ─── Gemini Imagen generation ─────────────────────────────────────────────────

async function getGeminiKey(): Promise<string | null> {
  // 1. Keychain (stored by setup wizard via /api/settings/gemini_api_key)
  try {
    const { keychainGet } = await import('@/lib/keychain');
    const val = await keychainGet('gemini_api_key');
    if (val) return val.trim();
  } catch { /* keytar unavailable */ }

  // 2. Env var fallback
  const envKey = process.env.GEMINI_API_KEY;
  if (envKey && envKey.trim()) return envKey.trim();

  // 3. Settings DB fallback
  try {
    const db = getDb();
    const row = db.prepare(`SELECT value FROM settings WHERE key = 'gemini_api_key'`).get() as { value: string } | undefined;
    if (row?.value) return row.value.trim();
  } catch { /* ignore */ }

  return null;
}

async function generateGeminiAvatar(name: string, role: string, personality: string): Promise<Buffer | null> {
  const apiKey = await getGeminiKey();
  if (!apiKey) return null;

  const prompt = `Pixar 3D animated character portrait headshot of a friendly AI assistant named "${name}" who works as "${role}". ${personality ? `Personality: ${personality}.` : ''} Expressive cartoon face, large round eyes, smooth Pixar-style skin, warm studio lighting, vivid saturated colors. The character looks helpful, intelligent, and slightly whimsical. Square composition, soft gradient background. No text, no labels, no watermarks. High quality Pixar render, cinematic lighting.`;

  // Use Imagen 4 via the Gemini API
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio: '1:1',
          personGeneration: 'allow_adult',
        },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`Gemini Imagen error ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json() as { predictions?: Array<{ bytesBase64Encoded?: string }> };
  const b64 = data.predictions?.[0]?.bytesBase64Encoded;
  if (!b64) throw new Error('Gemini Imagen returned no image data');
  return Buffer.from(b64, 'base64');
}

// ─── Route ────────────────────────────────────────────────────────────────────

// POST /api/agents/[id]/avatar/generate
// Generates a Pixar-style headshot via Gemini Imagen 3 if GEMINI_API_KEY is set.
// Falls back to a styled SVG avatar with emoji + initials.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const guard = validateAgentId(id);
    if (guard) return guard;

    const body = await req.json().catch(() => ({}));
    const emoji       = String(body.emoji       ?? '🤖');
    const color       = String(body.color       ?? '#00BCD4');
    const name        = String(body.name        ?? id);
    const role        = String(body.role        ?? '');
    const personality = String(body.personality ?? '');

    const assetsDir = join(HOME, 'mission-control', 'agents', id, 'assets');
    mkdirSync(assetsDir, { recursive: true });

    let avatarPath: string;
    let method: 'gemini' | 'svg' = 'svg';
    let svgData: string | null = null;
    let pngBase64: string | null = null;

    // Try Gemini Imagen first
    try {
      const pngBuffer = await generateGeminiAvatar(name, role, personality);
      if (pngBuffer) {
        // Convert PNG → WebP (512×512, quality 90)
        const webpBuffer = await sharp(pngBuffer)
          .resize(512, 512, { fit: 'cover' })
          .webp({ quality: 90 })
          .toBuffer();
        avatarPath = join(assetsDir, 'avatar.webp');
        writeFileSync(avatarPath, webpBuffer);
        method = 'gemini';
        pngBase64 = webpBuffer.toString('base64');
      } else {
        throw new Error('No GEMINI_API_KEY configured');
      }
    } catch (genErr) {
      console.warn('[avatar/generate] Gemini failed, using SVG fallback:', genErr instanceof Error ? genErr.message : genErr);
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

    return NextResponse.json({ path: avatarPath, method, svg: svgData, png: pngBase64 });
  } catch (error) {
    console.error('POST /api/agents/[id]/avatar/generate error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
