---
name: security-checklist
description: Security review checklist for all code changes
---

# Security Checklist

## Input Validation
- [ ] All user inputs validated (type, length, format)
- [ ] File paths sanitized (no path traversal)
- [ ] SQL uses parameterized queries

## Authentication & Authorization
- [ ] API routes check auth where needed
- [ ] No security-through-obscurity

## Data Handling
- [ ] PII not logged
- [ ] Sensitive data not stored unencrypted
- [ ] API responses don't include internal data

## Dependencies
- [ ] No new dependencies with known CVEs
- [ ] Lock files committed

## Approval Required
Any of these MUST go through approval_create:
- Outbound HTTP requests
- File system writes outside project directory
- Process spawning with user-controlled input
- Database schema changes

## Mission Control Specific
External agent actions MUST use `approval_create` MCP tool before executing:
- [ ] Posting tweets or social media content
- [ ] Sending emails or messages on behalf of the platform
- [ ] Triggering deployments or infrastructure changes
- [ ] Any action that affects external services or users
- Tier 3 actions (promotions, controversial replies, financial ops) require explicit human approval in the UI before proceeding
