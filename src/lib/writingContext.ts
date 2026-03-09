// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * Shared context builders for writing AI prompts.
 *
 * Extracted from FeedbackPopover.tsx to be reused by both
 * FeedbackPopover and ChatPane. All functions are pure —
 * they take data and return strings, no React hooks or store access.
 */

export function buildMemoryContext(
  characters: { name: string; relationship: string; description: string }[],
  timeline: { date: string; description: string }[],
  facts: { claim: string; source: string; status: string }[],
): string {
  const sections: string[] = [];

  if (characters.length > 0) {
    sections.push(
      '### Characters',
      ...characters.map((c) => `- **${c.name}** (${c.relationship}): ${c.description}`),
    );
  }

  if (timeline.length > 0) {
    sections.push(
      '### Timeline',
      ...timeline.map((t) => `- **${t.date}**: ${t.description}`),
    );
  }

  if (facts.length > 0) {
    const statusIcon: Record<string, string> = { verified: 'V', disputed: 'D', unverified: '?' };
    sections.push(
      '### Verified Facts',
      ...facts.map((f) => `- [${statusIcon[f.status] ?? '?'}] ${f.claim} (source: ${f.source})`),
    );
  }

  const result = sections.join('\n');
  // Cap to ~2000 chars to avoid bloating prompt
  return result.length > 2000 ? result.slice(0, 2000) + '\n...(truncated)' : result;
}

export function buildChapterContext(chapterContent: string | null, cursorOffset?: number): string {
  if (!chapterContent) return '(no chapter content)';
  const charOffset = cursorOffset ? Math.min(cursorOffset * 5, chapterContent.length) : 0;
  const windowSize = 8000;
  const start = Math.max(0, charOffset - windowSize);
  const end = Math.min(chapterContent.length, charOffset + windowSize);
  let ctx = chapterContent.slice(start, end);
  if (start > 0) ctx = '...' + ctx;
  if (end < chapterContent.length) ctx += '...';
  return ctx;
}

export function buildOutlineContext(chapters: { title: string; position: number }[]): string {
  if (!chapters || chapters.length === 0) return '(no outline available)';
  return chapters
    .sort((a, b) => a.position - b.position)
    .map((ch, i) => `${i + 1}. ${ch.title}`)
    .join('\n');
}
