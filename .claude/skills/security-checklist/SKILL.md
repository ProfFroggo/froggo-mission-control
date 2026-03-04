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
