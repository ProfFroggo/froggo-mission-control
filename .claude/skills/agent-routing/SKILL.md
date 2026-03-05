---
name: agent-routing
description: Which agent handles which type of work
---

# Agent Routing Guide

| Work Type | Primary Agent | Escalate To |
|-----------|--------------|-------------|
| Code implementation | coder | senior-coder |
| Complex code / architecture | senior-coder | chief |
| Code review | clara | senior-coder |
| Research / investigation | researcher | chief |
| Documentation | writer | — |
| Architecture decisions | chief | mission-control |
| Social media content | social-manager | mission-control |
| Growth strategy | growth-director | chief |
| UI/UX design | designer | — |
| Voice commands | voice | mission-control |
| HR / agent onboarding | hr | mission-control |
| Finance / budget analysis | finance-manager | mission-control |
| Discord community | discord-manager | mission-control |
| Inbox / email triage | inbox | mission-control |
| Multi-agent coordination | mission-control | — |

## Escalation Rules
- Always escalate P0 to mission-control
- Legal/compliance → always human review
- > $10k decisions → always human approval
- External API credentials → always human approval
