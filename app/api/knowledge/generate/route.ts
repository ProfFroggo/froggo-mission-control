// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// POST /api/knowledge/generate — AI-assisted article stub generation
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const topic: string = (body.topic ?? body.title ?? '').trim();
    if (!topic) {
      return NextResponse.json({ success: false, error: 'topic is required' }, { status: 400 });
    }

    // Structured stub — gives the user a solid scaffold to fill in
    const content = `# ${topic}

## Overview
Provide a brief summary of what this article covers and why it matters.

## Key Points
- First important point about ${topic}
- Second important point
- Third important point

## Details
Add detailed information, steps, or context here. Use **bold** for emphasis and \`code\` for technical terms.

## Examples
Provide concrete examples or use cases that illustrate the concepts.

## Related Resources
- Link to related documentation or articles
- Reference materials
`;

    return NextResponse.json({ success: true, content });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
