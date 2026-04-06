// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// POST /api/budget/upload — upload invoice file (PDF, image) and attach to invoice
// GET  /api/budget/upload?id= — serve the file
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import path from 'path';
import fs from 'fs';
import os from 'os';

export const dynamic = 'force-dynamic';

const BUDGET_FILES_DIR = path.join(os.homedir(), 'mission-control', 'library', 'budget-files');

function ensureDir() {
  if (!fs.existsSync(BUDGET_FILES_DIR)) {
    fs.mkdirSync(BUDGET_FILES_DIR, { recursive: true });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const invoiceId = searchParams.get('id');
  if (!invoiceId) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const db = getDb();
  const inv = db.prepare(`SELECT file_path, file_name, file_mime FROM budget_invoices WHERE id = ?`).get(invoiceId) as any;

  if (!inv?.file_path || !fs.existsSync(inv.file_path)) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  const bytes = fs.readFileSync(inv.file_path);
  return new NextResponse(bytes, {
    headers: {
      'Content-Type': inv.file_mime || 'application/octet-stream',
      'Content-Disposition': `inline; filename="${inv.file_name || 'invoice'}"`,
      'Cache-Control': 'private, max-age=3600',
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    ensureDir();
    const db = getDb();

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const invoiceId = formData.get('invoice_id') as string | null;

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    if (!invoiceId) return NextResponse.json({ error: 'invoice_id required' }, { status: 400 });

    // Validate MIME type
    const allowedMimes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedMimes.includes(file.type)) {
      return NextResponse.json({ error: 'Only PDF and image files are allowed' }, { status: 400 });
    }

    // Sanitize filename
    const ext = path.extname(file.name).toLowerCase() || '.pdf';
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileName = `${invoiceId}_${Date.now()}${ext}`;
    const filePath = path.join(BUDGET_FILES_DIR, fileName);

    // Write to disk
    const bytes = await file.arrayBuffer();
    fs.writeFileSync(filePath, Buffer.from(bytes));

    // Update invoice record
    db.prepare(`
      UPDATE budget_invoices
      SET file_path = ?, file_name = ?, file_mime = ?, updated_at = ?
      WHERE id = ?
    `).run(filePath, safeName, file.type, Date.now(), invoiceId);

    return NextResponse.json({
      ok: true,
      file_path: filePath,
      file_name: safeName,
      file_mime: file.type,
      size: bytes.byteLength,
    });
  } catch (err) {
    console.error('[budget/upload]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(req.url);
    const invoiceId = searchParams.get('id');
    if (!invoiceId) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const inv = db.prepare(`SELECT file_path FROM budget_invoices WHERE id = ?`).get(invoiceId) as any;
    if (inv?.file_path && fs.existsSync(inv.file_path)) {
      fs.unlinkSync(inv.file_path);
    }
    db.prepare(`UPDATE budget_invoices SET file_path = NULL, file_name = NULL, file_mime = NULL, updated_at = ? WHERE id = ?`)
      .run(Date.now(), invoiceId);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
