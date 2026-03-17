// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// Shared transcript processing utilities — imported by both the API route and tests.

// ── Action item extraction patterns ──────────────────────────────────────────
export const ACTION_PATTERNS = [
  /\bTODO[:\s]+(.+?)(?:\.|$)/gim,
  /\bACTION(?:\s+ITEM)?[:\s]+(.+?)(?:\.|$)/gim,
  /\bfollow\s+up\s+(?:on|with)\s+(.+?)(?:\.|$)/gim,
  /(?:^|\.\s+)(?:I|we)\s+(?:need to|have to|should|will|must)\s+(.+?)(?:\.|$)/gim,
  /(?:^|\.\s+)(?:you|they)\s+(?:need to|should|will|must)\s+(.+?)(?:\.|$)/gim,
  /\bdon'?t forget\s+(?:to\s+)?(.+?)(?:\.|$)/gim,
  /\bremember to\s+(.+?)(?:\.|$)/gim,
  /\bmake sure\s+(?:to\s+)?(.+?)(?:\.|$)/gim,
  /\blet'?s\s+(?:make sure|ensure|plan|schedule|set up)\s+(.+?)(?:\.|$)/gim,
  /\bassign(?:ed)?\s+(?:to\s+\w+\s+)?[:\s]+(.+?)(?:\.|$)/gim,
  /\bdeadline[:\s]+(.+?)(?:\.|$)/gim,
  /\bnext\s+step[s]?[:\s]+(.+?)(?:\.|$)/gim,
];

/** Extract action items from transcript text using keyword heuristics */
export function extractActionItems(text: string): Array<{ text: string; pattern: string }> {
  const items: Array<{ text: string; pattern: string }> = [];
  const seen = new Set<string>();

  for (const pattern of ACTION_PATTERNS) {
    // Reset regex lastIndex for each run
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const extracted = match[1]?.trim();
      if (!extracted || extracted.length < 5 || extracted.length > 300) continue;

      // Deduplicate by normalized text
      const normalized = extracted.toLowerCase().replace(/\s+/g, ' ');
      if (seen.has(normalized)) continue;
      seen.add(normalized);

      items.push({
        text: extracted.charAt(0).toUpperCase() + extracted.slice(1),
        pattern: pattern.source.slice(0, 30),
      });
    }
  }

  return items;
}

/** Generate extractive summary fallback (first 500 words + key sentences) */
export function extractiveSummary(text: string): string {
  const sentences = text
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 20);

  if (sentences.length === 0) return text.slice(0, 2000);

  // Take first ~500 words as context
  const words = text.split(/\s+/);
  const first500 = words.slice(0, 500).join(' ');

  // Find key sentences (containing important keywords)
  const keyWords = ['decided', 'agreed', 'conclusion', 'important', 'key', 'summary', 'result', 'outcome', 'plan', 'next step'];
  const keySentences = sentences.filter(s =>
    keyWords.some(kw => s.toLowerCase().includes(kw))
  ).slice(0, 5);

  const parts = [first500];
  if (keySentences.length > 0) {
    parts.push('\n\n**Key Points:**');
    parts.push(...keySentences.map(s => `- ${s}`));
  }

  return parts.join('\n');
}
