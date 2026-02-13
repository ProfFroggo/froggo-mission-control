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
  role: z.string(),
  description: z.string(),
  traits: z.array(z.string()),
});

export const wizardTimelineSchema = z.object({
  date: z.string(),
  description: z.string(),
});

export const wizardPlanSchema = z.object({
  title: z.string().min(1),
  type: z.string().min(1),
  genre: z.string(),
  premise: z.string(),
  themes: z.array(z.string()),
  storyArc: z.string(),
  chapters: z.array(wizardChapterSchema).min(1),
  characters: z.array(wizardCharacterSchema),
  timeline: z.array(wizardTimelineSchema),
});

export type WizardPlan = z.infer<typeof wizardPlanSchema>;
