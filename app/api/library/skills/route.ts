import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

export async function GET() {
  try {
    const skillsDir = path.join(process.cwd(), '.claude/skills');
    if (!fs.existsSync(skillsDir)) return NextResponse.json([]);
    const skills = fs.readdirSync(skillsDir)
      .filter(f => fs.statSync(path.join(skillsDir, f)).isDirectory())
      .map(name => ({ id: name, name, path: `.claude/skills/${name}` }));
    return NextResponse.json(skills);
  } catch {
    return NextResponse.json([]);
  }
}
