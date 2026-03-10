#!/usr/bin/env node
// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// memory-capture.js — Stop hook: runs after every Claude session ends.
// Reads session output from stdin, extracts key learnings, writes to vault.

const fs = require('fs');
const path = require('path');
const os = require('os');

const HOME = os.homedir();
const MEMORY_DIR = path.join(HOME, 'mission-control', 'memory', 'agents');

// Read stdin (Claude passes session data as JSON lines)
let input = '';
process.stdin.on('data', d => input += d);
process.stdin.on('end', () => {
  try {
    // Parse session transcript from environment or stdin
    const agentId = process.env.CLAUDE_AGENT_ID || process.env.AGENT_ID || 'unknown';
    const taskId = process.env.TASK_ID || null;

    // Extract last assistant message as summary signal
    let lines = input.split('\n').filter(Boolean);
    let lastAssistantContent = '';
    for (const line of lines.reverse()) {
      try {
        const msg = JSON.parse(line);
        if (msg.type === 'assistant' && msg.message?.content) {
          const textBlock = Array.isArray(msg.message.content)
            ? msg.message.content.find(b => b.type === 'text')
            : null;
          if (textBlock) { lastAssistantContent = textBlock.text.slice(0, 1000); break; }
        }
      } catch { /* skip non-JSON lines */ }
    }

    if (!lastAssistantContent) process.exit(0); // Nothing to capture

    // Write a brief auto-capture note
    const date = new Date().toISOString().slice(0, 10);
    const slug = taskId ? `task-${taskId}` : `session-${Date.now()}`;
    const agentDir = path.join(MEMORY_DIR, agentId);

    if (!fs.existsSync(agentDir)) fs.mkdirSync(agentDir, { recursive: true });

    const notePath = path.join(agentDir, `${date}-${slug}-autocapture.md`);
    const noteContent = `---
date: ${date}
agent: ${agentId}
task: ${taskId || 'session'}
tags: [auto-capture]
confidence: low
---

# Auto-captured session note

## Last agent output (truncated)
${lastAssistantContent}

---
_Auto-captured by memory-capture.js Stop hook. Agent should write a richer note manually._
`;

    fs.writeFileSync(notePath, noteContent, 'utf-8');
  } catch (e) {
    // Non-critical — never crash the hook
    process.exit(0);
  }
});
