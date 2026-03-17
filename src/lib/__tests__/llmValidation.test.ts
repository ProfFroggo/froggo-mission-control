// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// Tests for runtime validation of Gemini LLM JSON responses in three parse sites
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';

// ── Schemas ─────────────────────────────────────────────────────────────────
// Mirror the schemas from the production files for isolated unit testing.
// These must stay in sync with the actual schema definitions.

const MeetingSummarySchema = z.object({
  summary: z.string(),
  actionItems: z.array(z.string()),
  decisions: z.array(z.string()),
  keyTopics: z.array(z.string()),
});

const MeetingSummarizationSchema = z.object({
  summary: z.string(),
  actionItems: z.array(z.string()),
  keyDecisions: z.array(z.string()),
  participants: z.array(z.string()),
});

const TaskProposalItemSchema = z.object({
  title: z.string(),
  description: z.string(),
  planningNotes: z.string(),
  priority: z.string(),
  assignedTo: z.string(),
  subtasks: z.array(z.string()),
});
const TaskProposalArraySchema = z.array(TaskProposalItemSchema);

// ── Helpers that replicate the production fallback logic ─────────────────────

function parseMeetingSummary(raw: string): z.infer<typeof MeetingSummarySchema> | null {
  try {
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed: unknown = JSON.parse(cleaned);
    const result = MeetingSummarySchema.safeParse(parsed);
    if (!result.success) return null;
    return result.data;
  } catch {
    return null;
  }
}

function parseMeetingSummarization(
  raw: string,
  fallbackText: string,
): z.infer<typeof MeetingSummarizationSchema> {
  const fallback = {
    summary: fallbackText || 'Failed to generate summary',
    actionItems: [] as string[],
    keyDecisions: [] as string[],
    participants: [] as string[],
  };
  try {
    const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim();
    const parsed: unknown = JSON.parse(cleaned);
    const result = MeetingSummarizationSchema.safeParse(parsed);
    if (!result.success) return fallback;
    return result.data;
  } catch {
    return fallback;
  }
}

function parseTaskProposals(
  raw: string,
): Array<z.infer<typeof TaskProposalItemSchema>> {
  try {
    const jsonStr = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    const parsed: unknown = JSON.parse(jsonStr);
    const result = TaskProposalArraySchema.safeParse(parsed);
    if (!result.success) return [];
    return result.data;
  } catch {
    return [];
  }
}

// ── Tests: summariseMeeting() (meetingTranscribe.ts) ─────────────────────────

describe('parseMeetingSummary — MeetingTranscriber.summariseMeeting() guard', () => {
  const VALID_RESPONSE = JSON.stringify({
    summary: 'We discussed Q2 roadmap priorities.',
    actionItems: ['Set up staging', 'Write API docs'],
    decisions: ['Use Gemini 2.0 Flash'],
    keyTopics: ['Infrastructure', 'API design'],
  });

  it('accepts a fully valid Gemini response', () => {
    const result = parseMeetingSummary(VALID_RESPONSE);
    expect(result).not.toBeNull();
    expect(result?.summary).toBe('We discussed Q2 roadmap priorities.');
    expect(result?.actionItems).toHaveLength(2);
    expect(result?.decisions).toHaveLength(1);
    expect(result?.keyTopics).toHaveLength(2);
  });

  it('strips markdown code fences before parsing', () => {
    const wrapped = '```json\n' + VALID_RESPONSE + '\n```';
    const result = parseMeetingSummary(wrapped);
    expect(result).not.toBeNull();
    expect(result?.summary).toBe('We discussed Q2 roadmap priorities.');
  });

  it('returns null when required field "summary" is missing', () => {
    const malformed = JSON.stringify({
      actionItems: ['Task 1'],
      decisions: [],
      keyTopics: ['Topic A'],
    });
    expect(parseMeetingSummary(malformed)).toBeNull();
  });

  it('returns null when "actionItems" is a string instead of an array', () => {
    const malformed = JSON.stringify({
      summary: 'Good meeting',
      actionItems: 'do the thing',   // wrong type
      decisions: [],
      keyTopics: [],
    });
    expect(parseMeetingSummary(malformed)).toBeNull();
  });

  it('returns null when "decisions" field is absent', () => {
    const malformed = JSON.stringify({
      summary: 'Quick sync',
      actionItems: [],
      keyTopics: ['budgets'],
    });
    expect(parseMeetingSummary(malformed)).toBeNull();
  });

  it('returns null when "keyTopics" is null', () => {
    const malformed = JSON.stringify({
      summary: 'Weekly standup',
      actionItems: [],
      decisions: [],
      keyTopics: null,
    });
    expect(parseMeetingSummary(malformed)).toBeNull();
  });

  it('returns null for completely empty JSON object', () => {
    expect(parseMeetingSummary('{}')).toBeNull();
  });

  it('returns null for non-JSON garbage', () => {
    expect(parseMeetingSummary('I am not JSON')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(parseMeetingSummary('')).toBeNull();
  });
});

// ── Tests: summarizeMeeting() (multiAgentVoice.ts) ──────────────────────────

describe('parseMeetingSummarization — GeminiTranscriptionService.summarizeMeeting() guard', () => {
  const VALID_RESPONSE = JSON.stringify({
    summary: 'Sprint planning went well.',
    actionItems: ['Deploy hotfix', 'Review PR #42'],
    keyDecisions: ['Skip sprint ceremony next week'],
    participants: ['Alice', 'Bob'],
  });

  it('accepts a fully valid Gemini response', () => {
    const result = parseMeetingSummarization(VALID_RESPONSE, '');
    expect(result.summary).toBe('Sprint planning went well.');
    expect(result.actionItems).toHaveLength(2);
    expect(result.keyDecisions).toHaveLength(1);
    expect(result.participants).toHaveLength(2);
  });

  it('strips markdown code fences before parsing', () => {
    const wrapped = '```json\n' + VALID_RESPONSE + '\n```';
    const result = parseMeetingSummarization(wrapped, '');
    expect(result.summary).toBe('Sprint planning went well.');
  });

  it('returns fallback when "keyDecisions" is missing', () => {
    const malformed = JSON.stringify({
      summary: 'Good chat',
      actionItems: [],
      participants: ['Alice'],
    });
    const result = parseMeetingSummarization(malformed, 'raw text fallback');
    expect(result.summary).toBe('raw text fallback');
    expect(result.actionItems).toEqual([]);
    expect(result.keyDecisions).toEqual([]);
    expect(result.participants).toEqual([]);
  });

  it('returns fallback when "participants" is a number instead of array', () => {
    const malformed = JSON.stringify({
      summary: 'Discussion',
      actionItems: [],
      keyDecisions: [],
      participants: 5,   // wrong type
    });
    const result = parseMeetingSummarization(malformed, 'raw text fallback');
    expect(result.participants).toEqual([]);
  });

  it('returns fallback for an empty object', () => {
    const result = parseMeetingSummarization('{}', 'fallback text');
    expect(result.summary).toBe('fallback text');
  });

  it('returns fallback for invalid JSON', () => {
    const result = parseMeetingSummarization('not json at all', 'fallback text');
    expect(result.summary).toBe('fallback text');
    expect(result.actionItems).toEqual([]);
  });
});

// ── Tests: extractTaskProposals() (transcript/route.ts) ─────────────────────

describe('parseTaskProposals — extractTaskProposals() guard', () => {
  const VALID_ITEM = {
    title: 'Set up CI pipeline',
    description: 'Configure GitHub Actions for automated tests',
    planningNotes: 'Use existing workflow template',
    priority: 'p1',
    assignedTo: 'coder',
    subtasks: ['Create workflow file', 'Add test runner'],
  };

  it('accepts a valid array of task proposals', () => {
    const raw = JSON.stringify([VALID_ITEM]);
    const result = parseTaskProposals(raw);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Set up CI pipeline');
    expect(result[0].subtasks).toHaveLength(2);
  });

  it('accepts an empty array', () => {
    const result = parseTaskProposals('[]');
    expect(result).toEqual([]);
  });

  it('accepts multiple valid items', () => {
    const raw = JSON.stringify([VALID_ITEM, { ...VALID_ITEM, title: 'Write docs' }]);
    const result = parseTaskProposals(raw);
    expect(result).toHaveLength(2);
  });

  it('strips markdown code fences before parsing', () => {
    const wrapped = '```json\n' + JSON.stringify([VALID_ITEM]) + '\n```';
    const result = parseTaskProposals(wrapped);
    expect(result).toHaveLength(1);
  });

  it('returns [] when a required field "title" is missing from an item', () => {
    const malformed = JSON.stringify([
      { description: 'No title', planningNotes: '', priority: 'p2', assignedTo: 'coder', subtasks: [] },
    ]);
    expect(parseTaskProposals(malformed)).toEqual([]);
  });

  it('returns [] when "subtasks" is a string instead of array', () => {
    const malformed = JSON.stringify([
      { ...VALID_ITEM, subtasks: 'do stuff' },   // wrong type
    ]);
    expect(parseTaskProposals(malformed)).toEqual([]);
  });

  it('returns [] when response is a plain object, not an array', () => {
    const malformed = JSON.stringify(VALID_ITEM);   // object, not array
    expect(parseTaskProposals(malformed)).toEqual([]);
  });

  it('returns [] for completely empty JSON object', () => {
    expect(parseTaskProposals('{}')).toEqual([]);
  });

  it('returns [] for invalid JSON', () => {
    expect(parseTaskProposals('not json')).toEqual([]);
  });

  it('returns [] for empty string', () => {
    expect(parseTaskProposals('')).toEqual([]);
  });

  it('returns [] when "assignedTo" is missing', () => {
    const malformed = JSON.stringify([
      { title: 'Task', description: 'desc', planningNotes: '', priority: 'p2', subtasks: [] },
    ]);
    expect(parseTaskProposals(malformed)).toEqual([]);
  });
});
