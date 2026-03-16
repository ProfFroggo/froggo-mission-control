// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { validateAgentId } from '@/lib/validateId';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

type ReviewRow = {
  id: number;
  moduleId: string;
  rating: number;
  review: string | null;
  reviewedBy: string;
  createdAt: number;
};

// GET /api/catalog/modules/[id]/reviews — list reviews and average rating
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const guard = validateAgentId(id);
    if (guard) return guard;

    const db = getDb();

    const reviews = db.prepare(
      'SELECT * FROM module_reviews WHERE moduleId = ? ORDER BY createdAt DESC'
    ).all(id) as ReviewRow[];

    const avgRow = db.prepare(
      'SELECT AVG(rating) as avg, COUNT(*) as count FROM module_reviews WHERE moduleId = ?'
    ).get(id) as { avg: number | null; count: number };

    return NextResponse.json({
      reviews: reviews.map(r => ({
        id: r.id,
        moduleId: r.moduleId,
        rating: r.rating,
        review: r.review,
        reviewedBy: r.reviewedBy,
        createdAt: r.createdAt,
      })),
      averageRating: avgRow.avg ? Math.round(avgRow.avg * 10) / 10 : null,
      reviewCount: avgRow.count,
    });
  } catch (error) {
    console.error('GET /api/catalog/modules/[id]/reviews error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/catalog/modules/[id]/reviews — submit a rating + review
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const guard = validateAgentId(id);
    if (guard) return guard;

    const body = await req.json();
    const rating = Number(body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'rating must be an integer between 1 and 5' }, { status: 400 });
    }

    const db = getDb();

    // Verify module exists
    const module = db.prepare('SELECT id FROM catalog_modules WHERE id = ?').get(id);
    if (!module) {
      return NextResponse.json({ error: 'Module not found' }, { status: 404 });
    }

    const result = db.prepare(
      'INSERT INTO module_reviews (moduleId, rating, review, reviewedBy, createdAt) VALUES (?, ?, ?, ?, ?)'
    ).run(id, rating, body.review ?? null, body.reviewedBy ?? 'user', Date.now());

    const inserted = db.prepare('SELECT * FROM module_reviews WHERE id = ?').get(result.lastInsertRowid) as ReviewRow;

    return NextResponse.json({
      id: inserted.id,
      moduleId: inserted.moduleId,
      rating: inserted.rating,
      review: inserted.review,
      reviewedBy: inserted.reviewedBy,
      createdAt: inserted.createdAt,
    }, { status: 201 });
  } catch (error) {
    console.error('POST /api/catalog/modules/[id]/reviews error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
