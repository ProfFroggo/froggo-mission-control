// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// GET/POST/PATCH/DELETE /api/budget — unified budget module API
// Handles quarters, categories, and invoices via ?resource= param
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

// ── helpers ──────────────────────────────────────────────────────────────────

function quarterStats(db: ReturnType<typeof getDb>, quarterId: string) {
  const invoices = db.prepare(
    `SELECT category_id, amount, status FROM budget_invoices WHERE quarter_id = ? AND status != 'cancelled'`
  ).all(quarterId) as Array<{ category_id: string | null; amount: number; status: string }>;

  const actual = invoices.reduce((s, i) => s + i.amount, 0);
  const paid = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0);
  const pending = invoices.filter(i => i.status === 'pending').reduce((s, i) => s + i.amount, 0);

  return { actual, paid, pending, invoice_count: invoices.length };
}

function categoryStats(db: ReturnType<typeof getDb>, categoryId: string) {
  const rows = db.prepare(
    `SELECT amount, status FROM budget_invoices WHERE category_id = ? AND status != 'cancelled'`
  ).all(categoryId) as Array<{ amount: number; status: string }>;
  const actual = rows.reduce((s, r) => s + r.amount, 0);
  return { actual, invoice_count: rows.length };
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(req.url);
    const resource = searchParams.get('resource') || 'quarters';

    if (resource === 'quarters') {
      const quarters = db.prepare(
        `SELECT * FROM budget_quarters ORDER BY year DESC, quarter DESC`
      ).all() as any[];
      const enriched = quarters.map(q => ({ ...q, ...quarterStats(db, q.id) }));
      return NextResponse.json({ success: true, quarters: enriched });
    }

    if (resource === 'categories') {
      const quarterId = searchParams.get('quarter_id');
      const rows = quarterId
        ? db.prepare(`SELECT * FROM budget_categories WHERE quarter_id = ? ORDER BY name`).all(quarterId) as any[]
        : db.prepare(`SELECT * FROM budget_categories ORDER BY name`).all() as any[];
      const enriched = rows.map(c => ({
        ...c,
        tags: (() => { try { return JSON.parse(c.tags || '[]'); } catch { return []; } })(),
        ...categoryStats(db, c.id),
      }));
      return NextResponse.json({ success: true, categories: enriched });
    }

    if (resource === 'invoices') {
      const quarterId = searchParams.get('quarter_id');
      const categoryId = searchParams.get('category_id');
      const status = searchParams.get('status');
      const limit = parseInt(searchParams.get('limit') || '200');

      const conds: string[] = [];
      const vals: unknown[] = [];
      if (quarterId) { conds.push('i.quarter_id = ?'); vals.push(quarterId); }
      if (categoryId) { conds.push('i.category_id = ?'); vals.push(categoryId); }
      if (status) { conds.push('i.status = ?'); vals.push(status); }

      const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
      const invoices = db.prepare(
        `SELECT i.*, c.name as category_name, c.color as category_color
         FROM budget_invoices i
         LEFT JOIN budget_categories c ON c.id = i.category_id
         ${where}
         ORDER BY i.date DESC LIMIT ?`
      ).all(...vals, limit);
      return NextResponse.json({ success: true, invoices });
    }

    if (resource === 'overall') {
      // Lifetime totals across all quarters
      const totals = db.prepare(`
        SELECT
          COUNT(DISTINCT q.id) as quarter_count,
          SUM(q.total_budget) as total_planned,
          COUNT(i.id) as invoice_count,
          SUM(CASE WHEN i.status != 'cancelled' THEN i.amount ELSE 0 END) as total_actual,
          SUM(CASE WHEN i.status = 'paid' THEN i.amount ELSE 0 END) as total_paid,
          SUM(CASE WHEN i.status = 'pending' THEN i.amount ELSE 0 END) as total_pending
        FROM budget_quarters q
        LEFT JOIN budget_invoices i ON i.quarter_id = q.id
      `).get() as any;
      return NextResponse.json({ success: true, totals });
    }

    if (resource === 'summary') {
      // Full summary for AI context
      const quarters = db.prepare(`SELECT * FROM budget_quarters ORDER BY year DESC, quarter DESC`).all() as any[];
      const categories = db.prepare(`SELECT * FROM budget_categories`).all() as any[];
      const invoices = db.prepare(
        `SELECT id, title, amount, currency, status, date, vendor, category_id, quarter_id
         FROM budget_invoices ORDER BY date DESC LIMIT 500`
      ).all() as any[];

      const qSummary = quarters.map(q => {
        const stats = quarterStats(db, q.id);
        const cats = categories
          .filter((c: any) => c.quarter_id === q.id)
          .map((c: any) => {
            const cs = categoryStats(db, c.id);
            return { name: c.name, planned: c.planned, actual: cs.actual, invoices: cs.invoice_count };
          });
        return {
          id: q.id, name: q.name, year: q.year, quarter: q.quarter,
          status: q.status, total_budget: q.total_budget, currency: q.currency,
          ...stats, categories: cats,
        };
      });

      return NextResponse.json({ success: true, summary: qSummary, invoice_count: invoices.length, invoices });
    }

    return NextResponse.json({ error: 'Unknown resource' }, { status: 400 });
  } catch (err) {
    console.error('[budget GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const db = getDb();
    const body = await req.json();
    const { resource } = body;

    if (resource === 'quarter') {
      const { name, year, quarter, start_date, end_date, total_budget, currency = 'USD', status = 'active', notes } = body;
      if (!name || !year || !quarter || !start_date || !end_date) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
      }
      const id = `bq-${randomUUID().slice(0, 8)}`;
      db.prepare(`
        INSERT INTO budget_quarters (id, name, year, quarter, start_date, end_date, total_budget, currency, status, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, name, year, quarter, start_date, end_date, total_budget || 0, currency, status, notes || null);
      const row = db.prepare(`SELECT * FROM budget_quarters WHERE id = ?`).get(id);
      return NextResponse.json({ success: true, quarter: row }, { status: 201 });
    }

    if (resource === 'category') {
      const { quarter_id, name, planned, color = '#6366f1', notes, cac, tags } = body;
      if (!quarter_id || !name) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
      const id = `bc-${randomUUID().slice(0, 8)}`;
      const tagsJson = JSON.stringify(Array.isArray(tags) ? tags : []);
      db.prepare(`
        INSERT INTO budget_categories (id, quarter_id, name, planned, color, notes, cac, tags)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, quarter_id, name, planned || 0, color, notes || null, cac || 0, tagsJson);
      const row = db.prepare(`SELECT * FROM budget_categories WHERE id = ?`).get(id) as any;
      return NextResponse.json({ success: true, category: { ...row, tags: tags || [], ...categoryStats(db, id) } }, { status: 201 });
    }

    if (resource === 'invoice') {
      const {
        quarter_id, category_id, invoice_number, title, description,
        amount, currency = 'USD', date, vendor, status = 'pending',
        tx_hash, tx_chain, notes,
      } = body;
      if (!quarter_id || !title || amount == null || !date) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
      }

      // Duplicate detection
      if (invoice_number) {
        const dup = db.prepare(`SELECT id FROM budget_invoices WHERE invoice_number = ? AND quarter_id = ?`).get(invoice_number, quarter_id);
        if (dup) return NextResponse.json({ error: 'duplicate', message: `Invoice #${invoice_number} already exists in this quarter` }, { status: 409 });
      } else if (amount && date && vendor) {
        const dup = db.prepare(`SELECT id FROM budget_invoices WHERE amount = ? AND date = ? AND vendor = ? AND quarter_id = ?`).get(amount, date, vendor, quarter_id);
        if (dup) return NextResponse.json({ error: 'duplicate', message: `Invoice with same amount, date and vendor already exists` }, { status: 409 });
      }

      const id = `bi-${randomUUID().slice(0, 8)}`;
      db.prepare(`
        INSERT INTO budget_invoices
          (id, quarter_id, category_id, invoice_number, title, description,
           amount, currency, date, vendor, status, tx_hash, tx_chain, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, quarter_id, category_id || null, invoice_number || null, title,
        description || null, amount, currency, date, vendor || null,
        status, tx_hash || null, tx_chain || null, notes || null,
      );
      const row = db.prepare(`
        SELECT i.*, c.name as category_name, c.color as category_color
        FROM budget_invoices i LEFT JOIN budget_categories c ON c.id = i.category_id
        WHERE i.id = ?`).get(id);
      return NextResponse.json({ success: true, invoice: row }, { status: 201 });
    }

    // Bulk invoice operations
    if (resource === 'bulk-invoices') {
      const { action, ids, status: newStatus } = body;
      if (!Array.isArray(ids) || ids.length === 0) return NextResponse.json({ error: 'ids required' }, { status: 400 });
      const placeholders = ids.map(() => '?').join(',');

      if (action === 'delete') {
        // Delete files first
        const rows = db.prepare(`SELECT file_path FROM budget_invoices WHERE id IN (${placeholders})`).all(...ids) as any[];
        for (const row of rows) {
          if (row?.file_path) {
            try { require('fs').unlinkSync(row.file_path); } catch (err) { console.warn('[budget] Non-critical: failed to delete invoice file:', err); }
          }
        }
        db.prepare(`DELETE FROM budget_invoices WHERE id IN (${placeholders})`).run(...ids);
        return NextResponse.json({ success: true, deleted: ids.length });
      }

      if (action === 'status' && newStatus) {
        db.prepare(`UPDATE budget_invoices SET status = ?, updated_at = ? WHERE id IN (${placeholders})`).run(newStatus, Date.now(), ...ids);
        return NextResponse.json({ success: true, updated: ids.length });
      }

      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    return NextResponse.json({ error: 'Unknown resource' }, { status: 400 });
  } catch (err) {
    console.error('[budget POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ── PATCH ─────────────────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  try {
    const db = getDb();
    const body = await req.json();
    const { resource, id, ...updates } = body;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const now = Date.now();

    if (resource === 'quarter') {
      const allowed = ['name', 'year', 'quarter', 'start_date', 'end_date', 'total_budget', 'currency', 'status', 'notes'];
      const sets = Object.keys(updates).filter(k => allowed.includes(k)).map(k => `${k} = ?`);
      const vals = Object.keys(updates).filter(k => allowed.includes(k)).map(k => updates[k]);
      if (!sets.length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
      db.prepare(`UPDATE budget_quarters SET ${sets.join(', ')}, updated_at = ? WHERE id = ?`).run(...vals, now, id);
      const row = db.prepare(`SELECT * FROM budget_quarters WHERE id = ?`).get(id) as any;
      return NextResponse.json({ success: true, quarter: { ...row, ...quarterStats(db, id) } });
    }

    if (resource === 'category') {
      const allowed = ['name', 'planned', 'color', 'notes', 'cac'];
      const setKeys = Object.keys(updates).filter(k => allowed.includes(k));
      const sets = setKeys.map(k => `${k} = ?`);
      const vals = setKeys.map(k => updates[k]);
      // Handle tags separately (serialize to JSON)
      if ('tags' in updates) {
        sets.push('tags = ?');
        vals.push(JSON.stringify(Array.isArray(updates.tags) ? updates.tags : []));
      }
      if (!sets.length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
      db.prepare(`UPDATE budget_categories SET ${sets.join(', ')}, updated_at = ? WHERE id = ?`).run(...vals, now, id);
      const row = db.prepare(`SELECT * FROM budget_categories WHERE id = ?`).get(id) as any;
      const parsedTags = (() => { try { return JSON.parse(row.tags || '[]'); } catch { return []; } })();
      return NextResponse.json({ success: true, category: { ...row, tags: parsedTags, ...categoryStats(db, id) } });
    }

    if (resource === 'invoice') {
      const allowed = ['category_id', 'invoice_number', 'title', 'description', 'amount', 'currency', 'date', 'vendor', 'status', 'file_path', 'file_name', 'file_mime', 'tx_hash', 'tx_chain', 'notes'];
      const sets = Object.keys(updates).filter(k => allowed.includes(k)).map(k => `${k} = ?`);
      const vals = Object.keys(updates).filter(k => allowed.includes(k)).map(k => updates[k]);
      if (!sets.length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
      db.prepare(`UPDATE budget_invoices SET ${sets.join(', ')}, updated_at = ? WHERE id = ?`).run(...vals, now, id);
      const row = db.prepare(`
        SELECT i.*, c.name as category_name, c.color as category_color
        FROM budget_invoices i LEFT JOIN budget_categories c ON c.id = i.category_id
        WHERE i.id = ?`).get(id);
      return NextResponse.json({ success: true, invoice: row });
    }

    return NextResponse.json({ error: 'Unknown resource' }, { status: 400 });
  } catch (err) {
    console.error('[budget PATCH]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ── DELETE ────────────────────────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(req.url);
    const resource = searchParams.get('resource');
    const id = searchParams.get('id');
    if (!resource || !id) return NextResponse.json({ error: 'resource and id required' }, { status: 400 });

    if (resource === 'quarter') {
      db.prepare(`DELETE FROM budget_quarters WHERE id = ?`).run(id);
    } else if (resource === 'category') {
      db.prepare(`DELETE FROM budget_categories WHERE id = ?`).run(id);
    } else if (resource === 'invoice') {
      const inv = db.prepare(`SELECT file_path FROM budget_invoices WHERE id = ?`).get(id) as any;
      if (inv?.file_path) {
        try { require('fs').unlinkSync(inv.file_path); } catch (err) { console.warn('[budget] Non-critical: failed to delete invoice file:', err); }
      }
      db.prepare(`DELETE FROM budget_invoices WHERE id = ?`).run(id);
    } else {
      return NextResponse.json({ error: 'Unknown resource' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[budget DELETE]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
