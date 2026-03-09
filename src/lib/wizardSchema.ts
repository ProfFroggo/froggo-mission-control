// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * Zod validation schemas for the Setup Wizard plan output.
 *
 * The wizard AI conversation produces a structured JSON plan describing
 * the book's title, type, genre, premise, themes, story arc, chapters,
 * characters, and timeline. These schemas validate that output before
 * project creation.
 */

import { z } from 'zod';

export const wizardChapterSchema = z.object({
  title: z.string().min(1),
  synopsis: z.string(),
});

export const wizardCharacterSchema = z.object({
  name: z.string().min(1),
  role: z.string().default('supporting'),
  description: z.string().default(''),
  traits: z.array(z.string()).default([]),
});

export const wizardTimelineSchema = z.object({
  date: z.string(),
  description: z.string(),
});

export const wizardPlanSchema = z.object({
  title: z.string().min(1),
  type: z.string().min(1),
  genre: z.string().default(''),
  premise: z.string().default(''),
  themes: z.array(z.string()).default([]),
  storyArc: z.string().default(''),
  chapters: z.array(wizardChapterSchema).min(1),
  characters: z.array(wizardCharacterSchema).default([]),
  timeline: z.array(wizardTimelineSchema).default([]),
});

export type WizardPlan = z.infer<typeof wizardPlanSchema>;
