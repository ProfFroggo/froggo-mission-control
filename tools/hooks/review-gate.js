#!/usr/bin/env node
/**
 * Mission Control Clara Review Gate Hook (PostToolUse)
 *
 * Fires after mcp__mission-control_db__task_update
 * If task moved to 'review' status, triggers Clara to review it automatically.
 * Always outputs { "decision": "approve" } so the original tool call proceeds.
 */

const http = require('http');

async function triggerClaraReview(taskId) {
  return new Promise((resolve) => {
    const body = JSON.stringify({ taskId });
    const req = http.request({
      host: '127.0.0.1',
      port: 3000,
      path: '/api/agents/clara/review',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      res.resume();
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(3000, () => { req.destroy(); resolve(false); });
    req.write(body);
    req.end();
  });
}

async function main() {
  let input = '';
  process.stdin.setEncoding('utf8');

  for await (const chunk of process.stdin) {
    input += chunk;
  }

  try {
    const parsed = JSON.parse(input);
    const toolInput = parsed.tool_input || parsed.toolInput || {};
    const status = toolInput.status;
    const taskId = toolInput.id || toolInput.taskId;

    if (status === 'review' && taskId) {
      // Fire-and-forget: trigger Clara review via the platform API
      triggerClaraReview(taskId).catch(() => {});
    }
  } catch {
    // Silently ignore parse errors
  }

  // Always approve — this hook observes and triggers, doesn't block
  process.stdout.write(JSON.stringify({ decision: 'approve' }));
}

main().catch(() => {
  process.stdout.write(JSON.stringify({ decision: 'approve' }));
});
