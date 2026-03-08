# Cost Strategy — Mission Control Platform

## Three-Tier Model Hierarchy

### Tier 1: Lead (Opus 4.6)
**Model**: `claude-opus-4-6`
**Use for**:
- Orchestration decisions (Mission Control, Chief, Growth Director)
- Architecture reviews and complex reasoning
- Anything where quality > speed/cost
- Tasks where a wrong decision costs more than the token savings

### Tier 2: Worker (Sonnet 4.6)
**Model**: `claude-sonnet-4-6`
**Use for**:
- Feature implementation (Coder, Researcher, Writer, Designer)
- Code review, PR summaries
- Most day-to-day agent work
- The default for new agents unless specified

### Tier 3: Trivial (Haiku 4.5)
**Model**: `claude-haiku-4-5-20251001`
**Use for**:
- Simple lookups and status checks
- Classifying/routing tasks
- Summarizing short documents
- Health checks, ping responses

## Assignment Rules

1. When in doubt, use Worker (Sonnet)
2. Only use Lead when the task involves a consequential decision or complex multi-step reasoning
3. Use Trivial for automation scripts, cron tasks, and anything under 500 tokens
4. The spawn route reads `agents.model` from DB; set it there to control per-agent tier

## Cost Monitoring

Track via analytics_events table:
- `event_type: 'llm_call'` with `metadata: { model, tokens, agent_id }`
- Monthly summary available in Analytics panel

## Environment Variables

```
MODEL_LEAD=claude-opus-4-6
MODEL_WORKER=claude-sonnet-4-6
MODEL_TRIVIAL=claude-haiku-4-5-20251001
```

Override per-agent via DB: `UPDATE agents SET model = 'haiku' WHERE id = 'inbox';`
