// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

// Task templates per campaign type
// Each entry: { title, description, role hint (matched against agent names) }
const CAMPAIGN_TASK_TEMPLATES: Record<string, { title: string; description: string; roleHint: string }[]> = {
  content: [
    { title: 'Write copy', description: 'Write all copy and messaging for this campaign. Follow the brief and brand voice guidelines.', roleHint: 'writer' },
    { title: 'Design assets', description: 'Create visual assets including banners, social graphics, and any supporting imagery.', roleHint: 'design' },
    { title: 'Schedule posts', description: 'Plan and schedule all content across the relevant channels for the campaign duration.', roleHint: 'social' },
    { title: 'Review analytics', description: 'Monitor campaign performance metrics, compile insights, and produce a performance summary.', roleHint: 'analyst' },
  ],
  social: [
    { title: 'Research hashtags', description: 'Identify trending and relevant hashtags to maximise reach for this social campaign.', roleHint: 'research' },
    { title: 'Draft content', description: 'Draft all social posts, captions, and short-form content aligned to the campaign brief.', roleHint: 'writer' },
    { title: 'Get approval', description: 'Collect internal stakeholder approval for all drafted content before publishing.', roleHint: 'manager' },
    { title: 'Publish', description: 'Publish all approved content on schedule across all active social channels.', roleHint: 'social' },
  ],
  email: [
    { title: 'Write email copy', description: 'Write subject lines and body copy for all campaign emails following the brief.', roleHint: 'writer' },
    { title: 'Design email template', description: 'Design responsive HTML email templates for the campaign.', roleHint: 'design' },
    { title: 'Set up automation', description: 'Configure send sequences, triggers, and audience segments in the email platform.', roleHint: 'automation' },
    { title: 'Analyse results', description: 'Review open rates, click-through rates, and conversions. Report findings.', roleHint: 'analyst' },
  ],
  paid: [
    { title: 'Define targeting', description: 'Research and define audience targeting parameters for all paid channels.', roleHint: 'analyst' },
    { title: 'Write ad copy', description: 'Write compelling ad copy variants for A/B testing across all ad formats.', roleHint: 'writer' },
    { title: 'Create ad creatives', description: 'Design ad imagery and video thumbnails for all required ad formats and placements.', roleHint: 'design' },
    { title: 'Monitor and optimise', description: 'Monitor ad performance daily and optimise bids, creatives, and targeting to hit KPIs.', roleHint: 'analyst' },
  ],
  seo: [
    { title: 'Keyword research', description: 'Identify target keywords and search intent clusters for this campaign.', roleHint: 'research' },
    { title: 'Write SEO content', description: 'Produce optimised content targeting the identified keywords.', roleHint: 'writer' },
    { title: 'Technical audit', description: 'Audit technical SEO factors: page speed, structured data, canonicals.', roleHint: 'technical' },
    { title: 'Build backlinks', description: 'Identify link-building opportunities and conduct outreach.', roleHint: 'outreach' },
  ],
  influencer: [
    { title: 'Identify influencers', description: 'Research and shortlist influencers aligned to the campaign audience and brief.', roleHint: 'research' },
    { title: 'Outreach and negotiation', description: 'Contact shortlisted influencers, share the brief, and agree deliverables.', roleHint: 'outreach' },
    { title: 'Brief creation', description: 'Produce a detailed influencer brief covering key messages, dos, and don\'ts.', roleHint: 'writer' },
    { title: 'Track performance', description: 'Track influencer post performance and compile a results report.', roleHint: 'analyst' },
  ],
};

// Fallback template for unrecognised campaign types
const DEFAULT_TEMPLATES = [
  { title: 'Plan campaign', description: 'Define detailed campaign plan, milestones, and success metrics.', roleHint: 'manager' },
  { title: 'Create content', description: 'Produce all required content assets for the campaign.', roleHint: 'writer' },
  { title: 'Execute campaign', description: 'Execute the campaign plan across all identified channels.', roleHint: 'social' },
  { title: 'Report results', description: 'Compile final results report covering performance vs goals.', roleHint: 'analyst' },
];

function pickAgent(agents: { id: string; name: string; role?: string }[], roleHint: string): string | null {
  if (!agents.length) return null;
  const hint = roleHint.toLowerCase();
  // Try matching by role field first, then by name
  const byRole = agents.find(a => (a.role ?? '').toLowerCase().includes(hint));
  if (byRole) return byRole.id;
  const byName = agents.find(a => a.name.toLowerCase().includes(hint));
  if (byName) return byName.id;
  // Round-robin fallback — pick agent whose index matches the hint char sum mod length
  const idx = hint.charCodeAt(0) % agents.length;
  return agents[idx].id;
}

// POST /api/campaigns/:id/generate-tasks
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const db = getDb();

    const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!campaign) return NextResponse.json({ success: false, error: 'Campaign not found' }, { status: 404 });

    // Load campaign agents
    const memberRows = db.prepare(`
      SELECT cm.agentId, a.name, a.role
      FROM campaign_members cm
      LEFT JOIN agents a ON a.id = cm.agentId
      WHERE cm.campaignId = ?
    `).all(id) as { agentId: string; name: string; role: string | null }[];

    const agents = memberRows.map(r => ({ id: r.agentId, name: r.name ?? r.agentId, role: r.role ?? '' }));

    const campaignType = (campaign.type as string) ?? 'general';
    const templates = CAMPAIGN_TASK_TEMPLATES[campaignType] ?? DEFAULT_TEMPLATES;

    const now = Date.now();
    const created: string[] = [];

    for (const tpl of templates) {
      const taskId = `task-${now}-${Math.random().toString(36).slice(2, 7)}`;
      const assignedTo = pickAgent(agents, tpl.roleHint);

      db.prepare(`
        INSERT INTO tasks (id, title, description, status, priority, assignedTo, project, createdAt, updatedAt)
        VALUES (?, ?, ?, 'todo', 'medium', ?, ?, ?, ?)
      `).run(taskId, tpl.title, tpl.description, assignedTo, id, now, now);

      created.push(taskId);
    }

    return NextResponse.json({ success: true, tasksCreated: created.length, taskIds: created });
  } catch (error) {
    console.error('POST /api/campaigns/:id/generate-tasks error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
