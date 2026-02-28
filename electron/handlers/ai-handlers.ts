/**
 * AI Analysis & Generation Handlers Module
 *
 * Channels: get-openai-key, ai:analyzeMessages, ai:createDetectedTask,
 * ai:createDetectedEvent, ai:generate-content, ai:generateReply, ai:getAnalysis
 *
 * 7 registerHandler calls total.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { exec, execFile } from 'child_process';
import { registerHandler } from '../ipc-registry';
import { prepare } from '../database';
import { safeLog } from '../logger';
import { FROGGO_DB_CLI, OPENCLAW_CONFIG, OPENCLAW_CONFIG_LEGACY } from '../paths';

const OPENCLAW = '/opt/homebrew/bin/openclaw';

// Read API keys at invocation time, NOT module level
function getAnthropicApiKey(): string {
  let key = process.env.ANTHROPIC_API_KEY || '';
  try {
    const keyPath = path.join(os.homedir(), '.openclaw', 'anthropic.key');
    if (!key && fs.existsSync(keyPath)) key = fs.readFileSync(keyPath, 'utf-8').trim();
  } catch { /* ignore */ }
  if (!key) {
    try {
      for (const cfgPath of [OPENCLAW_CONFIG, OPENCLAW_CONFIG_LEGACY]) {
        if (!key && fs.existsSync(cfgPath)) {
          const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
          const providerSources = [cfg.models?.providers || {}, cfg.providers || {}];
          for (const providers of providerSources) {
            for (const prov of Object.values(providers) as any[]) {
              if (prov?.apiKey?.startsWith('sk-ant')) { key = prov.apiKey; break; }
              if (prov?.anthropicApiKey?.startsWith('sk-ant')) { key = prov.anthropicApiKey; break; }
              if (prov?.config?.apiKey?.startsWith('sk-ant')) { key = prov.config.apiKey; break; }
              if (prov?.config?.anthropicApiKey?.startsWith('sk-ant')) { key = prov.config.anthropicApiKey; break; }
            }
            if (key) break;
          }
        }
        if (key) break;
      }
    } catch { /* ignore */ }
  }
  return key;
}

function getOpenaiApiKey(): string {
  let key = process.env.OPENAI_API_KEY || '';
  try {
    const keyPath = path.join(os.homedir(), '.openclaw', 'openai.key');
    if (!key && fs.existsSync(keyPath)) key = fs.readFileSync(keyPath, 'utf-8').trim();
  } catch { /* ignore */ }
  return key;
}

export function registerAiHandlers(): void {
  registerHandler('get-openai-key', async () => getOpenaiApiKey());

  registerHandler('ai:analyzeMessages', async (_event, ids: string[]) => {
    safeLog.log('[AI:Analyze] Stub handler called for', ids?.length || 0, 'messages');
    return { success: false, error: 'Analysis not available' };
  });

  registerHandler('ai:createDetectedTask', async (_event, task: { title: string; description?: string }) => {
    try {
      const args = ['task-add', task.title || ''];
      if (task.description) args.push('--desc', task.description);
      const result = await new Promise<string>((resolve, reject) => {
        execFile(FROGGO_DB_CLI, args, { timeout: 5000, env: { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH}` } }, (error, stdout, stderr) => {
          if (error) { safeLog.error('[AI:Task] Error:', error.message, stderr); reject(error); } else resolve(stdout);
        });
      });
      safeLog.log('[AI:Task] Created task:', task.title, result.trim());
      return { success: true, result: result.trim() };
    } catch (e: any) { safeLog.error('[AI:Task] Error:', e); return { success: false, error: e.message }; }
  });

  registerHandler('ai:createDetectedEvent', async (_event, event: { title: string; date: string; time?: string; duration?: string; location?: string; description?: string }) => {
    try {
      const start = event.time ? `${event.date}T${event.time}` : `${event.date}T09:00:00`;
      const startDate = new Date(start);
      const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
      const args = ['calendar', 'create', '--title', event.title || '', '--start', start, '--end', endDate.toISOString()];
      if (event.location) args.push('--location', event.location);
      const result = await new Promise<string>((resolve, reject) => {
        execFile('/opt/homebrew/bin/gog', args, { timeout: 10000, env: { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH}` } }, (error, stdout, stderr) => {
          if (error) { safeLog.error('[AI:Event] Error:', error.message, stderr); reject(error); } else resolve(stdout);
        });
      });
      safeLog.log('[AI:Event] Created event:', event.title, result.trim());
      return { success: true, result: result.trim() };
    } catch (e: any) { safeLog.error('[AI:Event] Error:', e); return { success: false, error: e.message }; }
  });

  registerHandler('ai:generate-content', async (_event, prompt: string, type: string, options?: { agent?: string }) => {
    safeLog.log('[AI:Generate] Called with type:', type, 'agent:', options?.agent || 'default');
    try {
      const agentId = options?.agent || 'social-manager';
      let fullPrompt: string;
      if (type === 'ideas') {
        fullPrompt = `Generate 5 engaging X/Twitter content ideas about: ${prompt}\n\nFor each idea, provide:\n1. The main idea/angle\n2. A compelling hook/opening line\n\nReturn as JSON array: [{ "idea": "...", "hook": "..." }]`;
      } else { fullPrompt = prompt; }
      const response = await new Promise<string>((resolve, reject) => {
        execFile(OPENCLAW, ['agent', '--agent', agentId, '--message', fullPrompt, '--json'], { encoding: 'utf-8', timeout: 60000, env: { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH}` } }, (error, stdout) => {
          if (error) { safeLog.error('[AI:Generate] CLI error:', error.message); reject(error); return; }
          let output = stdout.trim();
          try { const parsed = JSON.parse(output); const payloads = parsed?.result?.payloads; if (Array.isArray(payloads) && payloads.length > 0) output = payloads.map((p: any) => p.text || '').join('\n').trim(); if (!output && parsed?.result?.text) output = parsed.result.text; } catch { /* not JSON */ }
          resolve(output);
        });
      });
      if (type === 'ideas') {
        try {
          const jsonMatch = response.match(/\[[\s\S]*\]/);
          if (jsonMatch) return { success: true, ideas: JSON.parse(jsonMatch[0]) };
          else return { success: true, ideas: [{ idea: response, hook: '' }] };
        } catch { return { success: true, ideas: [{ idea: response, hook: '' }] }; }
      } else { return { success: true, response }; }
    } catch (e: any) { safeLog.error('[AI:Generate] Error:', e); return { success: false, error: e.message }; }
  });

  registerHandler('ai:generateReply', async (_event, context: { threadMessages: Array<{ role: string; content: string }>; platform?: string; recipientName?: string; subject?: string; tone?: 'formal' | 'casual' | 'auto'; calendarContext?: string; taskContext?: string }) => {
    safeLog.log('[AI] Generate reply called:', { platform: context.platform, tone: context.tone, threadLen: context.threadMessages?.length });
    const anthropicApiKey = getAnthropicApiKey();
    if (!anthropicApiKey) return { success: false, error: 'No API key configured' };
    const tone = context.tone || 'auto';
    const platform = context.platform || 'chat';
    const name = context.recipientName || 'there';
    let toneInstruction = tone === 'formal' ? 'Use a professional, formal tone. Include proper greetings and sign-offs.' : tone === 'casual' ? 'Use a friendly, casual tone. Keep it conversational.' : 'Match the tone of the conversation.';
    let platformInstruction = '';
    if (platform === 'email') platformInstruction = 'This is an email reply. Use appropriate email formatting with greeting and sign-off.';
    else if (platform === 'whatsapp' || platform === 'telegram') platformInstruction = 'This is a chat message. Keep it short and conversational.';
    else if (platform === 'discord') platformInstruction = 'This is a Discord message. Keep it concise and natural.';
    let scheduleContext = context.calendarContext || '';
    let taskCtx = context.taskContext || '';
    if (!scheduleContext) { try { const events = prepare("SELECT title, start_time FROM calendar_events WHERE start_time > datetime('now') ORDER BY start_time LIMIT 5").all() as any[]; scheduleContext = events.map((e: any) => `${e.title} at ${e.start_time}`).join('; '); } catch { /* ignore */ } }
    if (!taskCtx) { try { const tasks = prepare("SELECT title FROM tasks WHERE status='in-progress' AND (cancelled IS NULL OR cancelled=0) LIMIT 5").all() as any[]; taskCtx = tasks.map((t: any) => t.title).join('; '); } catch { /* ignore */ } }
    let contextBlock = '';
    if (scheduleContext) contextBlock += `\nUser's upcoming schedule: ${scheduleContext}`;
    if (taskCtx) contextBlock += `\nUser's active tasks: ${taskCtx}`;
    const systemPrompt = `You are drafting a reply on behalf of the user. Generate a helpful, contextual reply to the conversation below.\n\n${toneInstruction}\n${platformInstruction}${contextBlock}\n\nRules:\n- Be concise and to the point\n- Sound natural, not robotic\n- Don't be overly eager or sycophantic\n- Address the actual content of the messages\n- Return ONLY the reply text, no explanations or meta-commentary`;
    const threadText = context.threadMessages.slice(-10).map(m => `${m.role}: ${m.content}`).join('\n');
    const userPrompt = `Conversation with ${name}${context.subject ? ` (Subject: ${context.subject})` : ''}:\n\n${threadText}\n\nDraft a reply:`;
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicApiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 512, system: systemPrompt, messages: [{ role: 'user', content: userPrompt }] }),
      });
      if (!response.ok) { const errText = await response.text(); safeLog.error('[AI] Reply generation API error:', response.status, errText); return { success: false, error: `API error: ${response.status}` }; }
      const data = await response.json();
      const draft = data.content?.[0]?.text?.trim() || '';
      safeLog.log('[AI] Reply generated, length:', draft.length);
      return { success: true, draft };
    } catch (e: any) { safeLog.error('[AI] Reply generation error:', e.message); return { success: false, error: e.message }; }
  });

  registerHandler('ai:getAnalysis', async (_event, id: string, platform: string) => {
    try {
      const row = prepare("SELECT triage, summary, tasks, events, reply_draft, reply_needed FROM comms_ai_analysis WHERE external_id = ? AND platform = ?").get(id, platform) as any;
      if (!row) return { success: true, analysis: null };
      let tasks: any[] = []; let events: any[] = [];
      try { tasks = row.tasks ? JSON.parse(row.tasks) : []; } catch { /* ignore */ }
      try { events = row.events ? JSON.parse(row.events) : []; } catch { /* ignore */ }
      return { success: true, analysis: { triage: row.triage, summary: row.summary, tasks, events, reply_draft: row.reply_draft, reply_needed: !!row.reply_needed } };
    } catch (e: any) { return { success: false, error: e.message }; }
  });
}
