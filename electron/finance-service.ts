/**
 * Finance Service Module
 *
 * All finance:* IPC handlers extracted from main.ts.
 * - finance:getTransactions / getBudgetStatus / getAlerts / getInsights / dismissInsight
 * - finance:selectFile / uploadCSV / uploadPDF
 * - finance:createBudget / triggerAnalysis
 * - finance:account:* CRUD (list, create, update, archive, balances)
 *
 * The 5 financeAgent:* handlers remain in main.ts (they depend on the agent bridge singleton there).
 */

import { ipcMain, dialog, BrowserWindow } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import ExcelJS from 'exceljs';
import { prepare } from './database';
import { safeLog } from './logger';
import { getFinanceAgentBridge } from './finance-agent-bridge';

const execAsync = promisify(exec);

// ── Helpers ──

/** Get the first non-destroyed BrowserWindow (for sending events to renderer) */
function getMainWindow(): BrowserWindow | null {
  const wins = BrowserWindow.getAllWindows();
  for (const w of wins) {
    if (!w.isDestroyed()) return w;
  }
  return null;
}

// ── Schema Migration ──

/**
 * Ensure finance schema has multi-account support.
 * Idempotent — safe to run every startup.
 */
function ensureFinanceSchema(): void {
  // 1. Default account
  try {
    const existing = prepare(`SELECT id FROM finance_accounts WHERE id = ?`).get('acc-default');
    if (!existing) {
      const now = Date.now();
      prepare(
        `INSERT OR IGNORE INTO finance_accounts (id, name, type, currency, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
      ).run('acc-default', 'Default Account', 'bank', 'EUR', now, now);
      safeLog.log('[Finance] Created default account (acc-default)');
    }
  } catch (e: any) {
    safeLog.error('[Finance] ensureFinanceSchema default account error:', e.message);
  }

  // 2. archived column on finance_accounts
  try {
    prepare(`ALTER TABLE finance_accounts ADD COLUMN archived INTEGER DEFAULT 0`).run();
    safeLog.log('[Finance] Added archived column to finance_accounts');
  } catch (e: any) {
    if (!e.message.includes('duplicate column')) {
      safeLog.error('[Finance] ensureFinanceSchema archived column error:', e.message);
    }
  }

  // 3. account_id column on finance_budgets
  try {
    prepare(`ALTER TABLE finance_budgets ADD COLUMN account_id TEXT REFERENCES finance_accounts(id)`).run();
    safeLog.log('[Finance] Added account_id column to finance_budgets');
  } catch (e: any) {
    if (!e.message.includes('duplicate column')) {
      safeLog.error('[Finance] ensureFinanceSchema budget account_id error:', e.message);
    }
  }

  // 4. finance_recurring table for subscription/bill detection
  try {
    prepare(`CREATE TABLE IF NOT EXISTS finance_recurring (
      id TEXT PRIMARY KEY,
      account_id TEXT,
      description TEXT NOT NULL,
      normalized_merchant TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'EUR',
      frequency TEXT NOT NULL,
      confidence REAL NOT NULL,
      next_expected_date INTEGER,
      status TEXT DEFAULT 'pending',
      detected_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (account_id) REFERENCES finance_accounts(id)
    )`).run();
  } catch (e: any) {
    safeLog.error('[Finance] ensureFinanceSchema finance_recurring error:', e.message);
  }
}

// ── Recurring Detection ──

function normalizeDescription(desc: string): string {
  return desc
    .toLowerCase()
    .replace(/[0-9]+/g, '')        // strip numbers (invoice numbers, dates)
    .replace(/\s+/g, ' ')
    .replace(/[^a-z\s]/g, '')     // strip punctuation
    .trim()
    .substring(0, 40);            // cap length for grouping
}

function detectRecurring(accountId?: string): void {
  // Pull transactions from last 366 days (1 year window)
  const cutoff = Date.now() - 366 * 24 * 60 * 60 * 1000;
  const whereClause = accountId
    ? `WHERE account_id = ? AND date > ? AND amount < 0`
    : `WHERE date > ? AND amount < 0`;
  const params = accountId ? [accountId, cutoff] : [cutoff];

  const transactions = prepare(
    `SELECT id, account_id, date, description, amount, currency FROM finance_transactions ${whereClause} ORDER BY date ASC`
  ).all(...params) as Array<{ id: string; account_id: string; date: number; description: string; amount: number; currency: string }>;

  // Group by normalized_merchant + rounded_amount (round to nearest 0.50 to handle minor variations)
  const groups = new Map<string, typeof transactions>();
  for (const tx of transactions) {
    const merchant = normalizeDescription(tx.description);
    const roundedAmount = Math.round(tx.amount * 2) / 2; // round to nearest 0.50
    const key = `${merchant}::${roundedAmount}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(tx);
  }

  const now = Date.now();

  for (const [, txs] of groups.entries()) {
    if (txs.length < 2) continue; // need at least 2 occurrences

    // Calculate intervals between dates (in days)
    const dates = txs.map(t => t.date).sort((a, b) => a - b);
    const intervals: number[] = [];
    for (let i = 1; i < dates.length; i++) {
      intervals.push((dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24));
    }
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;

    // Classify frequency
    let frequency: string | null = null;
    let confidence = 0;

    if (avgInterval >= 5 && avgInterval <= 9) { frequency = 'weekly'; confidence = 0.9; }
    else if (avgInterval >= 12 && avgInterval <= 16) { frequency = 'biweekly'; confidence = 0.85; }
    else if (avgInterval >= 25 && avgInterval <= 35) { frequency = 'monthly'; confidence = 0.9; }
    else if (avgInterval >= 80 && avgInterval <= 100) { frequency = 'quarterly'; confidence = 0.8; }
    else if (avgInterval >= 340 && avgInterval <= 390) { frequency = 'annual'; confidence = 0.75; }

    if (!frequency) continue; // skip irregular patterns

    // Calculate variance to boost/reduce confidence
    if (intervals.length >= 2) {
      const variance = intervals.reduce((acc, v) => acc + Math.pow(v - avgInterval, 2), 0) / intervals.length;
      const stdDev = Math.sqrt(variance);
      const cv = stdDev / avgInterval; // coefficient of variation
      if (cv > 0.3) confidence = Math.max(0.5, confidence - 0.2); // penalize high variance
    }

    // Calculate next expected date
    const lastDate = dates[dates.length - 1];
    const nextExpectedDate = lastDate + avgInterval * 24 * 60 * 60 * 1000;

    const merchant = normalizeDescription(txs[0].description);
    const recurringId = `rec-${merchant.replace(/\s/g, '-').substring(0, 20)}-${Math.abs(Math.round(txs[0].amount * 100))}`;

    // UPSERT: insert or update if not confirmed/dismissed (don't overwrite user decisions)
    const existing = prepare(`SELECT id, status, detected_at FROM finance_recurring WHERE id = ?`).get(recurringId) as { id: string; status: string; detected_at: number } | undefined;
    if (existing && (existing.status === 'confirmed' || existing.status === 'dismissed')) {
      // Update next_expected_date only (preserve user decision)
      prepare(`UPDATE finance_recurring SET next_expected_date = ?, updated_at = ? WHERE id = ?`).run(nextExpectedDate, now, recurringId);
    } else {
      prepare(`INSERT OR REPLACE INTO finance_recurring (id, account_id, description, normalized_merchant, amount, currency, frequency, confidence, next_expected_date, status, detected_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        recurringId,
        txs[0].account_id,
        txs[0].description,
        merchant,
        txs[0].amount,
        txs[0].currency,
        frequency,
        confidence,
        nextExpectedDate,
        existing?.status || 'pending',
        existing?.detected_at || now,
        now
      );
    }
  }
}

// ── Registration ──

export function registerFinanceHandlers(): void {
  // Run schema migration on startup
  ensureFinanceSchema();

  // ============== EXISTING FINANCE HANDLERS (extracted from main.ts) ==============

  ipcMain.handle('finance:getTransactions', async (_, opts?: { limit?: number; accountId?: string } | number) => {
    try {
      // Backward compat: old callers pass a raw number
      let limit = 50;
      let accountId: string | undefined;
      if (typeof opts === 'number') {
        limit = opts;
      } else if (opts) {
        limit = opts.limit ?? 50;
        accountId = opts.accountId;
      }

      let sql = `SELECT id, account_id, date, description, amount, currency, category, budget_type FROM finance_transactions`;
      const params: any[] = [];
      if (accountId) {
        sql += ` WHERE account_id = ?`;
        params.push(accountId);
      }
      sql += ` ORDER BY date DESC LIMIT ?`;
      params.push(limit);

      const rows = prepare(sql).all(...params);
      return { success: true, transactions: rows };
    } catch (error: any) {
      safeLog.error('[Finance] Get transactions error:', error.message);
      return { success: false, transactions: [], error: error.message };
    }
  });

  ipcMain.handle('finance:getBudgetStatus', async (_, optsOrType?: { budgetType?: string; accountId?: string } | string) => {
    try {
      // Backward compat: old callers pass a raw string
      let budgetType: string | undefined;
      let accountId: string | undefined;
      if (typeof optsOrType === 'string') {
        budgetType = optsOrType;
      } else if (optsOrType) {
        budgetType = optsOrType.budgetType;
        accountId = optsOrType.accountId;
      }

      let sql = `SELECT id, name, budget_type, period_start, period_end, total_budget AS total_limit, spent AS total_spent, remaining, status, account_id, created_at FROM finance_budgets WHERE status = 'active'`;
      const params: any[] = [];
      if (budgetType) {
        sql += ` AND budget_type = ?`;
        params.push(budgetType);
      }
      if (accountId) {
        sql += ` AND account_id = ?`;
        params.push(accountId);
      }
      sql += ` ORDER BY created_at DESC`;

      const budgets = prepare(sql).all(...params) as any[];
      for (const b of budgets) {
        b.currency = 'EUR';
        b.categories = [];
      }
      return { success: true, status: { budgets } };
    } catch (error: any) {
      safeLog.error('[Finance] Get budget status error:', error.message);
      return { success: true, status: { budgets: [] } };
    }
  });

  ipcMain.handle('finance:selectFile', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Bank Statements', extensions: ['csv', 'pdf'] },
      ],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { success: false };
    }
    const filePath = result.filePaths[0];
    const fileName = path.basename(filePath);
    const content = fs.readFileSync(filePath);
    const isPdf = fileName.toLowerCase().endsWith('.pdf');
    return {
      success: true,
      fileName,
      isPdf,
      content: isPdf ? Array.from(content) : content.toString('utf-8'),
    };
  });

  ipcMain.handle('finance:uploadCSV', async (_, csvContent: string, filename: string, accountId?: string) => {
    try {
      const targetAccount = accountId || 'acc-default';

      // Ensure default account + finance_uploads table
      try {
        prepare(`CREATE TABLE IF NOT EXISTS finance_uploads (id TEXT PRIMARY KEY, filename TEXT NOT NULL, file_type TEXT, file_path TEXT, file_size INTEGER, account_id TEXT DEFAULT 'acc-default', status TEXT DEFAULT 'processing', ai_summary TEXT, created_at INTEGER, updated_at INTEGER)`).run();
        const existingAccount = prepare(`SELECT id FROM finance_accounts WHERE id = ?`).get('acc-default');
        if (!existingAccount) {
          prepare(`INSERT INTO finance_accounts (id, name, type, currency, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`).run('acc-default', 'Default Account', 'bank', 'EUR', Date.now(), Date.now());
        }
      } catch (e: any) {
        safeLog.error('[Finance] Schema setup error:', e.message);
      }

      // Save original file to uploads directory
      const uploadsDir = path.join(os.homedir(), 'froggo', 'uploads', 'finance');
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
      const uploadId = `upload-${Date.now()}`;
      const savedPath = path.join(uploadsDir, `${uploadId}-${filename}`);
      fs.writeFileSync(savedPath, csvContent, 'utf-8');

      // Record in DB
      const now = Date.now();
      prepare(`INSERT INTO finance_uploads (id, filename, file_type, file_path, file_size, account_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(uploadId, filename, 'csv', savedPath, csvContent.length, targetAccount, 'processing', now, now);

      // Notify UI that AI is reviewing
      const mainWindow = getMainWindow();
      if (mainWindow) {
        mainWindow.webContents.send('finance:analysisStatus', { status: 'started', type: 'csv_upload' });
      }

      // Send raw CSV to the finance agent — it parses and categorizes, returns JSON
      const bridge = getFinanceAgentBridge();
      const prompt = `Parse this bank statement file "${filename}" and extract ALL transactions.

Return ONLY a JSON object in this exact format (no markdown, no code fences, no extra text before or after):
{"transactions":[{"date":"YYYY-MM-DD","description":"...","amount":-12.50,"currency":"EUR","category":"Food"}],"summary":"Brief analysis of spending patterns and suggestions"}

Rules:
- Use negative amounts for expenses, positive for income
- Assign a category to each: Food, Housing, Transport, Entertainment, Income, Utilities, Shopping, Health, Subscriptions, Transfer, or Other
- date must be YYYY-MM-DD format
- currency should match the statement (default EUR if unclear)
- Return ALL transactions you can find
- The JSON must be valid — no trailing commas

Here is the file content:

${csvContent.slice(0, 15000)}`;

      const result = await bridge.sendMessage(prompt, { type: 'csv_upload', filename });

      // Parse agent response and insert transactions ourselves
      let imported = 0;
      let summary = '';
      if (result.success && result.message) {
        try {
          // Extract JSON from response — agent might wrap in markdown code fences
          let jsonStr = result.message;
          const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/) || jsonStr.match(/(\{[\s\S]*"transactions"[\s\S]*\})/);
          if (jsonMatch) jsonStr = jsonMatch[1].trim();

          const parsed = JSON.parse(jsonStr);
          const txns = parsed.transactions || [];
          summary = parsed.summary || '';

          const insertStmt = prepare(`INSERT OR IGNORE INTO finance_transactions (id, account_id, date, description, amount, currency, category, budget_type, imported_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
          const txNow = Date.now();

          for (const tx of txns) {
            const txId = `txn-${txNow}-${Math.random().toString(36).substring(2, 10)}`;
            // Convert date string (YYYY-MM-DD) to epoch ms
            let dateMs = txNow;
            if (tx.date) {
              const d = new Date(tx.date);
              if (!isNaN(d.getTime())) dateMs = d.getTime();
            }
            try {
              insertStmt.run(txId, targetAccount, dateMs, tx.description || '', Number(tx.amount) || 0, tx.currency || 'EUR', (tx.category || 'other').toLowerCase(), 'family', txNow, txNow, txNow);
              imported++;
            } catch (txErr: any) {
              safeLog.error('[Finance] Insert tx error:', txErr.message);
            }
          }

          safeLog.log(`[Finance] Inserted ${imported}/${txns.length} transactions from AI parse`);
        } catch (parseErr: any) {
          safeLog.error('[Finance] Failed to parse AI JSON response:', parseErr.message);
          summary = result.message; // Use raw response as summary fallback
        }
      }

      // Store insight if we got a summary
      if (summary) {
        try {
          const insightId = `insight-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
          const insightNow = Date.now();
          prepare(`INSERT OR IGNORE INTO finance_ai_insights (id, type, title, content, severity, generated_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(insightId, 'spending_pattern', `Upload Analysis: ${filename}`, summary, 'info', insightNow, insightNow, insightNow);
        } catch (_) {}
      }

      // Update upload record
      try {
        prepare(`UPDATE finance_uploads SET status = ?, ai_summary = ?, updated_at = ? WHERE id = ?`).run(imported > 0 ? 'complete' : 'error', summary || result.error || '', Date.now(), uploadId);
      } catch (_) {}

      const mw = getMainWindow();
      if (mw) {
        mw.webContents.send('finance:analysisStatus', {
          status: imported > 0 ? 'complete' : 'error',
          type: 'csv_upload',
          message: imported > 0 ? `Imported ${imported} transactions. ${summary}` : (summary || result.error || 'No transactions found'),
          error: imported === 0 ? 'No transactions were imported' : undefined,
        });
      }

      // Run recurring transaction detection after successful import
      if (imported > 0) {
        try { detectRecurring(targetAccount || undefined); } catch (e: any) { safeLog.error('[Finance] Recurring detection error:', e.message); }
      }

      return {
        success: imported > 0,
        analysisStarted: true,
        imported,
        skipped: 0,
      };
    } catch (error: any) {
      safeLog.error('[Finance] Upload CSV error:', error.message);
      const mw = getMainWindow();
      if (mw) {
        mw.webContents.send('finance:analysisStatus', { status: 'error', type: 'csv_upload', error: error.message });
      }
      return { success: false, imported: 0, skipped: 0, error: error.message };
    }
  });

  ipcMain.handle('finance:uploadPDF', async (_, pdfBuffer: ArrayBuffer, filename: string, accountId?: string) => {
    try {
      const targetAccount = accountId || 'acc-default';
      safeLog.log('[Finance] Processing PDF upload:', filename);

      // Ensure finance_uploads table
      try {
        prepare(`CREATE TABLE IF NOT EXISTS finance_uploads (id TEXT PRIMARY KEY, filename TEXT NOT NULL, file_type TEXT, file_path TEXT, file_size INTEGER, account_id TEXT DEFAULT 'acc-default', status TEXT DEFAULT 'processing', ai_summary TEXT, created_at INTEGER, updated_at INTEGER)`).run();
      } catch (_) {}

      // Save original PDF to uploads directory
      const uploadsDir = path.join(os.homedir(), 'froggo', 'uploads', 'finance');
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
      const uploadId = `upload-${Date.now()}`;
      const buf = Buffer.from(pdfBuffer);
      const savedPath = path.join(uploadsDir, `${uploadId}-${filename}`);
      fs.writeFileSync(savedPath, buf);

      // Record in DB
      const now = Date.now();
      prepare(`INSERT INTO finance_uploads (id, filename, file_type, file_path, file_size, account_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(uploadId, filename, 'pdf', savedPath, buf.length, targetAccount, 'processing', now, now);

      // Notify UI
      const mainWindow = getMainWindow();
      if (mainWindow) {
        mainWindow.webContents.send('finance:analysisStatus', { status: 'started', type: 'pdf_upload' });
      }

      // Extract text from PDF first, then send to AI
      const bridge = getFinanceAgentBridge();
      let pdfText = '';
      try {
        const { stdout } = await execAsync(`python3 -c "
import sys
try:
    import pdfplumber
    with pdfplumber.open('${savedPath.replace(/'/g, "\\'")}') as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                print(text)
except ImportError:
    # Fallback: try pdftotext
    import subprocess
    result = subprocess.run(['pdftotext', '${savedPath.replace(/'/g, "\\'")}', '-'], capture_output=True, text=True)
    print(result.stdout)
"`, { timeout: 30000 });
        pdfText = stdout.trim();
      } catch (pdfErr: any) {
        safeLog.error('[Finance] PDF text extraction error:', pdfErr.message);
        pdfText = `[Could not extract text from PDF. File saved at: ${savedPath}]`;
      }

      const prompt = `Parse this bank statement PDF "${filename}" and extract ALL transactions.

Return ONLY a JSON object in this exact format (no markdown, no code fences, no extra text before or after):
{"transactions":[{"date":"YYYY-MM-DD","description":"...","amount":-12.50,"currency":"EUR","category":"Food"}],"summary":"Brief analysis of spending patterns and suggestions"}

Rules:
- Use negative amounts for expenses, positive for income
- Assign a category to each: Food, Housing, Transport, Entertainment, Income, Utilities, Shopping, Health, Subscriptions, Transfer, or Other
- date must be YYYY-MM-DD format
- currency should match the statement (default EUR if unclear)
- Return ALL transactions you can find
- The JSON must be valid — no trailing commas

Here is the extracted text from the PDF:

${pdfText.slice(0, 15000)}`;

      const result = await bridge.sendMessage(prompt, { type: 'pdf_upload', filename, filePath: savedPath });

      // Parse agent response and insert transactions
      let imported = 0;
      let summary = '';
      if (result.success && result.message) {
        try {
          let jsonStr = result.message;
          const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/) || jsonStr.match(/(\{[\s\S]*"transactions"[\s\S]*\})/);
          if (jsonMatch) jsonStr = jsonMatch[1].trim();

          const parsed = JSON.parse(jsonStr);
          const txns = parsed.transactions || [];
          summary = parsed.summary || '';

          const insertStmt = prepare(`INSERT OR IGNORE INTO finance_transactions (id, account_id, date, description, amount, currency, category, budget_type, imported_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
          const txNow = Date.now();

          for (const tx of txns) {
            const txId = `txn-${txNow}-${Math.random().toString(36).substring(2, 10)}`;
            let dateMs = txNow;
            if (tx.date) {
              const d = new Date(tx.date);
              if (!isNaN(d.getTime())) dateMs = d.getTime();
            }
            try {
              insertStmt.run(txId, targetAccount, dateMs, tx.description || '', Number(tx.amount) || 0, tx.currency || 'EUR', (tx.category || 'other').toLowerCase(), 'family', txNow, txNow, txNow);
              imported++;
            } catch (txErr: any) {
              safeLog.error('[Finance] Insert tx error:', txErr.message);
            }
          }

          safeLog.log(`[Finance] Inserted ${imported}/${txns.length} transactions from PDF parse`);
        } catch (parseErr: any) {
          safeLog.error('[Finance] Failed to parse AI JSON response:', parseErr.message);
          summary = result.message;
        }
      }

      // Store insight
      if (summary) {
        try {
          const insightId = `insight-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
          const insightNow = Date.now();
          prepare(`INSERT OR IGNORE INTO finance_ai_insights (id, type, title, content, severity, generated_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(insightId, 'spending_pattern', `Upload Analysis: ${filename}`, summary, 'info', insightNow, insightNow, insightNow);
        } catch (_) {}
      }

      // Update upload record
      try {
        prepare(`UPDATE finance_uploads SET status = ?, ai_summary = ?, updated_at = ? WHERE id = ?`).run(imported > 0 ? 'complete' : 'error', summary || result.error || '', Date.now(), uploadId);
      } catch (_) {}

      const mw = getMainWindow();
      if (mw) {
        mw.webContents.send('finance:analysisStatus', {
          status: imported > 0 ? 'complete' : 'error',
          type: 'pdf_upload',
          message: imported > 0 ? `Imported ${imported} transactions from PDF. ${summary}` : (summary || result.error || 'No transactions found'),
          error: imported === 0 ? 'No transactions imported from PDF' : undefined,
        });
      }

      // Run recurring transaction detection after successful import
      if (imported > 0) {
        try { detectRecurring(targetAccount || undefined); } catch (e: any) { safeLog.error('[Finance] Recurring detection error:', e.message); }
      }

      return {
        success: imported > 0,
        message: imported > 0 ? `Imported ${imported} transactions. ${summary}` : (summary || 'No transactions found'),
        imported,
      };
    } catch (error: any) {
      safeLog.error('[Finance] Upload PDF error:', error.message);
      const mw = getMainWindow();
      if (mw) {
        mw.webContents.send('finance:analysisStatus', { status: 'error', type: 'pdf_upload', error: error.message });
      }
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('finance:getAlerts', async () => {
    try {
      const alerts = prepare(`SELECT id, type, severity, title, message, created_at AS timestamp FROM finance_alerts WHERE acknowledged = 0 ORDER BY created_at DESC LIMIT 50`).all();
      return { success: true, alerts };
    } catch (error: any) {
      safeLog.error('[Finance] Get alerts error:', error.message);
      return { success: true, alerts: [] };
    }
  });

  ipcMain.handle('finance:getInsights', async () => {
    try {
      const insights = prepare(`SELECT id, type, title, content, severity, generated_at FROM finance_ai_insights WHERE dismissed = 0 ORDER BY generated_at DESC LIMIT 50`).all();
      return { success: true, insights };
    } catch (error: any) {
      safeLog.error('[Finance] Get insights error:', error.message);
      return { success: false, insights: [], error: error.message };
    }
  });

  ipcMain.handle('finance:dismissInsight', async (_, insightId: string) => {
    try {
      const stmt = prepare(`
        UPDATE finance_ai_insights
        SET dismissed = 1, dismissed_at = ?
        WHERE id = ?
      `);
      stmt.run(Date.now(), insightId);
      return { success: true };
    } catch (error: any) {
      safeLog.error('[Finance] Dismiss insight error:', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('finance:createBudget', async (_, data: {
    name: string;
    budgetType: 'family' | 'crypto';
    totalBudget: number;
    currency?: string;
    periodStart?: number;
    periodEnd?: number;
    accountId?: string;
  }) => {
    try {
      const now = Date.now();
      const id = `budget-${now}`;
      const currency = data.currency || 'EUR';

      const today = new Date();
      const periodStart = data.periodStart || new Date(today.getFullYear(), today.getMonth(), 1).getTime();
      const periodEnd = data.periodEnd || new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999).getTime();

      prepare(`
        INSERT INTO finance_budgets (id, name, budget_type, period_start, period_end, total_budget, spent, remaining, status, account_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 0, ?, 'active', ?, ?, ?)
      `).run(id, data.name, data.budgetType, periodStart, periodEnd, data.totalBudget, data.totalBudget, data.accountId || null, now, now);

      safeLog.log(`[Finance] Created budget: ${data.name} (${data.budgetType}, ${data.totalBudget} ${currency})`);
      return { success: true, id };
    } catch (error: any) {
      safeLog.error('[Finance] Create budget error:', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('finance:triggerAnalysis', async (_, options?: { daysBack?: number; focus?: string }) => {
    try {
      const daysBack = options?.daysBack || 7;
      const focus = options?.focus || 'general';

      safeLog.log(`[Finance] Triggering AI analysis (${daysBack} days, focus: ${focus})`);

      let prompt = `Please analyze my financial activity from the last ${daysBack} days.`;

      if (focus === 'spending') {
        prompt += ' Focus on spending patterns and identify areas where I could save money.';
      } else if (focus === 'budget') {
        prompt += ' Focus on budget health and whether I\'m on track with my goals.';
      } else if (focus === 'anomalies') {
        prompt += ' Focus on unusual transactions or concerning patterns.';
      } else {
        prompt += ' Provide a comprehensive overview including spending patterns, budget health, and recommendations.';
      }

      const bridge = getFinanceAgentBridge();
      const response = await bridge.sendMessage(prompt, {
        analysisType: 'scheduled',
        daysBack,
        focus,
        triggeredAt: Date.now(),
      });

      if (response.success) {
        safeLog.log('[Finance] Analysis completed successfully');
        return { success: true, analysis: response.message };
      } else {
        throw new Error(response.error || 'Analysis failed');
      }
    } catch (error: any) {
      safeLog.error('[Finance] Trigger analysis error:', error.message);
      return { success: false, error: error.message };
    }
  });

  // ============== ACCOUNT CRUD HANDLERS ==============

  ipcMain.handle('finance:account:list', async () => {
    try {
      const rows = prepare(
        `SELECT * FROM finance_accounts WHERE archived = 0 OR archived IS NULL ORDER BY created_at ASC`
      ).all();
      return { success: true, accounts: rows };
    } catch (error: any) {
      safeLog.error('[Finance] Account list error:', error.message);
      return { success: false, accounts: [], error: error.message };
    }
  });

  ipcMain.handle('finance:account:create', async (_, data: { name: string; type: string; currency?: string }) => {
    try {
      const slug = data.name
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
      const id = `acc-${slug}-${Date.now()}`;
      const now = Date.now();
      prepare(
        `INSERT INTO finance_accounts (id, name, type, currency, archived, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?)`
      ).run(id, data.name, data.type, data.currency || 'EUR', now, now);
      safeLog.log(`[Finance] Created account: ${data.name} (${id})`);
      return { success: true, id };
    } catch (error: any) {
      safeLog.error('[Finance] Account create error:', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('finance:account:update', async (_, id: string, updates: { name?: string }) => {
    try {
      const now = Date.now();
      if (updates.name) {
        prepare(`UPDATE finance_accounts SET name = ?, updated_at = ? WHERE id = ?`).run(updates.name, now, id);
      }
      return { success: true };
    } catch (error: any) {
      safeLog.error('[Finance] Account update error:', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('finance:account:archive', async (_, id: string) => {
    try {
      const now = Date.now();
      prepare(`UPDATE finance_accounts SET archived = 1, updated_at = ? WHERE id = ?`).run(now, id);
      safeLog.log(`[Finance] Archived account: ${id}`);
      return { success: true };
    } catch (error: any) {
      safeLog.error('[Finance] Account archive error:', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('finance:account:balances', async () => {
    try {
      const rows = prepare(`
        SELECT a.id, a.name, a.type, a.currency, a.archived,
               COALESCE(SUM(t.amount), 0) as computed_balance,
               COUNT(t.id) as transaction_count
        FROM finance_accounts a
        LEFT JOIN finance_transactions t ON t.account_id = a.id
        WHERE a.archived = 0 OR a.archived IS NULL
        GROUP BY a.id
        ORDER BY a.created_at ASC
      `).all();
      return { success: true, balances: rows };
    } catch (error: any) {
      safeLog.error('[Finance] Account balances error:', error.message);
      return { success: false, balances: [], error: error.message };
    }
  });

  // ============== RECURRING TRANSACTION DETECTION HANDLERS ==============

  ipcMain.handle('finance:recurring:detect', async (_, accountId?: string) => {
    try {
      detectRecurring(accountId || undefined);
      return { success: true };
    } catch (error: any) {
      safeLog.error('[Finance] Recurring detect error:', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('finance:recurring:list', async (_, accountId?: string) => {
    try {
      const whereClause = accountId ? `WHERE account_id = ? AND status != 'dismissed'` : `WHERE status != 'dismissed'`;
      const params = accountId ? [accountId] : [];
      const rows = prepare(`SELECT * FROM finance_recurring ${whereClause} ORDER BY confidence DESC, detected_at DESC`).all(...params);
      return { success: true, recurring: rows };
    } catch (error: any) {
      safeLog.error('[Finance] Recurring list error:', error.message);
      return { success: false, recurring: [], error: error.message };
    }
  });

  ipcMain.handle('finance:recurring:confirm', async (_, id: string) => {
    try {
      prepare(`UPDATE finance_recurring SET status = 'confirmed', updated_at = ? WHERE id = ?`).run(Date.now(), id);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('finance:recurring:dismiss', async (_, id: string) => {
    try {
      prepare(`UPDATE finance_recurring SET status = 'dismissed', updated_at = ? WHERE id = ?`).run(Date.now(), id);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('finance:recurring:status', async (_, accountId?: string) => {
    try {
      const whereClause = accountId ? `WHERE account_id = ?` : '';
      const params = accountId ? [accountId] : [];
      const row = prepare(`SELECT COUNT(*) as total, SUM(CASE WHEN status='confirmed' THEN 1 ELSE 0 END) as confirmed, SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) as pending FROM finance_recurring ${whereClause}`).get(...params) as { total: number; confirmed: number; pending: number };
      return { success: true, stats: row };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // ============== XLSX EXPORT HANDLER ==============

  ipcMain.handle('finance:export:xlsx', async (_, opts: {
    accountId?: string;
    dateFrom?: number;   // epoch ms, optional
    dateTo?: number;     // epoch ms, optional
  }) => {
    try {
      const savePath = await dialog.showSaveDialog({
        defaultPath: `finance-export-${new Date().toISOString().slice(0, 10)}.xlsx`,
        filters: [{ name: 'Excel Spreadsheet', extensions: ['xlsx'] }],
      });
      if (savePath.canceled || !savePath.filePath) return { success: false, canceled: true };

      // Build WHERE clause for transaction filtering
      const conditions: string[] = [];
      const params: (string | number)[] = [];
      if (opts.accountId) { conditions.push('t.account_id = ?'); params.push(opts.accountId); }
      if (opts.dateFrom) { conditions.push('t.date >= ?'); params.push(opts.dateFrom); }
      if (opts.dateTo) { conditions.push('t.date <= ?'); params.push(opts.dateTo); }
      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const transactions = prepare(
        `SELECT t.date, t.description, t.amount, t.currency, t.category, t.budget_type, t.account_id, a.name as account_name FROM finance_transactions t LEFT JOIN finance_accounts a ON t.account_id = a.id ${whereClause} ORDER BY t.account_id, t.date DESC`
      ).all(...params) as Array<{ date: number; description: string; amount: number; currency: string; category: string; budget_type: string; account_id: string; account_name: string }>;

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Froggo Finance';
      workbook.created = new Date();

      // --- Summary Sheet ---
      const summarySheet = workbook.addWorksheet('Summary');
      summarySheet.columns = [
        { header: 'Metric', key: 'metric', width: 28 },
        { header: 'Value', key: 'value', width: 18 },
      ];

      const totalIncome = transactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
      const totalExpenses = transactions.filter(t => t.amount < 0).reduce((sum, t) => sum + t.amount, 0);
      const net = totalIncome + totalExpenses;

      summarySheet.addRow({ metric: 'Total Income', value: totalIncome.toFixed(2) });
      summarySheet.addRow({ metric: 'Total Expenses', value: totalExpenses.toFixed(2) });
      summarySheet.addRow({ metric: 'Net', value: net.toFixed(2) });
      summarySheet.addRow({ metric: 'Transaction Count', value: transactions.length });

      // Top categories by spend
      const categoryMap = new Map<string, number>();
      for (const t of transactions) {
        if (t.amount < 0) {
          const cat = t.category || 'Uncategorized';
          categoryMap.set(cat, (categoryMap.get(cat) || 0) + Math.abs(t.amount));
        }
      }
      const topCategories = [...categoryMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
      summarySheet.addRow({});
      summarySheet.addRow({ metric: 'Top Categories by Spend', value: '' });
      for (const [cat, amount] of topCategories) {
        summarySheet.addRow({ metric: `  ${cat}`, value: amount.toFixed(2) });
      }

      // Style header row bold
      summarySheet.getRow(1).font = { bold: true };

      // --- Per-Account Sheets ---
      // Group transactions by account
      const accountGroups = new Map<string, typeof transactions>();
      for (const t of transactions) {
        const key = t.account_id || 'unknown';
        if (!accountGroups.has(key)) accountGroups.set(key, []);
        accountGroups.get(key)!.push(t);
      }

      for (const [accountId, txs] of accountGroups.entries()) {
        const accountName = txs[0].account_name || accountId;
        // Excel sheet name max 31 chars, no special chars
        const sheetName = accountName.replace(/[:/\\?*[\]]/g, '-').substring(0, 31);
        const sheet = workbook.addWorksheet(sheetName);
        sheet.columns = [
          { header: 'Date', key: 'date', width: 14 },
          { header: 'Description', key: 'description', width: 40 },
          { header: 'Amount', key: 'amount', width: 14 },
          { header: 'Currency', key: 'currency', width: 10 },
          { header: 'Category', key: 'category', width: 20 },
          { header: 'Budget Type', key: 'budget_type', width: 16 },
        ];

        for (const t of txs) {
          sheet.addRow({
            date: new Date(t.date).toISOString().slice(0, 10),
            description: t.description,
            amount: t.amount,
            currency: t.currency || 'EUR',
            category: t.category || '',
            budget_type: t.budget_type || '',
          });
        }

        sheet.getRow(1).font = { bold: true };
        // Color negative amounts red (column C)
        sheet.getColumn('amount').eachCell({ includeEmpty: false }, (cell, rowNumber) => {
          if (rowNumber > 1 && typeof cell.value === 'number' && cell.value < 0) {
            cell.font = { color: { argb: 'FFCC0000' } };
          }
        });
      }

      await workbook.xlsx.writeFile(savePath.filePath);
      return { success: true, path: savePath.filePath };
    } catch (error: any) {
      safeLog.error('[Finance] Export XLSX error:', error.message);
      return { success: false, error: error.message };
    }
  });
}
