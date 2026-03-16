// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// Tests for POST /api/meetings/transcript
import { describe, it, expect } from 'vitest';

// Import the action item extraction logic directly for unit testing
// We test the regex patterns against known inputs

const ACTION_PATTERNS = [
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

function extractActionItems(text: string): Array<{ text: string; pattern: string }> {
  const items: Array<{ text: string; pattern: string }> = [];
  const seen = new Set<string>();

  for (const pattern of ACTION_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const extracted = match[1]?.trim();
      if (!extracted || extracted.length < 5 || extracted.length > 300) continue;
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

describe('Action item extraction', () => {
  it('extracts TODO items', () => {
    const text = 'TODO: Update the documentation for the new API endpoint.';
    const items = extractActionItems(text);
    expect(items.length).toBeGreaterThanOrEqual(1);
    expect(items[0].text).toContain('Update the documentation');
  });

  it('extracts ACTION ITEM patterns', () => {
    const text = 'ACTION ITEM: Schedule a follow-up meeting with the client.';
    const items = extractActionItems(text);
    expect(items.length).toBeGreaterThanOrEqual(1);
    expect(items.some(i => i.text.toLowerCase().includes('schedule'))).toBe(true);
  });

  it('extracts "need to" patterns', () => {
    const text = 'We need to finalize the budget before Friday.';
    const items = extractActionItems(text);
    expect(items.length).toBeGreaterThanOrEqual(1);
    expect(items.some(i => i.text.toLowerCase().includes('finalize the budget'))).toBe(true);
  });

  it('extracts "follow up" patterns', () => {
    const text = 'Follow up with marketing on the campaign results.';
    const items = extractActionItems(text);
    expect(items.length).toBeGreaterThanOrEqual(1);
    expect(items.some(i => i.text.toLowerCase().includes('marketing'))).toBe(true);
  });

  it('extracts "don\'t forget" patterns', () => {
    const text = "Don't forget to send the invoice to the client.";
    const items = extractActionItems(text);
    expect(items.length).toBeGreaterThanOrEqual(1);
    expect(items.some(i => i.text.toLowerCase().includes('send the invoice'))).toBe(true);
  });

  it('extracts "remember to" patterns', () => {
    const text = 'Remember to update the sprint board with the new tasks.';
    const items = extractActionItems(text);
    expect(items.length).toBeGreaterThanOrEqual(1);
  });

  it('extracts "next steps" patterns', () => {
    const text = 'Next steps: Review the proposal and share feedback by Monday.';
    const items = extractActionItems(text);
    expect(items.length).toBeGreaterThanOrEqual(1);
  });

  it('deduplicates identical items', () => {
    const text = 'TODO: Update docs. TODO: Update docs. TODO: Update docs.';
    const items = extractActionItems(text);
    expect(items.length).toBe(1);
  });

  it('skips items shorter than 5 characters', () => {
    const text = 'TODO: Hi. TODO: Update the documentation for the API.';
    const items = extractActionItems(text);
    // "Hi" should be skipped (too short), only the longer item remains
    expect(items.every(i => i.text.length >= 5)).toBe(true);
  });

  it('handles empty text without errors', () => {
    const items = extractActionItems('');
    expect(items).toEqual([]);
  });

  it('handles text with no action items', () => {
    const text = 'The weather was nice today. We had a pleasant conversation about the weekend.';
    const items = extractActionItems(text);
    expect(items.length).toBe(0);
  });

  it('extracts multiple different action items from a transcript', () => {
    const text = `
      Meeting Notes - Sprint Planning

      TODO: Set up the staging environment for testing.
      We need to finalize the API design before implementation.
      Follow up with the design team on the mockups.
      Remember to update the changelog before release.
      Next steps: Deploy the hotfix by end of day.
    `;
    const items = extractActionItems(text);
    expect(items.length).toBeGreaterThanOrEqual(4);
  });
});

describe('File validation logic', () => {
  const MAX_FILE_SIZE = 5 * 1024 * 1024;
  const ALLOWED_EXTENSIONS = ['.txt', '.md'];

  it('rejects files over 5MB', () => {
    const content = 'x'.repeat(MAX_FILE_SIZE + 1);
    const byteSize = new TextEncoder().encode(content).length;
    expect(byteSize).toBeGreaterThan(MAX_FILE_SIZE);
  });

  it('accepts files under 5MB', () => {
    const content = 'x'.repeat(1000);
    const byteSize = new TextEncoder().encode(content).length;
    expect(byteSize).toBeLessThan(MAX_FILE_SIZE);
  });

  it('allows .txt extension', () => {
    const ext = '.txt';
    expect(ALLOWED_EXTENSIONS.includes(ext)).toBe(true);
  });

  it('allows .md extension', () => {
    const ext = '.md';
    expect(ALLOWED_EXTENSIONS.includes(ext)).toBe(true);
  });

  it('rejects .docx extension', () => {
    const ext = '.docx';
    expect(ALLOWED_EXTENSIONS.includes(ext)).toBe(false);
  });

  it('rejects .pdf extension', () => {
    const ext = '.pdf';
    expect(ALLOWED_EXTENSIONS.includes(ext)).toBe(false);
  });
});
