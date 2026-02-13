/**
 * Agent-specialized prompts for the Setup Wizard.
 *
 * Provides conversation prompts (used during braindump + conversation steps),
 * extraction prompts (used to produce structured JSON from conversation),
 * and a JSON parser that validates against the wizard plan schema.
 */

import { wizardPlanSchema, type WizardPlan } from './wizardSchema';

// ── Agent specialization ──

export const WIZARD_AGENTS: Record<string, { id: string; name: string; preamble: string }> = {
  memoir: {
    id: 'jess',
    name: 'Jess',
    preamble: [
      'You are Jess, helping plan a memoir. Focus on:',
      '- Emotional arc: what transformation does the reader witness?',
      '- Boundary awareness: what to reveal vs. protect',
      '- Timeline structure: chronological vs. thematic ordering',
      '- Key characters: relationships and their evolution',
      '- Sensitive disclosure pacing: when to reveal difficult truths',
    ].join('\n'),
  },
  novel: {
    id: 'writer',
    name: 'Writer',
    preamble: [
      'You are a skilled writing assistant helping plan a novel. Focus on:',
      '- Plot structure: inciting incident, rising action, climax, resolution',
      '- Character development: protagonist arc, antagonist motivation',
      '- World-building: setting, rules, atmosphere',
      '- Chapter pacing: scene breaks, tension management',
      '- Theme integration: how themes emerge through plot and character',
    ].join('\n'),
  },
};

export function getWizardAgent(bookType: string) {
  if (bookType === 'memoir') return WIZARD_AGENTS.memoir;
  return WIZARD_AGENTS.novel;
}

// ── Conversation prompt ──

export function buildConversationPrompt(
  agent: string,
  brainDump: string,
  conversationSummary?: string,
): string {
  const agentConfig = getWizardAgent(agent);
  const parts: string[] = [
    agentConfig.preamble,
    '',
    '## Your Role',
    'Help the user plan their book through conversation. Ask clarifying questions.',
    'Propose structure, characters, themes. Be collaborative, not prescriptive.',
    'Keep track of what has been decided so far.',
  ];

  if (conversationSummary) {
    parts.push('', '## Decisions So Far', conversationSummary);
  }

  parts.push('', "## User's Book Idea", brainDump);

  return parts.join('\n');
}

// ── Extraction prompt ──

export function buildExtractionPrompt(conversationSummary: string): string {
  return [
    'Based on our conversation, produce a structured book plan.',
    'Return ONLY a JSON code block with the following structure.',
    'Do not include any text outside the JSON block.',
    '',
    '```json',
    '{',
    '  "title": "Book Title",',
    '  "type": "memoir|novel|fantasy|scifi|thriller|romance|literary|nonfiction",',
    '  "genre": "Specific genre description",',
    '  "premise": "One paragraph premise",',
    '  "themes": ["theme1", "theme2"],',
    '  "storyArc": "Multi-paragraph story arc summary",',
    '  "chapters": [',
    '    {"title": "Chapter Title", "synopsis": "Brief chapter synopsis"}',
    '  ],',
    '  "characters": [',
    '    {"name": "Name", "role": "protagonist|antagonist|supporting|narrator",',
    '     "description": "Description", "traits": ["trait1", "trait2"]}',
    '  ],',
    '  "timeline": [',
    '    {"date": "Time marker", "description": "What happens"}',
    '  ]',
    '}',
    '```',
    '',
    '## Conversation Summary',
    conversationSummary,
  ].join('\n');
}

// ── JSON extraction + validation ──

export function parseWizardPlan(response: string): WizardPlan | null {
  const jsonMatch = response.match(/```json\s*([\s\S]*?)```/);
  if (!jsonMatch) return null;
  try {
    const parsed = JSON.parse(jsonMatch[1].trim());
    return wizardPlanSchema.parse(parsed);
  } catch {
    return null;
  }
}
