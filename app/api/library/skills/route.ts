// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const skillsDir = path.join(process.cwd(), '.claude/skills');
    if (!fs.existsSync(skillsDir)) return NextResponse.json({ skills: [] });

    const skills = fs.readdirSync(skillsDir)
      .filter(f => fs.statSync(path.join(skillsDir, f)).isDirectory())
      .map(name => {
        const skillPath = path.join(skillsDir, name, 'SKILL.md');
        let description = '';
        if (fs.existsSync(skillPath)) {
          const lines = fs.readFileSync(skillPath, 'utf-8').split('\n');
          // Find first non-empty, non-heading line for description
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
              description = trimmed.slice(0, 120);
              break;
            }
          }
        }
        return {
          id: name,
          name: name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          slug: name,
          path: `.claude/skills/${name}`,
          description,
        };
      });

    return NextResponse.json({ skills });
  } catch {
    return NextResponse.json({ skills: [] });
  }
}

// POST /api/library/skills — create a new skill from content or URL
// Body: { name, slug?, content?, url? }
export async function POST(req: NextRequest) {
  try {
    const { name, slug, content, url } = await req.json();
    if (!name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 });

    // Derive slug from name if not provided
    const id = (slug || name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (!id) return NextResponse.json({ error: 'invalid slug' }, { status: 400 });

    const skillsDir = path.join(process.cwd(), '.claude/skills');
    const skillDir = path.join(skillsDir, id);
    const skillFile = path.join(skillDir, 'SKILL.md');

    if (fs.existsSync(skillDir)) {
      return NextResponse.json({ error: `Skill "${id}" already exists` }, { status: 409 });
    }

    let body = '';

    if (url?.trim()) {
      // Fetch from URL
      const res = await fetch(url.trim());
      if (!res.ok) return NextResponse.json({ error: `Failed to fetch URL: ${res.status}` }, { status: 400 });
      const text = await res.text();
      // If it already has frontmatter, use as-is; otherwise wrap it
      body = text.trimStart().startsWith('---') ? text : `---\nname: ${id}\ndescription: ${name}\n---\n\n${text}`;
    } else if (content?.trim()) {
      body = content.trimStart().startsWith('---')
        ? content
        : `---\nname: ${id}\ndescription: ${name}\n---\n\n${content}`;
    } else {
      return NextResponse.json({ error: 'content or url is required' }, { status: 400 });
    }

    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(skillFile, body, 'utf-8');

    return NextResponse.json({
      id, slug: id, name,
      path: `.claude/skills/${id}`,
    }, { status: 201 });
  } catch (error) {
    console.error('POST /api/library/skills error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
