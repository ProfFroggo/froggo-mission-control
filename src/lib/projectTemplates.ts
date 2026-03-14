// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// src/lib/projectTemplates.ts
// Static project templates for the creation wizard.

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  goal: string;
  iconId: string;
  color: string;
  suggestedAgents: string[];   // role labels, not IDs
  suggestedTasks: string[];
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'product-launch',
    name: 'Product Launch',
    description: 'Ship a new product or major feature from zero to live.',
    goal: 'Successfully launch the product to users with clear success metrics, polished UX, and a go-to-market plan.',
    iconId: 'rocket',
    color: '#6366f1',
    suggestedAgents: ['designer', 'developer', 'coder'],
    suggestedTasks: [
      'Define product requirements and acceptance criteria',
      'Design UI mockups and user flows',
      'Implement core feature set',
      'Write tests and QA pass',
      'Prepare launch announcement and marketing copy',
      'Deploy to production and monitor',
    ],
  },
  {
    id: 'content-series',
    name: 'Content Series',
    description: 'Produce a recurring series of content — posts, videos, or articles.',
    goal: 'Publish a consistent content series that grows audience engagement and establishes domain authority.',
    iconId: 'file-text',
    color: '#22c55e',
    suggestedAgents: ['writer', 'designer', 'social'],
    suggestedTasks: [
      'Define content pillars and target audience',
      'Create content calendar for the series',
      'Draft first 3 pieces of content',
      'Design visual assets for each piece',
      'Schedule and publish across channels',
      'Track engagement metrics and iterate',
    ],
  },
  {
    id: 'growth-experiment',
    name: 'Growth Experiment',
    description: 'Run a hypothesis-driven experiment to improve a key growth metric.',
    goal: 'Validate or invalidate a growth hypothesis with a time-boxed experiment and clear measurement of impact.',
    iconId: 'trending-up',
    color: '#f97316',
    suggestedAgents: ['analyst', 'developer', 'designer'],
    suggestedTasks: [
      'Write experiment hypothesis and success metrics',
      'Define control vs. variant and audience segment',
      'Build experiment variant (feature or copy)',
      'Instrument tracking and analytics events',
      'Run experiment for defined period',
      'Analyse results and write findings report',
    ],
  },
];
