---
name: x-twitter-strategy
description: X/Twitter content strategy, tone, and approval workflow for Mission Control
---

# X/Twitter Strategy

## Voice & Tone
- Human, not corporate — write like a founder, not a marketing team
- Concise: aim for < 200 chars; threads for longer thoughts
- No hashtag spam — max 2 relevant hashtags per tweet
- Engage with replies; never ignore community questions

## Content Tiers
| Tier | Type | Approval |
|------|------|----------|
| 1 | Factual updates, milestones | Tier 2 (review queue) |
| 2 | Opinions, takes, commentary | Tier 2 |
| 3 | Promotions, campaigns, sales | Tier 3 (explicit human) |
| 4 | Replies to controversy | Tier 3 |

## Workflow
1. Draft in `library/campaigns/campaign-{name}-{date}/docs/`
2. Create approval via `approval_create` MCP tool
3. Wait for human approval before scheduling
4. Post via scheduled_items table (`platform: 'twitter'`)

## Prohibited
- No claims about competitors
- No financial advice or price predictions
- No personal information about users
- Never post during active incidents
