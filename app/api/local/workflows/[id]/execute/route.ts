import { wsDb } from '@/lib/workflow-studio-db';
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

// ── API key helpers ──────────────────────────────────────────

async function keychainGetSafe(key: string): Promise<string | null> {
  try {
    const { keychainGet } = await import('@/lib/keychain');
    return await keychainGet(key);
  } catch { return null; }
}

async function getGeminiKey(): Promise<string | null> {
  return (await keychainGetSafe('gemini_api_key')) ?? process.env.GEMINI_API_KEY ?? null;
}
async function getAnthropicKey(): Promise<string | null> {
  return (await keychainGetSafe('anthropic_api_key')) ?? process.env.ANTHROPIC_API_KEY ?? null;
}
async function getOpenAIKey(): Promise<string | null> {
  return (await keychainGetSafe('openai_api_key')) ?? process.env.OPENAI_API_KEY ?? null;
}

// ── Unified LLM caller ──────────────────────────────────────

async function callLLM(opts: {
  model?: string; system?: string; user: string; temperature?: number; maxTokens?: number;
}): Promise<string> {
  const model = opts.model || 'gemini-2.5-flash';
  const temp = opts.temperature ?? 0.7;
  const maxTok = opts.maxTokens ?? 4096;

  if (model.startsWith('gemini') || model.startsWith('MiniMax')) {
    const key = await getGeminiKey();
    if (!key) throw new Error('Gemini API key not configured. Add gemini_api_key in Settings.');
    const apiModel = model.startsWith('MiniMax') ? 'gemini-2.5-flash' : model;
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${apiModel}:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: opts.user }] }],
          ...(opts.system ? { systemInstruction: { parts: [{ text: opts.system }] } } : {}),
          generationConfig: { temperature: temp, maxOutputTokens: maxTok },
        }),
      },
    );
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      throw new Error(`Gemini ${res.status}: ${err.slice(0, 200)}`);
    }
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  if (model.startsWith('claude')) {
    const key = await getAnthropicKey();
    if (!key) throw new Error('Anthropic API key not configured. Add anthropic_api_key in Settings.');
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTok,
        ...(opts.system ? { system: opts.system } : {}),
        messages: [{ role: 'user', content: opts.user }],
        temperature: temp,
      }),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      throw new Error(`Anthropic ${res.status}: ${err.slice(0, 200)}`);
    }
    const data = await res.json();
    return data.content?.[0]?.text || '';
  }

  if (model.startsWith('gpt')) {
    const key = await getOpenAIKey();
    if (!key) throw new Error('OpenAI API key not configured. Add openai_api_key in Settings.');
    const messages: { role: string; content: string }[] = [];
    if (opts.system) messages.push({ role: 'system', content: opts.system });
    messages.push({ role: 'user', content: opts.user });
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, messages, temperature: temp, max_tokens: maxTok }),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      throw new Error(`OpenAI ${res.status}: ${err.slice(0, 200)}`);
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  }

  // Fallback to Gemini
  return callLLM({ ...opts, model: 'gemini-2.5-flash' });
}

// ── Template resolution ──────────────────────────────────────

function resolveTemplate(
  template: string,
  input: any,
  allResults?: Record<string, any>,
  vars?: Record<string, any>,
): string {
  if (!template) return typeof input === 'string' ? input : JSON.stringify(input ?? '');
  let out = template;
  const inputStr = typeof input === 'string' ? input : JSON.stringify(input ?? '');
  out = out.replace(/\{\{input\}\}/g, inputStr);
  out = out.replace(/\{\{input\.(\w+)\}\}/g, (_, key) => {
    if (input && typeof input === 'object' && key in input) return String(input[key]);
    return '';
  });
  out = out.replace(/\{\{date\}\}/g, new Date().toISOString().split('T')[0]);
  if (allResults) {
    out = out.replace(/\{\{([\w][\w-]*)\.([\w]+)\}\}/g, (full, bid, field) => {
      if (bid === 'input' || bid === 'var' || bid === 'date') return full;
      const r = allResults[bid];
      if (r && typeof r === 'object' && field in r) return String(r[field]);
      if (r && field === 'response') return typeof r === 'string' ? r : JSON.stringify(r);
      return full;
    });
  }
  if (vars) {
    out = out.replace(/\{\{var\.([\w]+)\}\}/g, (_, name) => String(vars[name] ?? ''));
  }
  return out;
}

// ── Google Workspace MCP block executor ──────────────────────

const GOOGLE_TOOL_MAP: Record<string, Record<string, string>> = {
  google_gmail: {
    send: 'mcp__google-workspace__gmail_send',
    search: 'mcp__google-workspace__gmail_search',
    get: 'mcp__google-workspace__gmail_get',
    createDraft: 'mcp__google-workspace__gmail_createDraft',
    listLabels: 'mcp__google-workspace__gmail_listLabels',
  },
  google_docs: {
    create: 'mcp__google-workspace__docs_create',
    getText: 'mcp__google-workspace__docs_getText',
    appendText: 'mcp__google-workspace__docs_appendText',
    insertText: 'mcp__google-workspace__docs_insertText',
    replaceText: 'mcp__google-workspace__docs_replaceText',
    find: 'mcp__google-workspace__docs_find',
  },
  google_drive: {
    search: 'mcp__google-workspace__drive_search',
    findFolder: 'mcp__google-workspace__drive_findFolder',
    download: 'mcp__google-workspace__drive_downloadFile',
  },
  google_sheets: {
    getRange: 'mcp__google-workspace__sheets_getRange',
    getText: 'mcp__google-workspace__sheets_getText',
    getMetadata: 'mcp__google-workspace__sheets_getMetadata',
    find: 'mcp__google-workspace__sheets_find',
  },
  google_calendar: {
    listEvents: 'mcp__google-workspace__calendar_listEvents',
    createEvent: 'mcp__google-workspace__calendar_createEvent',
    findFreeTime: 'mcp__google-workspace__calendar_findFreeTime',
    getEvent: 'mcp__google-workspace__calendar_getEvent',
    deleteEvent: 'mcp__google-workspace__calendar_deleteEvent',
  },
};

async function executeGoogleBlock(
  tool: string, params: Record<string, any>, previousOutput: any, baseUrl: string, block: any,
): Promise<any> {
  const operation = params.operation ?? Object.keys(GOOGLE_TOOL_MAP[tool] ?? {})[0];
  const mcpTool = GOOGLE_TOOL_MAP[tool]?.[operation];
  if (!mcpTool) return { error: `Unknown Google operation: ${tool}.${operation}` };

  const toolArgs: Record<string, string> = {};
  for (const [key, val] of Object.entries(params)) {
    if (key === 'operation') continue;
    if (typeof val === 'string') toolArgs[key] = resolveTemplate(val, previousOutput);
    else if (val !== undefined && val !== null) toolArgs[key] = String(val);
  }

  const prompt = `Use the MCP tool "${mcpTool}" with these arguments: ${JSON.stringify(toolArgs)}. Return only the tool result, no commentary.`;
  try {
    const res = await fetch(`${baseUrl}/api/agents/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: prompt, model: 'claude-haiku-4-20250514', tools: [mcpTool], maxTokens: 4096 }),
    });
    if (!res.ok) {
      return { error: `Google MCP not available (${res.status}). Configure Google Workspace in Settings.`, status: 'stub' };
    }
    const text = await res.text();
    let output = '';
    for (const line of text.split('\n')) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line);
        if (event.type === 'assistant' && event.message?.content) {
          for (const part of event.message.content) {
            if (part.type === 'text') output += part.text;
          }
        } else if (event.type === 'result' && event.result) {
          output = event.result;
        }
      } catch {
        output += line;
      }
    }
    return output || { response: `Google ${tool}.${operation} completed`, params: toolArgs };
  } catch (err) {
    return { error: `Google MCP failed: ${err}`, status: 'stub' };
  }
}

// ── Main workflow executor ───────────────────────────────────

async function executeWorkflow(
  state: { blocks: any[]; connections: any[] },
  baseUrl: string,
): Promise<{ results: Record<string, any>; error?: string }> {
  const blocks = state.blocks ?? [];
  const connections = state.connections ?? [];
  const results: Record<string, any> = {};
  const workflowVars: Record<string, any> = {};
  const skipped = new Set<string>();

  // Build execution order via topological sort (Kahn's algorithm)
  const adjacency: Record<string, string[]> = {};
  const inDegree: Record<string, number> = {};
  for (const b of blocks) {
    adjacency[b.id] = [];
    inDegree[b.id] = 0;
  }
  for (const c of connections) {
    if (adjacency[c.source]) adjacency[c.source].push(c.target);
    inDegree[c.target] = (inDegree[c.target] ?? 0) + 1;
  }
  const queue = blocks.filter((b) => (inDegree[b.id] ?? 0) === 0).map((b) => b.id);
  const order: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    order.push(current);
    for (const next of adjacency[current] ?? []) {
      inDegree[next]--;
      if (inDegree[next] === 0) queue.push(next);
    }
  }

  // Execute blocks in topological order
  for (const blockId of order) {
    const block = blocks.find((b: any) => b.id === blockId);
    if (!block || block.enabled === false) continue;

    // ── Branch tracking: skip blocks on the wrong side of a condition/router
    const incomingConns = connections.filter((c: any) => c.target === blockId);
    if (incomingConns.length > 0) {
      const allInactive = incomingConns.every((c: any) => {
        if (skipped.has(c.source)) return true;
        if (c.sourceHandle) {
          const sr = results[c.source];
          const branch = sr?.branch;
          if (branch !== undefined && String(branch) !== String(c.sourceHandle)) return true;
        }
        return false;
      });
      if (allInactive) {
        skipped.add(blockId);
        results[blockId] = { skipped: true };
        continue;
      }
    }

    const tool = block.config?.tool;
    const params = block.config?.params ?? {};
    const incomingConn = connections.find((c: any) => c.target === blockId);
    const previousOutput = incomingConn ? results[incomingConn.source] : undefined;

    // Helper: resolve a param with full context
    const R = (tmpl: string) => resolveTemplate(tmpl, previousOutput, results, workflowVars);

    try {
      // ════════════════════════════════════════════════════════
      // TRIGGERS
      // ════════════════════════════════════════════════════════

      if (tool === 'starter') {
        results[blockId] = { triggered: true, type: params.triggerType || 'manual', timestamp: new Date().toISOString() };
      } else if (tool === 'generic_webhook') {
        results[blockId] = { triggered: true, path: params.webhookPath, method: params.method || 'POST' };

      // ════════════════════════════════════════════════════════
      // AI BLOCKS
      // ════════════════════════════════════════════════════════

      } else if (tool === 'agent' && params.agentId) {
        // MC Agent — invoke via /api/agents/:id/stream
        const message = R(params.userPrompt || '{{input}}');
        const res = await fetch(`${baseUrl}/api/agents/${encodeURIComponent(params.agentId)}/stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, model: params.model }),
        });
        if (!res.ok) {
          results[blockId] = { error: `Agent returned ${res.status}` };
          continue;
        }
        const text = await res.text();
        let agentOutput = '';
        for (const line of text.split('\n')) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            if (event.type === 'assistant' && event.message?.content) {
              for (const part of event.message.content) {
                if (part.type === 'text') agentOutput += part.text;
              }
            } else if (event.type === 'result' && event.result) {
              agentOutput = event.result;
            }
          } catch { agentOutput += line; }
        }
        results[blockId] = agentOutput || text;

      } else if (tool === 'agent') {
        // Generic LLM call — Gemini/Anthropic/OpenAI based on model selection
        const system = R(params.systemPrompt || '');
        const user = R(params.userPrompt || '{{input}}');
        results[blockId] = await callLLM({
          model: params.model,
          system: system || undefined,
          user,
          temperature: parseFloat(params.temperature) || 0.7,
          maxTokens: parseInt(params.maxTokens) || 4096,
        });

      } else if (tool === 'thinking') {
        // Extended thinking — deeper reasoning pass
        const prompt = R(params.prompt || '{{input}}');
        results[blockId] = await callLLM({
          model: params.model || 'claude-sonnet-4-20250514',
          system: 'Think step by step. Break down the problem and reason through each part carefully before arriving at a conclusion.',
          user: prompt,
          temperature: 0.3,
          maxTokens: parseInt(params.maxTokens) || 8192,
        });

      } else if (tool === 'openai') {
        // OpenAI GPT call
        const system = R(params.systemPrompt || '');
        const user = R(params.userPrompt || '{{input}}');
        results[blockId] = await callLLM({
          model: params.model || 'gpt-4o',
          system: system || undefined,
          user,
          temperature: parseFloat(params.temperature) || 0.7,
          maxTokens: parseInt(params.maxTokens) || 4096,
        });

      } else if (tool === 'evaluator') {
        // AI-powered content evaluation
        const criteria = R(params.criteria || '');
        const rubric = R(params.rubric || '');
        const inputText = typeof previousOutput === 'string' ? previousOutput : JSON.stringify(previousOutput ?? '');
        const evalPrompt = `Evaluate the following content:\n\n---\n${inputText}\n---\n\nCriteria: ${criteria}\n\n${rubric ? `Rubric:\n${rubric}\n\n` : ''}Respond with ONLY a JSON object: { "score": <0-10>, "passed": <true if score>=7>, "feedback": "<summary>" }`;
        const response = await callLLM({
          model: params.model || 'gemini-2.5-flash',
          system: 'You are a content evaluator. Return only valid JSON, no markdown fences.',
          user: evalPrompt,
          temperature: 0.2,
          maxTokens: 1024,
        });
        try {
          results[blockId] = JSON.parse(response.replace(/```json?\n?/g, '').replace(/```/g, '').trim());
        } catch {
          results[blockId] = { score: 0, passed: false, feedback: response, parseError: true };
        }

      } else if (tool === 'guardrails') {
        // AI-powered safety/rule check
        const rules = R(params.rules || '');
        const action = params.action || 'block';
        const inputText = typeof previousOutput === 'string' ? previousOutput : JSON.stringify(previousOutput ?? '');
        const checkPrompt = `Check if the following content violates ANY of these rules:\n\nRules:\n${rules}\n\nContent:\n---\n${inputText}\n---\n\nRespond with ONLY JSON: { "passed": <true/false>, "violations": ["<description>"], "severity": "none|low|medium|high" }`;
        const response = await callLLM({
          model: 'gemini-2.5-flash',
          system: 'You are a content safety evaluator. Return only valid JSON, no markdown fences.',
          user: checkPrompt,
          temperature: 0.1,
          maxTokens: 1024,
        });
        try {
          const parsed = JSON.parse(response.replace(/```json?\n?/g, '').replace(/```/g, '').trim());
          if (!parsed.passed && action === 'block') {
            results[blockId] = { blocked: true, violations: parsed.violations, severity: parsed.severity, error: `Guardrails blocked: ${(parsed.violations || []).join('; ')}` };
          } else {
            results[blockId] = { passed: parsed.passed, violations: parsed.violations, input: previousOutput, action: parsed.passed ? 'pass' : action };
          }
        } catch {
          results[blockId] = { passed: true, input: previousOutput, note: 'Guardrails returned non-JSON', raw: response };
        }

      // ════════════════════════════════════════════════════════
      // LOGIC BLOCKS
      // ════════════════════════════════════════════════════════

      } else if (tool === 'function') {
        // Real JavaScript execution — user code wrapped in async IIFE for await support
        const code = params.code || 'return $.input;';
        const fn = new Function('$', `'use strict';\nreturn (async () => {\n${code}\n})();`);
        const fnResult = await fn({ input: previousOutput, results, vars: workflowVars, blockId });
        results[blockId] = fnResult;

      } else if (tool === 'condition') {
        // Real expression evaluation — returns { branch: 'true'|'false' }
        const expr = params.condition || 'true';
        const fn = new Function('$', `'use strict'; return (${expr});`);
        const result = !!fn({ input: previousOutput, results, vars: workflowVars });
        results[blockId] = { branch: result ? 'true' : 'false', response: result, input: previousOutput };

      } else if (tool === 'router') {
        // Multi-way routing — evaluates expression, matches to route values
        const expr = params.condition || "''";
        let routes: { value: string; label: string }[] = [];
        try { routes = JSON.parse(params.routes || '[]'); } catch { /* ignore */ }
        const fn = new Function('$', `'use strict'; return (${expr});`);
        const value = String(fn({ input: previousOutput, results, vars: workflowVars }));
        const matched = routes.find((r) => r.value === value);
        results[blockId] = { branch: value, matched: matched?.label || value, input: previousOutput };

      // ════════════════════════════════════════════════════════
      // INTEGRATION BLOCKS
      // ════════════════════════════════════════════════════════

      } else if (tool === 'api') {
        // Real HTTP request
        const method = params.method || 'GET';
        const url = R(params.url || '');
        if (!url) { results[blockId] = { error: 'API URL not specified.' }; continue; }
        let headers: Record<string, string> = {};
        try { headers = JSON.parse(R(params.headers || '{}')); } catch { /* ignore */ }
        const body = method !== 'GET' && method !== 'HEAD' ? R(params.body || '') : undefined;
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json', ...headers },
          ...(body ? { body } : {}),
        });
        const contentType = res.headers.get('content-type') || '';
        const data = contentType.includes('json') ? await res.json() : await res.text();
        results[blockId] = { status: res.status, data, ok: res.ok };
        if (!res.ok) (results[blockId] as any).error = `HTTP ${res.status}`;

      } else if (tool === 'slack') {
        // Slack Incoming Webhook
        const webhookUrl = params.webhookUrl || '';
        const message = R(params.message || '{{input}}');
        const channel = params.channel || '';
        if (!webhookUrl) { results[blockId] = { error: 'Slack webhook URL not configured. Add your Slack Incoming Webhook URL in the block settings.' }; continue; }
        const payload: Record<string, string> = { text: message };
        if (channel) payload.channel = channel;
        const res = await fetch(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        results[blockId] = { sent: res.ok, channel, message };
        if (!res.ok) (results[blockId] as any).error = `Slack returned ${res.status}`;

      } else if (tool === 'discord') {
        // Discord Webhook
        const webhookUrl = params.webhookUrl || '';
        const message = R(params.message || '{{input}}');
        const username = params.username || 'Workflow Bot';
        if (!webhookUrl) { results[blockId] = { error: 'Discord webhook URL not configured.' }; continue; }
        const res = await fetch(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: message, username }) });
        results[blockId] = { sent: res.ok, message };
        if (!res.ok) (results[blockId] as any).error = `Discord returned ${res.status}`;

      } else if (tool === 'gmail') {
        // Gmail — route through Google Workspace MCP
        const to = R(params.to || '');
        const subject = R(params.subject || '');
        const body = R(params.body || '{{input}}');
        const gmailResult = await executeGoogleBlock('google_gmail', { operation: 'send', to, subject, body }, previousOutput, baseUrl, block);
        if (gmailResult?.status === 'stub' || gmailResult?.error) {
          results[blockId] = { sent: false, to, subject, error: gmailResult?.error || 'Gmail requires Google Workspace MCP. Use the Google Gmail (MCP) block or configure in Settings.' };
        } else {
          results[blockId] = { sent: true, to, subject, provider: 'google_gmail' };
        }

      } else if (tool === 'smtp') {
        // SMTP — route through Gmail MCP as fallback (nodemailer not available in serverless)
        const to = R(params.to || '');
        const subject = R(params.subject || '');
        const body = R(params.body || '{{input}}');
        if (!to) { results[blockId] = { error: 'Recipient email (to) not specified.' }; continue; }
        const smtpResult = await executeGoogleBlock('google_gmail', { operation: 'send', to, subject, body }, previousOutput, baseUrl, block);
        if (smtpResult?.status === 'stub' || smtpResult?.error) {
          results[blockId] = { sent: false, to, subject, error: smtpResult?.error || 'SMTP fallback to Gmail MCP failed. Configure Google Workspace in Settings.' };
        } else {
          results[blockId] = { sent: true, to, subject, provider: 'gmail_mcp_fallback' };
        }

      } else if (tool === 'webhook_request') {
        // Outbound webhook
        const url = R(params.url || '');
        const method = params.method || 'POST';
        const payload = R(params.payload || '{{input}}');
        if (!url) { results[blockId] = { error: 'Webhook URL not specified.' }; continue; }
        const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: payload });
        let data;
        try { data = await res.json(); } catch { data = await res.text(); }
        results[blockId] = { sent: res.ok, status: res.status, data };
        if (!res.ok) (results[blockId] as any).error = `Webhook returned ${res.status}`;

      } else if (tool === 'github') {
        // GitHub API
        const action = params.action || 'create-issue';
        const repo = R(params.repo || '');
        const title = R(params.title || '');
        const body = R(params.body || '');
        let token = (await keychainGetSafe('github_token')) ?? process.env.GITHUB_TOKEN ?? '';
        if (!token) { results[blockId] = { error: 'GitHub token not configured. Set github_token in Settings or GITHUB_TOKEN env var.' }; continue; }
        if (!repo) { results[blockId] = { error: 'Repository not specified (format: owner/repo).' }; continue; }
        const ghHeaders = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' };
        if (action === 'create-issue') {
          const res = await fetch(`https://api.github.com/repos/${repo}/issues`, { method: 'POST', headers: ghHeaders, body: JSON.stringify({ title, body }) });
          const data = await res.json();
          results[blockId] = res.ok ? { created: true, number: data.number, url: data.html_url } : { error: `GitHub: ${data.message}` };
        } else if (action === 'create-pr') {
          const res = await fetch(`https://api.github.com/repos/${repo}/pulls`, { method: 'POST', headers: ghHeaders, body: JSON.stringify({ title, body, head: 'dev', base: 'main' }) });
          const data = await res.json();
          results[blockId] = res.ok ? { created: true, number: data.number, url: data.html_url } : { error: `GitHub: ${data.message}` };
        } else if (action === 'add-comment') {
          const issueNum = R(params.issueNumber || '');
          const res = await fetch(`https://api.github.com/repos/${repo}/issues/${issueNum}/comments`, { method: 'POST', headers: ghHeaders, body: JSON.stringify({ body }) });
          const data = await res.json();
          results[blockId] = res.ok ? { posted: true, url: data.html_url } : { error: `GitHub: ${data.message}` };
        } else if (action === 'list-issues') {
          const res = await fetch(`https://api.github.com/repos/${repo}/issues?state=open&per_page=20`, { headers: ghHeaders });
          const data = await res.json();
          results[blockId] = res.ok ? { issues: data.map((i: any) => ({ number: i.number, title: i.title, state: i.state })) } : { error: `GitHub: ${data.message}` };
        } else {
          results[blockId] = { error: `Unknown GitHub action: ${action}` };
        }

      } else if (tool === 'notion') {
        // Notion API
        const action = params.action || 'create-page';
        const content = R(params.content || '{{input}}');
        const databaseId = R(params.databaseId || '');
        let notionKey = (await keychainGetSafe('notion_api_key')) ?? process.env.NOTION_API_KEY ?? '';
        if (!notionKey) { results[blockId] = { error: 'Notion API key not configured. Set notion_api_key in Settings or NOTION_API_KEY env var.' }; continue; }
        const notionHeaders = { Authorization: `Bearer ${notionKey}`, 'Content-Type': 'application/json', 'Notion-Version': '2022-06-28' };
        if (action === 'create-page') {
          const pageData: any = {
            parent: databaseId ? { database_id: databaseId } : { page_id: databaseId },
            properties: { title: { title: [{ text: { content: R(params.title || 'Untitled') } }] } },
            children: [{ object: 'block', type: 'paragraph', paragraph: { rich_text: [{ text: { content } }] } }],
          };
          const res = await fetch('https://api.notion.com/v1/pages', { method: 'POST', headers: notionHeaders, body: JSON.stringify(pageData) });
          const data = await res.json();
          results[blockId] = res.ok ? { created: true, pageId: data.id, url: data.url } : { error: `Notion: ${data.message}` };
        } else if (action === 'query-database') {
          if (!databaseId) { results[blockId] = { error: 'Database ID required for query.' }; continue; }
          const res = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, { method: 'POST', headers: notionHeaders, body: JSON.stringify({}) });
          const data = await res.json();
          results[blockId] = res.ok ? { results: data.results?.map((p: any) => ({ id: p.id, url: p.url })) || [] } : { error: `Notion: ${data.message}` };
        } else {
          results[blockId] = { error: `Unknown Notion action: ${action}` };
        }

      } else if (tool === 'telegram') {
        // Telegram Bot API
        const chatId = R(params.chatId || '');
        const message = R(params.message || '{{input}}');
        const botToken = params.botToken || '';
        if (!botToken) { results[blockId] = { error: 'Telegram bot token not configured.' }; continue; }
        if (!chatId) { results[blockId] = { error: 'Telegram chat ID not specified.' }; continue; }
        const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'Markdown' }),
        });
        const data = await res.json();
        results[blockId] = data.ok ? { sent: true, messageId: data.result?.message_id } : { error: `Telegram: ${data.description}` };

      } else if (tool === 'x_twitter') {
        // X/Twitter API v2
        const operation = params.operation || 'post_tweet';
        let bearerToken = params.bearerToken || '';
        if (!bearerToken) bearerToken = (await keychainGetSafe('x_bearer_token')) ?? (await keychainGetSafe('twitter_bearer_token')) ?? process.env.X_BEARER_TOKEN ?? '';
        if (!bearerToken) { results[blockId] = { error: 'X/Twitter credentials not configured. Set your bearer token in the block settings or configure x_bearer_token in Settings.' }; continue; }
        const authHeader = { Authorization: `Bearer ${bearerToken}`, 'Content-Type': 'application/json' };

        if (operation === 'post_tweet') {
          const content = R(params.content || '{{input}}');
          const res = await fetch('https://api.x.com/2/tweets', { method: 'POST', headers: authHeader, body: JSON.stringify({ text: content }) });
          const data = await res.json();
          results[blockId] = res.ok ? { posted: true, tweetId: data.data?.id, text: content } : { error: `X API: ${data.detail || data.title || JSON.stringify(data.errors?.[0]) || res.status}` };
        } else if (operation === 'search_tweets') {
          const query = R(params.query || '{{input}}');
          const res = await fetch(`https://api.x.com/2/tweets/search/recent?query=${encodeURIComponent(query)}&max_results=${params.maxResults || '10'}`, { headers: authHeader });
          const data = await res.json();
          results[blockId] = res.ok ? { tweets: data.data || [], meta: data.meta } : { error: `X API: ${data.detail || res.status}` };
        } else if (operation === 'get_user') {
          const username = R(params.username || '');
          const res = await fetch(`https://api.x.com/2/users/by/username/${encodeURIComponent(username)}?user.fields=public_metrics,description`, { headers: authHeader });
          const data = await res.json();
          results[blockId] = res.ok ? data.data : { error: `X API: ${data.detail || res.status}` };
        } else if (operation === 'reply') {
          const content = R(params.content || '{{input}}');
          const replyToId = R(params.replyToId || '');
          const res = await fetch('https://api.x.com/2/tweets', {
            method: 'POST', headers: authHeader,
            body: JSON.stringify({ text: content, reply: { in_reply_to_tweet_id: replyToId } }),
          });
          const data = await res.json();
          results[blockId] = res.ok ? { posted: true, tweetId: data.data?.id } : { error: `X API: ${data.detail || res.status}` };
        } else {
          results[blockId] = { error: `Unknown X operation: ${operation}` };
        }

      // ════════════════════════════════════════════════════════
      // GOOGLE MCP BLOCKS
      // ════════════════════════════════════════════════════════

      } else if (tool?.startsWith('google_')) {
        results[blockId] = await executeGoogleBlock(tool, params, previousOutput, baseUrl, block);

      // ════════════════════════════════════════════════════════
      // MC ACTION BLOCKS
      // ════════════════════════════════════════════════════════

      } else if (tool === 'send_message') {
        // Fixed: correct payload format for /api/chat
        const to = R(params.to || '');
        const message = R(params.message || '{{input}}');
        const res = await fetch(`${baseUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'save', role: 'assistant', content: message, sessionKey: to, channel: to }),
        });
        results[blockId] = { sent: res.ok, to, message };
        if (!res.ok) (results[blockId] as any).error = `Chat API returned ${res.status}`;

      } else if (tool === 'create_task') {
        const title = R(params.title || '');
        const description = R(params.description || '');
        const planningNotes = R(params.planningNotes || '');
        // Parse subtasks — supports JSON array [{title, assignedTo}] or legacy newline-separated strings
        let subtasks: { title: string; assignedTo?: string }[] = [];
        if (typeof params.subtasks === 'string' && params.subtasks.trim()) {
          try {
            const parsed = JSON.parse(params.subtasks);
            if (Array.isArray(parsed)) {
              subtasks = parsed.map((s: any) => ({ title: String(s.title || ''), assignedTo: s.assignedTo || undefined }));
            }
          } catch {
            subtasks = params.subtasks.split('\n').filter((l: string) => l.trim()).map((s: string) => ({ title: s.trim() }));
          }
        }
        // 1. Create the task
        const res = await fetch(`${baseUrl}/api/tasks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            description: description || undefined,
            planningNotes: planningNotes || undefined,
            priority: params.priority || 'p2',
            assignedTo: params.assignTo || undefined,
          }),
        });
        const data = await res.json();
        // 2. Create subtasks via the subtasks endpoint
        let subtasksCreated = 0;
        if (res.ok && data.id && subtasks.length > 0) {
          for (const st of subtasks) {
            if (!st.title) continue;
            try {
              const stRes = await fetch(`${baseUrl}/api/tasks/${encodeURIComponent(data.id)}/subtasks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: st.title, assignedTo: st.assignedTo || undefined }),
              });
              if (stRes.ok) subtasksCreated++;
            } catch { /* skip failed subtask */ }
          }
        }
        results[blockId] = { created: res.ok, taskId: data.id, title, subtasksCreated };
        if (!res.ok) (results[blockId] as any).error = 'Tasks API unavailable';

      } else if (tool === 'assign_task') {
        const taskId = R(params.taskId || '');
        const agentId = R(params.agentId || '');
        const res = await fetch(`${baseUrl}/api/tasks/${encodeURIComponent(taskId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assignedTo: agentId }),
        });
        results[blockId] = { assigned: res.ok, taskId, agentId };

      } else if (tool === 'update_task_status') {
        const taskId = R(params.taskId || '');
        const status = params.status || 'in-progress';
        const res = await fetch(`${baseUrl}/api/tasks/${encodeURIComponent(taskId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        });
        results[blockId] = { updated: res.ok, taskId, status };

      } else if (tool === 'send_approval') {
        const description = R(params.description || '{{input}}');
        const res = await fetch(`${baseUrl}/api/approvals`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ description, approvers: params.approvers }),
        });
        const data = await res.json();
        results[blockId] = { created: res.ok, approvalId: data.id, description };
        if (!res.ok) (results[blockId] as any).error = 'Approvals API unavailable';

      } else if (tool === 'notify_agent') {
        // Fixed: correct payload format for /api/chat
        const agentId = R(params.agentId || '');
        const message = R(params.message || '{{input}}');
        const res = await fetch(`${baseUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'save', role: 'system', content: `[Workflow Notification] ${message}`, sessionKey: agentId, channel: agentId }),
        });
        results[blockId] = { notified: res.ok, agentId, message };
        if (!res.ok) (results[blockId] as any).error = `Chat API returned ${res.status}`;

      } else if (tool === 'send_email_mc') {
        // MC Email — try Google Gmail MCP
        const to = R(params.to || '');
        const subject = R(params.subject || '');
        const body = R(params.body || '{{input}}');
        const gmailResult = await executeGoogleBlock('google_gmail', { operation: 'send', to, subject, body }, previousOutput, baseUrl, block);
        if (gmailResult?.status === 'stub' || gmailResult?.error) {
          results[blockId] = { sent: false, to, subject, error: gmailResult?.error || 'Email requires Google Workspace MCP. Configure in Settings.' };
        } else {
          results[blockId] = { sent: true, to, subject, body, provider: 'google_gmail' };
        }

      } else if (tool === 'run_workflow') {
        const workflowId = R(params.workflowId || '');
        if (!workflowId) { results[blockId] = { triggered: false, error: 'No workflow ID specified.' }; continue; }
        const inputs = R(params.inputs || '');
        const res = await fetch(`${baseUrl}/api/local/workflows/${encodeURIComponent(workflowId)}/execute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(inputs ? JSON.parse(inputs) : {}),
        });
        const data = await res.json();
        results[blockId] = { triggered: res.ok, workflowId, executionId: data.id, result: data.result };

      } else if (tool === 'save_to_library') {
        const folder = R(params.folder || 'workflow-output');
        const content = R(params.content || '{{input}}');
        const filename = R(params.filename || '') || `workflow-output-${new Date().toISOString().slice(0, 10)}.md`;
        const filePath = folder ? `${folder}/${filename}` : filename;
        try {
          const res = await fetch(`${baseUrl}/api/library`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'append', path: filePath, content }),
          });
          results[blockId] = { saved: res.ok, path: filePath, filename };
          if (!res.ok) (results[blockId] as any).error = `Library write failed: ${res.status}`;
        } catch (err) {
          results[blockId] = { saved: false, path: filePath, error: `Library not available: ${err}` };
        }

      // ════════════════════════════════════════════════════════
      // DATA BLOCKS
      // ════════════════════════════════════════════════════════

      } else if (tool === 'search') {
        // Web search — try Perplexity, then fallback
        const query = R(params.query || '{{input}}');
        const perplexityKey = (await keychainGetSafe('perplexity_api_key')) ?? process.env.PERPLEXITY_API_KEY ?? '';
        if (perplexityKey) {
          const res = await fetch('https://api.perplexity.ai/chat/completions', {
            method: 'POST',
            headers: { Authorization: `Bearer ${perplexityKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'sonar', messages: [{ role: 'user', content: query }] }),
          });
          if (res.ok) {
            const data = await res.json();
            results[blockId] = { query, answer: data.choices?.[0]?.message?.content || '' };
          } else {
            results[blockId] = { error: `Perplexity returned ${res.status}`, query };
          }
        } else {
          // Fallback: use Gemini as a search proxy
          try {
            const answer = await callLLM({
              model: 'gemini-2.5-flash',
              system: 'You are a research assistant. Answer the query with accurate, up-to-date information. Be concise.',
              user: query,
              temperature: 0.3,
              maxTokens: 2048,
            });
            results[blockId] = { query, answer, note: 'Used LLM as search fallback. Configure perplexity_api_key for real web search.' };
          } catch (err) {
            results[blockId] = { error: `Search requires perplexity_api_key or gemini_api_key. ${err}`, query };
          }
        }

      } else if (tool === 'knowledge') {
        // Knowledge base — wired to MC's real knowledge API (FTS5 BM25 search + CRUD)
        const operation = params.operation || 'search';
        const query = R(params.query || params.search || '{{input}}');
        const category = R(params.category || '');
        const scope = R(params.scope || '');

        if (operation === 'search' || operation === 'list') {
          // GET /api/knowledge?search=...&category=...&scope=...
          const qs = new URLSearchParams();
          if (query && operation === 'search') qs.set('search', query);
          if (category) qs.set('category', category);
          if (scope) qs.set('scope', scope);
          try {
            const res = await fetch(`${baseUrl}/api/knowledge?${qs.toString()}`);
            if (res.ok) {
              const data = await res.json();
              results[blockId] = { articles: data.articles || data, query, count: Array.isArray(data.articles || data) ? (data.articles || data).length : 0 };
            } else {
              results[blockId] = { error: `Knowledge API returned ${res.status}`, query };
            }
          } catch {
            results[blockId] = { error: 'Knowledge base API not available.', query };
          }
        } else if (operation === 'get') {
          // GET /api/knowledge/:id
          const articleId = R(params.articleId || params.id || '');
          try {
            const res = await fetch(`${baseUrl}/api/knowledge/${encodeURIComponent(articleId)}`);
            results[blockId] = res.ok ? await res.json() : { error: `Article ${articleId} not found` };
          } catch {
            results[blockId] = { error: `Could not fetch article: ${articleId}` };
          }
        } else if (operation === 'create') {
          // POST /api/knowledge — create article
          const title = R(params.title || 'Untitled');
          const content = R(params.content || '{{input}}');
          const tags = params.tags ? (Array.isArray(params.tags) ? params.tags : [params.tags]) : [];
          try {
            const res = await fetch(`${baseUrl}/api/knowledge`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ title, content, category: category || 'general', tags, scope: scope || 'all' }),
            });
            results[blockId] = res.ok ? await res.json() : { error: `Create failed: ${res.status}` };
          } catch {
            results[blockId] = { error: 'Could not create knowledge article.' };
          }
        } else if (operation === 'update') {
          const articleId = R(params.articleId || params.id || '');
          const updates: Record<string, unknown> = {};
          if (params.title) updates.title = R(params.title);
          if (params.content) updates.content = R(params.content);
          if (params.tags) updates.tags = Array.isArray(params.tags) ? params.tags : [params.tags];
          if (category) updates.category = category;
          try {
            const res = await fetch(`${baseUrl}/api/knowledge/${encodeURIComponent(articleId)}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(updates),
            });
            results[blockId] = res.ok ? await res.json() : { error: `Update failed: ${res.status}` };
          } catch {
            results[blockId] = { error: `Could not update article: ${articleId}` };
          }
        } else if (operation === 'delete') {
          const articleId = R(params.articleId || params.id || '');
          try {
            const res = await fetch(`${baseUrl}/api/knowledge/${encodeURIComponent(articleId)}`, { method: 'DELETE' });
            results[blockId] = { deleted: res.ok, articleId };
          } catch {
            results[blockId] = { error: `Could not delete article: ${articleId}` };
          }
        } else {
          results[blockId] = { error: `Unknown knowledge operation: ${operation}` };
        }

      } else if (tool === 'memory') {
        // Memory — wired to MC's vault (Obsidian) via /api/memory/search and filesystem
        // Also uses workflow variables as an in-execution cache
        const action = params.action || params.operation || 'search';
        const query = R(params.query || params.key || '{{input}}');
        const value = R(params.value || params.content || '');

        if (action === 'search' || action === 'read' || action === 'recall') {
          // First check workflow-local cache
          const localVal = workflowVars[`mem_${query}`];
          if (localVal !== undefined && action !== 'search') {
            results[blockId] = { key: query, value: localVal, source: 'workflow-cache' };
          } else {
            // Search MC vault via GET /api/memory/search?q=...
            try {
              const limit = parseInt(params.limit) || 10;
              const mode = params.mode || 'search';
              const res = await fetch(`${baseUrl}/api/memory/search?q=${encodeURIComponent(query)}&mode=${mode}&limit=${limit}`);
              if (res.ok) {
                const data = await res.json();
                results[blockId] = { query, results: data.results, mode: data.mode, source: 'vault' };
              } else {
                results[blockId] = { query, results: [], error: `Memory search returned ${res.status}` };
              }
            } catch {
              results[blockId] = { query, results: [], error: 'Memory vault search not available.' };
            }
          }
        } else if (action === 'write' || action === 'save' || action === 'store') {
          // Write to workflow-local cache
          workflowVars[`mem_${query}`] = value;
          // Also persist to MC library as a markdown file for Obsidian sync
          try {
            const filename = query.replace(/[^a-zA-Z0-9_-]/g, '_') || 'workflow-memory';
            await fetch(`${baseUrl}/api/library`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'append', path: `workflow-memories/${filename}.md`, content: `\n## ${new Date().toISOString()}\n${value}` }),
            });
          } catch { /* local cache still works */ }
          results[blockId] = { written: true, key: query, source: 'workflow-cache+vault' };
        } else if (action === 'delete' || action === 'clear') {
          delete workflowVars[`mem_${query}`];
          results[blockId] = { cleared: true, key: query };
        } else {
          results[blockId] = { key: query, value: workflowVars[`mem_${query}`] ?? null };
        }

      } else if (tool === 'table') {
        // Table data operations — JSON manipulation with filter/map/transform
        const action = params.action || 'read';
        const data = R(params.data || '{{input}}');

        // Parse input data — accept JSON string or pass-through objects
        let parsed: any = previousOutput;
        if (typeof parsed === 'string') {
          try { parsed = JSON.parse(parsed); } catch { /* keep as string */ }
        }

        if (action === 'read') {
          results[blockId] = parsed;
        } else if (action === 'write') {
          try {
            results[blockId] = JSON.parse(data);
          } catch {
            results[blockId] = { error: 'Invalid JSON data for table write.', raw: data };
          }
        } else if (action === 'query') {
          // Filter/transform using JavaScript expression
          const expr = params.query || params.data || '';
          if (expr && Array.isArray(parsed)) {
            try {
              const fn = new Function('rows', '$', `'use strict'; return ${expr};`);
              results[blockId] = fn(parsed, { input: parsed, results, vars: workflowVars });
            } catch (err) {
              results[blockId] = { error: `Table query failed: ${err}`, rows: parsed };
            }
          } else {
            results[blockId] = Array.isArray(parsed) ? parsed : [parsed];
          }
        } else if (action === 'merge') {
          // Merge multiple block outputs
          const sources = (params.sources || '').split(',').map((s: string) => s.trim()).filter(Boolean);
          const merged: any[] = [];
          for (const src of sources) {
            const val = results[src];
            if (Array.isArray(val)) merged.push(...val);
            else if (val != null) merged.push(val);
          }
          results[blockId] = merged.length > 0 ? merged : parsed;
        } else {
          results[blockId] = parsed;
        }

      } else if (tool === 'file') {
        // File operations — wired to MC's real library at ~/mission-control/library/
        const action = params.action || params.operation || 'read';
        const filePath = R(params.path || params.filePath || '');
        const content = R(params.content || '{{input}}');

        if (action === 'write' || action === 'create') {
          // Write/create file via POST /api/library with action=append (creates if not exists)
          const targetPath = filePath || 'workflow-output/output.txt';
          try {
            const res = await fetch(`${baseUrl}/api/library`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'append', path: targetPath, content }),
            });
            const data = res.ok ? await res.json() : null;
            results[blockId] = { written: res.ok, path: targetPath, ...(data || {}) };
            if (!res.ok) (results[blockId] as any).error = `Library write failed: ${res.status}`;
          } catch (err) {
            results[blockId] = { error: `Could not write file: ${err}`, path: targetPath };
          }
        } else if (action === 'read') {
          // Read file via GET /api/library?action=view&id=<base64url(path)>
          try {
            // base64url-encode the relative path (this is how MC library resolves file IDs)
            const encoded = Buffer.from(filePath).toString('base64url');
            const res = await fetch(`${baseUrl}/api/library?action=view&id=${encodeURIComponent(encoded)}`);
            if (res.ok) {
              const data = await res.json();
              results[blockId] = { content: data.content, path: filePath, mimeType: data.mimeType };
            } else {
              results[blockId] = { error: `File not found: ${filePath}` };
            }
          } catch {
            results[blockId] = { error: `Could not read file: ${filePath}` };
          }
        } else if (action === 'list') {
          // List files via GET /api/library (with optional category/search filters)
          try {
            const qs = new URLSearchParams();
            if (filePath) qs.set('q', filePath);
            if (params.category) qs.set('category', R(params.category));
            const recentLimit = params.limit || '20';
            qs.set('recent', recentLimit);
            const res = await fetch(`${baseUrl}/api/library?${qs.toString()}`);
            if (res.ok) {
              const data = await res.json();
              results[blockId] = { files: data.files || [], count: (data.files || []).length };
            } else {
              results[blockId] = { files: [], error: `Library list failed: ${res.status}` };
            }
          } catch {
            results[blockId] = { files: [] };
          }
        } else if (action === 'list-folders') {
          // List folder structure via GET /api/library/fs
          try {
            const qs = filePath ? `?path=${encodeURIComponent(filePath)}` : '';
            const res = await fetch(`${baseUrl}/api/library/fs${qs}`);
            results[blockId] = res.ok ? await res.json() : { dirs: [] };
          } catch {
            results[blockId] = { dirs: [] };
          }
        } else if (action === 'delete') {
          try {
            const res = await fetch(`${baseUrl}/api/library`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'delete', id: filePath }),
            });
            results[blockId] = { deleted: res.ok, path: filePath };
          } catch {
            results[blockId] = { error: `Could not delete: ${filePath}` };
          }
        } else {
          results[blockId] = { error: `Unknown file action: ${action}`, path: filePath };
        }

      // ════════════════════════════════════════════════════════
      // UTILITY BLOCKS
      // ════════════════════════════════════════════════════════

      } else if (tool === 'wait') {
        // Real delay (capped at 5 minutes)
        const duration = Math.min(parseInt(params.duration) || 5, 300);
        await new Promise((resolve) => setTimeout(resolve, duration * 1000));
        results[blockId] = { waited: duration, unit: 'seconds' };

      } else if (tool === 'response') {
        results[blockId] = R(params.template || '{{input}}');

      } else if (tool === 'note') {
        // Pass-through — notes are documentation only
        results[blockId] = previousOutput ?? params.content ?? '';

      } else if (tool === 'variables') {
        const action = params.action || 'set';
        const name = params.name || '';
        if (action === 'set') {
          const value = R(params.value || '{{input}}');
          workflowVars[name] = value;
          results[blockId] = { set: true, name, value };
        } else {
          results[blockId] = workflowVars[name] ?? null;
        }

      } else if (tool === 'human_in_the_loop') {
        // Create an approval request and return pending
        const prompt = R(params.prompt || '{{input}}');
        try {
          const res = await fetch(`${baseUrl}/api/approvals`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ description: prompt, type: 'workflow-approval' }),
          });
          const data = await res.json();
          results[blockId] = { pending: true, approvalId: data.id, prompt };
        } catch {
          results[blockId] = { pending: true, prompt, note: 'Approval API not available — workflow continued.' };
        }

      } else {
        // Unknown block type — pass through with warning
        results[blockId] = {
          response: previousOutput ?? null,
          warning: `Unknown block type "${tool}" — no handler implemented. Input was passed through.`,
        };
      }
    } catch (err) {
      results[blockId] = { error: err instanceof Error ? err.message : String(err) };
    }
  }

  // ── Error aggregation ──────────────────────────────────────
  const blockErrors: string[] = [];
  for (const [bid, result] of Object.entries(results)) {
    if (!result || typeof result !== 'object') continue;
    if (result.skipped) continue;
    if (result.error) blockErrors.push(`${bid}: ${result.error}`);
    else if (result.sent === false && (result.note || result.error)) blockErrors.push(`${bid}: ${result.note || result.error}`);
    else if (result.created === false && (result.note || result.error)) blockErrors.push(`${bid}: ${result.note || result.error}`);
    else if (result.blocked) blockErrors.push(`${bid}: Blocked by guardrails`);
  }

  return { results, error: blockErrors.length > 0 ? blockErrors.join('; ') : undefined };
}

// ── POST /api/local/workflows/[id]/execute ───────────────────

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const workflow = wsDb.getWorkflow(id);
    if (!workflow) return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });

    const executionId = randomUUID();
    wsDb.createExecution(executionId, id, 'manual');
    const startTime = Date.now();

    let state: { blocks: any[]; connections: any[] };
    try {
      state = typeof workflow.state === 'string' ? JSON.parse(workflow.state) : workflow.state;
    } catch {
      state = { blocks: [], connections: [] };
    }

    const proto = req.headers.get('x-forwarded-proto') || 'http';
    const host = req.headers.get('host') || 'localhost:3000';
    const baseUrl = `${proto}://${host}`;

    const { results, error } = await executeWorkflow(state, baseUrl);
    const durationMs = Date.now() - startTime;

    wsDb.updateExecution(executionId, {
      status: error ? 'failed' : 'completed',
      result: results,
      error: error || undefined,
      durationMs,
      completedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      id: executionId,
      workflowId: id,
      status: error ? 'failed' : 'completed',
      result: results,
      error: error || undefined,
      duration_ms: durationMs,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
