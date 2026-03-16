// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TYPE_LABELS: Record<string, string> = {
  paid: 'Paid', organic: 'Organic', social: 'Social', email: 'Email / CLM',
  clm: 'CLM', content: 'Content', pr: 'PR', influencer: 'Influencer',
  seo: 'SEO', general: 'General',
};

const GOAL_LABELS: Record<string, string> = {
  awareness: 'Brand Awareness', lead_gen: 'Lead Generation', conversion: 'Conversion',
  retention: 'Retention', revenue: 'Revenue Growth', engagement: 'Engagement', launch: 'Product Launch',
};

const CHANNEL_LABELS: Record<string, string> = {
  instagram: 'Instagram', x: 'X / Twitter', tiktok: 'TikTok', linkedin: 'LinkedIn',
  youtube: 'YouTube', email: 'Email', seo: 'SEO', google_ads: 'Google Ads',
  meta_ads: 'Meta Ads', whatsapp: 'WhatsApp', web: 'Website',
};

// POST /api/campaigns/brief-draft
// Body: { name, types, goal, channels, targetAudience }
// Returns: { brief: string }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { name = 'this campaign', types = [], goal = '', channels = [], targetAudience = '' } = body;

    const typeNames = (types as string[]).map((t: string) => TYPE_LABELS[t] ?? t).join(' and ');
    const goalName = GOAL_LABELS[goal] ?? goal;
    const channelNames = (channels as string[]).map((c: string) => CHANNEL_LABELS[c] ?? c);
    const channelList = channelNames.length > 0
      ? channelNames.length === 1
        ? channelNames[0]
        : `${channelNames.slice(0, -1).join(', ')} and ${channelNames[channelNames.length - 1]}`
      : 'selected channels';

    const audienceClause = targetAudience
      ? ` targeting ${targetAudience}`
      : '';

    const brief = [
      `## Campaign Brief: ${name}`,
      '',
      `**${name}** is a ${typeNames || 'multi-channel'} campaign designed to drive ${goalName.toLowerCase()}${audienceClause}. The campaign will run across ${channelList}, using a coordinated mix of creative assets and messaging tailored to each platform's audience.`,
      '',
      `### Objectives\nThe primary goal is ${goalName.toLowerCase()}. Success will be measured by tracking key performance indicators including reach, engagement rate, conversion metrics, and return on investment across all active channels. Clear milestones will be set at campaign launch and reviewed at regular intervals throughout the flight.`,
      '',
      `### Strategy\nContent and creative will be adapted per channel to maximize relevance and performance. ${typeNames ? `As a ${typeNames} campaign, ` : ''}the approach will prioritize authentic storytelling and clear calls to action. A/B testing will be used to refine messaging and creative in real time, with learnings shared across the team to continuously improve performance.`,
    ].join('\n');

    return NextResponse.json({ brief });
  } catch (error) {
    console.error('POST /api/campaigns/brief-draft error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
