#!/usr/bin/env node
/**
 * agent-wake.js — PostToolUse hook for mcp__mission-control_db__chat_post
 *
 * When an agent posts to a personal agent room (roomId = "agent:{id}"),
 * this hook immediately wakes that agent by calling the stream API.
 *
 * This is the backbone of agent-to-agent communication:
 *   MC posts to "agent:coder" → coder wakes and reads + responds
 *
 * Always outputs { "decision": "approve" } immediately (non-blocking).
 */

const http = require('http');

async function main() {
  let input = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) input += chunk;

  // Always approve — we only observe
  const approve = () => process.stdout.write(JSON.stringify({ decision: 'approve' }));

  let tool_input;
  try {
    const parsed = JSON.parse(input);
    tool_input = parsed.tool_input || parsed.toolInput || {};
  } catch {
    return approve();
  }

  const roomId = tool_input?.roomId || '';
  const content = tool_input?.content || '';
  const fromAgent = tool_input?.agentId || 'unknown';

  // Only wake personal agent rooms: "agent:{id}"
  if (!roomId.startsWith('agent:')) return approve();

  const targetAgentId = roomId.slice('agent:'.length);
  if (!targetAgentId || targetAgentId === fromAgent) return approve();

  // Fire-and-forget: wake the target agent with the message
  const message = `[Message from ${fromAgent}]: ${content}`;
  const sessionKey = `inbox:${targetAgentId}`;
  const body = JSON.stringify({ message, model: 'claude-sonnet-4-6', sessionKey });

  const req = http.request({
    host: '127.0.0.1',
    port: 3000,
    path: `/api/agents/${targetAgentId}/stream`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    },
  }, (res) => {
    // Drain the stream (required to free the socket) but don't block on it
    res.resume();
  });

  req.on('error', () => {}); // silent — hook must never crash
  req.setTimeout(5000, () => req.destroy());
  req.write(body);
  req.end();

  approve();
}

main().catch(() => process.stdout.write(JSON.stringify({ decision: 'approve' })));
