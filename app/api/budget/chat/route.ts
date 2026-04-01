// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// POST /api/budget/chat — Finance Agent powered by Gemini with full budget context
// GET  /api/budget/chat — fetch chat history
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { geminiPost } from '@/lib/geminiClient';

export const dynamic = 'force-dynamic';

const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_FALLBACK = 'gemini-2.0-flash';

async function getGeminiKey(): Promise<string | null> {
  try {
    const { keychainGet } = await import('@/lib/keychain');
    const val = await keychainGet('gemini_api_key');
    if (val) return val;
  } catch { /* ignore */ }
  const db = getDb();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('gemini_api_key') as { value: string } | undefined;
  return row?.value || process.env.GEMINI_API_KEY || null;
}

function buildBudgetContext(db: ReturnType<typeof getDb>): string {
  try {
    const quarters = db.prepare(`SELECT * FROM budget_quarters ORDER BY year DESC, quarter DESC`).all() as any[];
    const categories = db.prepare(`SELECT * FROM budget_categories`).all() as any[];
    const invoices = db.prepare(`
      SELECT i.*, c.name as category_name
      FROM budget_invoices i
      LEFT JOIN budget_categories c ON c.id = i.category_id
      ORDER BY i.date DESC LIMIT 300
    `).all() as any[];

    const lines: string[] = ['=== CURRENT BUDGET DATA ===\n'];

    for (const q of quarters) {
      const qInvoices = invoices.filter((i: any) => i.quarter_id === q.id);
      const actual = qInvoices.filter((i: any) => i.status !== 'cancelled').reduce((s: number, i: any) => s + i.amount, 0);
      const paid = qInvoices.filter((i: any) => i.status === 'paid').reduce((s: number, i: any) => s + i.amount, 0);
      const pending = qInvoices.filter((i: any) => i.status === 'pending').reduce((s: number, i: any) => s + i.amount, 0);
      const remaining = q.total_budget - actual;
      const pct = q.total_budget > 0 ? Math.round((actual / q.total_budget) * 100) : 0;

      lines.push(`\n--- ${q.name} (Q${q.quarter} ${q.year}) [${q.status}] ---`);
      lines.push(`Total Budget: ${q.currency} ${q.total_budget.toLocaleString()}`);
      lines.push(`Actual Spend: ${q.currency} ${actual.toLocaleString()} (${pct}% of budget)`);
      lines.push(`Paid: ${q.currency} ${paid.toLocaleString()} | Pending: ${q.currency} ${pending.toLocaleString()}`);
      lines.push(`Remaining: ${q.currency} ${remaining.toLocaleString()}`);

      const qCats = categories.filter((c: any) => c.quarter_id === q.id);
      if (qCats.length > 0) {
        lines.push(`\nCategories:`);
        for (const cat of qCats) {
          const catInvoices = qInvoices.filter((i: any) => i.category_id === cat.id && i.status !== 'cancelled');
          const catActual = catInvoices.reduce((s: number, i: any) => s + i.amount, 0);
          const catPct = cat.planned > 0 ? Math.round((catActual / cat.planned) * 100) : 0;
          lines.push(`  • ${cat.name}: planned ${q.currency} ${cat.planned.toLocaleString()} | actual ${q.currency} ${catActual.toLocaleString()} (${catPct}%) | ${catInvoices.length} invoices`);
        }
      }

      if (qInvoices.length > 0) {
        lines.push(`\nRecent Invoices:`);
        for (const inv of qInvoices.slice(0, 10)) {
          const d = new Date(inv.date).toLocaleDateString();
          lines.push(`  • [${inv.status}] ${inv.title} — ${q.currency} ${inv.amount.toLocaleString()} | ${inv.vendor || 'no vendor'} | ${inv.category_name || 'uncategorized'} | ${d}`);
        }
        if (qInvoices.length > 10) lines.push(`  ... and ${qInvoices.length - 10} more invoices`);
      }
    }

    lines.push('\n=== END BUDGET DATA ===');
    return lines.join('\n');
  } catch (err) {
    return `[Could not load budget data: ${err}]`;
  }
}

async function geminiChat(
  messages: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>,
  apiKey: string
): Promise<string | null> {
  for (const model of [GEMINI_MODEL, GEMINI_FALLBACK]) {
    try {
      const res = await geminiPost(model, apiKey, {
        contents: messages,
        generationConfig: { maxOutputTokens: 4096, temperature: 0.4 },
        systemInstruction: {
          parts: [{ text: `You are the Finance Agent for this Mission Control platform. You have full read access to all budget data, invoices, quarters, and categories. Be concise, precise, and helpful. When answering financial questions, cite specific numbers from the data. Format currency clearly. If you notice overspend, low runway, or budget risk — proactively flag it. You can do calculations, trend analysis, and give recommendations. Never make up numbers — only use data provided to you.` }]
        },
      });
      if (!res.ok) {
        if (model === GEMINI_MODEL) continue;
        return null;
      }
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
    } catch {
      if (model === GEMINI_MODEL) continue;
      return null;
    }
  }
  return null;
}

export async function GET() {
  try {
    const db = getDb();
    const messages = db.prepare(
      `SELECT id, role, content, created_at FROM budget_chat_messages ORDER BY created_at ASC LIMIT 200`
    ).all();
    return NextResponse.json({ ok: true, messages });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const db = getDb();
    const { message, history = [] } = await req.json();
    if (!message?.trim()) return NextResponse.json({ error: 'message required' }, { status: 400 });

    const apiKey = await getGeminiKey();
    if (!apiKey) return NextResponse.json({ error: 'Gemini API key not configured. Add it in Settings.' }, { status: 400 });

    // Build budget context
    const budgetContext = buildBudgetContext(db);

    // Build message array for Gemini (include budget context in first user message)
    const geminiMessages: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

    // Inject budget data as first turn if no history
    if (history.length === 0) {
      geminiMessages.push({
        role: 'user',
        parts: [{ text: `${budgetContext}\n\nI'll now ask you questions about this budget data.` }],
      });
      geminiMessages.push({
        role: 'model',
        parts: [{ text: `Understood. I have full visibility into your budget data — quarters, categories, invoices, and spend metrics. What would you like to know?` }],
      });
    } else {
      // Re-inject context with latest data at start
      geminiMessages.push({
        role: 'user',
        parts: [{ text: `Here is the current budget data (refreshed):\n${budgetContext}` }],
      });
      geminiMessages.push({
        role: 'model',
        parts: [{ text: `Budget data received and loaded.` }],
      });
    }

    // Add conversation history
    for (const msg of history.slice(-20)) {
      geminiMessages.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      });
    }

    // Add the new user message
    geminiMessages.push({ role: 'user', parts: [{ text: message }] });

    const reply = await geminiChat(geminiMessages, apiKey);
    if (!reply) return NextResponse.json({ error: 'No response from AI' }, { status: 500 });

    // Persist both messages
    const now = Date.now();
    db.prepare(`INSERT INTO budget_chat_messages (role, content, created_at) VALUES (?, ?, ?)`).run('user', message, now);
    db.prepare(`INSERT INTO budget_chat_messages (role, content, created_at) VALUES (?, ?, ?)`).run('assistant', reply, now + 1);

    return NextResponse.json({ ok: true, reply });
  } catch (err) {
    console.error('[budget/chat]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const db = getDb();
    db.prepare(`DELETE FROM budget_chat_messages`).run();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
