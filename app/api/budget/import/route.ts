// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// POST /api/budget/import — Excel/XLSX → AI-parsed budget preview
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import * as XLSX from 'xlsx';
import { geminiPost } from '@/lib/geminiClient';

export const dynamic = 'force-dynamic';

const PALETTE = [
  '#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6',
  '#8b5cf6', '#ef4444', '#14b8a6', '#f97316', '#84cc16',
  '#06b6d4', '#e11d48',
];

async function getGeminiKey(): Promise<string | null> {
  try {
    const { keychainGet } = await import('@/lib/keychain');
    const val = await keychainGet('gemini_api_key');
    if (val) return val;
  } catch (err) {
    console.warn('[budget/import] Keychain lookup for gemini_api_key failed:', err);
  }
  const db = getDb();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('gemini_api_key') as { value: string } | undefined;
  return row?.value || process.env.GEMINI_API_KEY || null;
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = await getGeminiKey();
    if (!apiKey) return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 400 });

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
    ];
    if (!allowed.includes(file.type) && !file.name.match(/\.(xlsx|xls|csv)$/i)) {
      return NextResponse.json({ error: 'Only Excel (.xlsx, .xls) or CSV files supported' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const workbook = XLSX.read(bytes);

    // Extract first 30 rows from each sheet
    const sheetsContext = workbook.SheetNames.map(name => {
      const sheet = workbook.Sheets[name];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
      return `=== Sheet: ${name} ===\n${JSON.stringify(rows.slice(0, 30))}`;
    }).join('\n\n');

    const prompt = `Analyze this marketing budget spreadsheet. Extract the budget for tracking purposes.

IMPORTANT:
- Look for TOP-LEVEL categories only (ignore subcategories with ├── prefix or indented rows)
- Extract PLANNED/BUDGET amounts (not actuals/spent)
- Identify the year from the data
- If there's monthly data, sum it into quarterly totals

Return JSON with this EXACT structure:
{
  "year": 2026,
  "totalBudget": 940000,
  "categories": [
    { "name": "Category Name", "planned": 50000, "q1": 15000, "q2": 15000, "q3": 10000, "q4": 10000 }
  ]
}

For quarterly splits:
- Q1: Jan-Mar
- Q2: Apr-Jun
- Q3: Jul-Sep
- Q4: Oct-Dec

If monthly breakdown exists, use it. Otherwise estimate even splits.
Only include main budget categories, not line-item details.

Spreadsheet data:
${sheetsContext}

Return ONLY the JSON object.`;

    const geminiRes = await geminiPost('gemini-2.0-flash', apiKey, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
    });

    if (!geminiRes.ok) {
      return NextResponse.json({ error: 'AI analysis failed' }, { status: 500 });
    }

    const geminiData = await geminiRes.json();
    const text: string = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return NextResponse.json({ error: 'Could not parse AI response' }, { status: 500 });

    const parsed = JSON.parse(match[0]);
    const year = parsed.year || new Date().getFullYear();

    const makeCategories = (key: 'q1' | 'q2' | 'q3' | 'q4' | null) =>
      (parsed.categories || [])
        .map((cat: any, i: number) => ({
          name: cat.name,
          planned: key ? (cat[key] || Math.round((cat.planned || 0) / 4)) : (cat.planned || 0),
          color: PALETTE[i % PALETTE.length],
        }))
        .filter((c: any) => c.planned > 0);

    const preview = {
      year,
      totalBudget: parsed.totalBudget || 0,
      quarterlyView: [
        { name: `Q1 ${year}`, startDate: `${year}-01-01`, endDate: `${year}-03-31`, categories: makeCategories('q1') },
        { name: `Q2 ${year}`, startDate: `${year}-04-01`, endDate: `${year}-06-30`, categories: makeCategories('q2') },
        { name: `Q3 ${year}`, startDate: `${year}-07-01`, endDate: `${year}-09-30`, categories: makeCategories('q3') },
        { name: `Q4 ${year}`, startDate: `${year}-10-01`, endDate: `${year}-12-31`, categories: makeCategories('q4') },
      ].filter(q => q.categories.length > 0),
      annualView: [
        { name: `FY ${year}`, startDate: `${year}-01-01`, endDate: `${year}-12-31`, categories: makeCategories(null) },
      ],
    };

    return NextResponse.json({ ok: true, preview });
  } catch (err) {
    console.error('[budget/import]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
