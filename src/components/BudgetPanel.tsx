// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// BudgetPanel — full-featured budget module: quarters, categories, invoices, AI chat

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Box, Flex, Button, Select, TextField, TextArea, Checkbox } from '@radix-ui/themes';
import {
  Wallet, Plus, Pencil, Trash2, X, RefreshCw, Upload, FileText, DollarSign,
  TrendingDown, Bot, AlertTriangle, CheckCircle, Clock, Ban,
  ExternalLink, Layers, BarChart3, PieChart as PieChartIcon, Sparkles, Link2,
  Download, ChevronLeft, Users, Target, Eye, Loader2, Search, Filter,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart as RePieChart, Pie, Cell, Legend,
} from 'recharts';
import { showToast } from './Toast';
import FinanceAgentChat from './FinanceAgentChat';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Quarter {
  id: string; name: string; year: number; quarter: number;
  start_date: string; end_date: string; total_budget: number; currency: string;
  status: 'planning' | 'active' | 'closed'; notes?: string;
  actual?: number; paid?: number; pending?: number; invoice_count?: number;
}

interface Category {
  id: string; quarter_id: string; name: string; planned: number;
  color: string; cac: number; notes?: string; tags?: string[];
  actual?: number; invoice_count?: number;
}

interface Invoice {
  id: string; quarter_id: string; category_id?: string;
  category_name?: string; category_color?: string;
  invoice_number?: string; title: string; description?: string;
  amount: number; currency: string; date: number; vendor?: string;
  status: 'pending' | 'paid' | 'cancelled';
  file_path?: string; file_name?: string; file_mime?: string;
  tx_hash?: string; tx_chain?: string; notes?: string;
}

type Tab = 'dashboard' | 'invoices' | 'categories' | 'chat';

// ─── Constants ────────────────────────────────────────────────────────────────

const PALETTE = [
  '#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6',
  '#8b5cf6', '#ef4444', '#14b8a6', '#f97316', '#84cc16',
  '#06b6d4', '#e11d48',
];

const STATUS_CFG = {
  pending:   { label: 'Pending',   icon: Clock,       cls: 'text-warning bg-warning/10 border-warning/30' },
  paid:      { label: 'Paid',      icon: CheckCircle, cls: 'text-success bg-success/10 border-success/30' },
  cancelled: { label: 'Cancelled', icon: Ban,         cls: 'text-error   bg-error/10   border-error/30'   },
};

const CHAINS = [
  { id: 'ethereum', name: 'Ethereum',  url: (h: string) => `https://etherscan.io/tx/${h}` },
  { id: 'polygon',  name: 'Polygon',   url: (h: string) => `https://polygonscan.com/tx/${h}` },
  { id: 'arbitrum', name: 'Arbitrum',  url: (h: string) => `https://arbiscan.io/tx/${h}` },
  { id: 'base',     name: 'Base',      url: (h: string) => `https://basescan.org/tx/${h}` },
  { id: 'solana',   name: 'Solana',    url: (h: string) => `https://solscan.io/tx/${h}` },
  { id: 'optimism', name: 'Optimism',  url: (h: string) => `https://optimistic.etherscan.io/tx/${h}` },
  { id: 'avalanche',name: 'Avalanche', url: (h: string) => `https://snowtrace.io/tx/${h}` },
  { id: 'bsc',      name: 'BSC',       url: (h: string) => `https://bscscan.com/tx/${h}` },
];

// ─── Utilities ────────────────────────────────────────────────────────────────

function fmt(amount: number, currency = 'USD') {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}
function fmtCompact(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return n.toString();
}
function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function pct(actual: number, planned: number) {
  if (!planned) return 0;
  return Math.round((actual / planned) * 100);
}
function progressColor(p: number) {
  if (p >= 100) return 'var(--color-error)';
  if (p >= 80) return 'var(--color-warning)';
  return 'var(--color-success)';
}
function getExplorerUrl(txHash: string, chain: string) {
  const c = CHAINS.find(x => x.id === chain.toLowerCase());
  return c ? c.url(txHash) : `https://etherscan.io/tx/${txHash}`;
}
function truncateHash(hash: string) {
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, accent }: {
  label: string; value: string; sub?: string; icon: React.ElementType; accent: string;
}) {
  return (
    <div className="bg-mission-control-surface border border-mission-control-border rounded-xl p-4">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg shrink-0" style={{ backgroundColor: `${accent}20` }}>
          <Icon size={16} style={{ color: accent }} />
        </div>
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mb-0.5">{label}</div>
          <div className="text-2xl font-bold text-mission-control-text tabular-nums leading-tight">{value}</div>
          {sub && <div className="text-xs text-mission-control-text-dim mt-0.5">{sub}</div>}
        </div>
      </div>
    </div>
  );
}

function ProgressBar({ value, color, className = '' }: { value: number; color: string; className?: string }) {
  return (
    <div className={`h-1.5 rounded-full bg-mission-control-border/40 overflow-hidden ${className}`}>
      <div className="h-full rounded-full transition-colors duration-500" style={{ width: `${Math.min(value, 100)}%`, backgroundColor: color }} />
    </div>
  );
}

// ─── File Drop Zone (with Gemini extraction) ───────────────────────────────────

function FileDropZone({ invoiceId, onUpload, onExtracted, existingFile, onRemove }: {
  invoiceId?: string;
  onUpload?: (file: File) => Promise<void>;
  onExtracted?: (data: Record<string, unknown>) => void;
  existingFile?: string;
  onRemove?: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'info' | 'error'; msg: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function processFile(file: File) {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setStatus({ type: 'error', msg: 'PDF or image (JPG, PNG, WEBP) only' });
      return;
    }

    // Run Gemini extraction and file upload in parallel
    const tasks: Promise<void>[] = [];

    // Gemini extraction (always run if callback provided)
    if (onExtracted) {
      setExtracting(true);
      const extractTask = (async () => {
        try {
          const fd = new FormData();
          fd.append('file', file);
          const res = await fetch('/api/budget/extract', { method: 'POST', body: fd });
          if (res.ok) {
            const data = await res.json();
            if (data.extracted) {
              onExtracted(data.extracted);
              const fields = Object.entries(data.extracted).filter(([, v]) => v != null).map(([k]) => k);
              setStatus({ type: 'success', msg: `Auto-filled: ${fields.join(', ')}` });
            } else {
              setStatus({ type: 'info', msg: 'File uploaded. AI could not extract fields.' });
            }
          }
        } catch { setStatus({ type: 'info', msg: 'File uploaded. AI extraction failed.' }); }
        finally { setExtracting(false); }
      })();
      tasks.push(extractTask);
    }

    // File upload (only if invoiceId provided)
    if (invoiceId && onUpload) {
      setUploading(true);
      tasks.push(onUpload(file).finally(() => setUploading(false)));
    }

    await Promise.all(tasks);
  }

  if (existingFile) {
    return (
      <Flex align="center" gap="2" className="p-2.5 rounded-lg border border-mission-control-border bg-mission-control-bg">
        <FileText size={14} className="text-info shrink-0" />
        <span className="flex-1 text-xs truncate text-mission-control-text">{existingFile}</span>
        {onRemove && <button type="button" className="inline-flex items-center justify-center w-5 h-5 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors" onClick={onRemove}><X size={13} /></button>}
      </Flex>
    );
  }

  return (
    <div>
      <Flex
        align="center"
        justify="center"
        gap="2"
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) processFile(f); }}
        className={`p-3 border-2 border-dashed rounded-lg cursor-pointer transition-colors text-xs ${
          dragging
            ? 'border-mission-control-accent bg-mission-control-accent/10'
            : 'border-mission-control-border/60 hover:border-mission-control-accent/50 hover:bg-mission-control-accent/5'
        }`}
      >
        {extracting || uploading ? (
          <><Loader2 size={13} className="animate-spin text-mission-control-accent" /><span className="text-mission-control-accent">{extracting ? 'AI analyzing…' : 'Uploading…'}</span></>
        ) : (
          <><Upload size={13} className="text-mission-control-text-dim" /><Sparkles size={11} className="text-warning" /><span className="text-mission-control-text-dim">Drop PDF/image or click — AI auto-fills fields</span></>
        )}
      </Flex>
      {status && (
        <div className={`mt-1 text-[10px] px-2 py-1 rounded ${
          status.type === 'success' ? 'bg-success/10 text-success' : status.type === 'error' ? 'bg-error/10 text-error' : 'bg-info/10 text-info'
        }`}>{status.msg}</div>
      )}
      <input ref={inputRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp"
        onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); }} />
    </div>
  );
}

// ─── PDF Preview Modal ─────────────────────────────────────────────────────────

function PdfPreviewModal({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const isPdf = invoice.file_mime === 'application/pdf';
  const fileUrl = `/api/budget/upload?id=${invoice.id}`;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-mission-control-surface border border-mission-control-border rounded-xl shadow-2xl flex flex-col w-full max-w-4xl max-h-[90vh]">
        <Flex align="center" justify="between" className="px-5 py-3 border-b border-mission-control-border shrink-0">
          <Flex align="center" gap="2">
            <FileText size={14} className="text-info" />
            <span className="text-sm font-medium text-mission-control-text">{invoice.file_name || invoice.title}</span>
          </Flex>
          <Flex align="center" gap="2">
            <a href={fileUrl} download={invoice.file_name} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text transition-colors">
              <Download size={11} /> Download
            </a>
            <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text transition-colors">
              <ExternalLink size={11} /> Open
            </a>
            <button type="button" className="inline-flex items-center justify-center w-5 h-5 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors" onClick={onClose}><X size={15} /></button>
          </Flex>
        </Flex>
        <div className="flex-1 overflow-hidden rounded-b-2xl min-h-[500px]">
          {isPdf
            ? <iframe src={fileUrl} className="w-full h-full" title="Invoice PDF" />
            : <img src={fileUrl} alt="Invoice" className="w-full h-full object-contain p-4" />
          }
        </div>
      </div>
    </div>
  );
}

// ─── Modal wrapper ─────────────────────────────────────────────────────────────

function ModalWrap({ title, onClose, children, wide }: {
  title: string; onClose: () => void; children: React.ReactNode; wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-mission-control-surface border border-mission-control-border rounded-xl shadow-2xl flex flex-col max-h-[90vh] w-full ${wide ? 'max-w-2xl' : 'max-w-md'}`}>
        <Flex align="center" justify="between" className="px-5 py-3.5 border-b border-mission-control-border shrink-0">
          <span className="font-semibold text-sm text-mission-control-text">{title}</span>
          <button type="button" className="inline-flex items-center justify-center w-5 h-5 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors" onClick={onClose}><X size={15} /></button>
        </Flex>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-mission-control-text-dim mb-1">{label}</label>
      {children}
    </div>
  );
}

function ModalActions({ onClose, onSave, saving, label, danger }: {
  onClose: () => void; onSave: () => void; saving: boolean; label: string; danger?: boolean;
}) {
  return (
    <Flex justify="end" gap="2" className="mt-5 pt-4 border-t border-mission-control-border/50">
      <button type="button" className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors" onClick={onClose}>
        Cancel
      </button>
      <Button variant={danger ? 'soft' : 'solid'} color={danger ? 'red' : undefined} size="1" onClick={onSave} disabled={saving}>
        {saving && <Loader2 size={11} className="animate-spin" />}
        {label}
      </Button>
    </Flex>
  );
}

// ─── Quarter Modal ─────────────────────────────────────────────────────────────

function QuarterModal({ data, onSave, onClose }: {
  data?: Partial<Quarter>; onSave: (d: Partial<Quarter>) => Promise<void>; onClose: () => void;
}) {
  const isEdit = !!data?.id;
  const [form, setForm] = useState({
    name: data?.name || '', year: data?.year || new Date().getFullYear(),
    quarter: data?.quarter || 1, start_date: data?.start_date || '',
    end_date: data?.end_date || '', total_budget: data?.total_budget || 0,
    currency: data?.currency || 'USD', status: data?.status || 'active' as const,
    notes: data?.notes || '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!form.start_date) {
      const q = form.quarter; const y = form.year;
      const starts = [null, `${y}-01-01`, `${y}-04-01`, `${y}-07-01`, `${y}-10-01`];
      const ends   = [null, `${y}-03-31`, `${y}-06-30`, `${y}-09-30`, `${y}-12-31`];
      if (!form.name) setForm(p => ({ ...p, name: `Q${q} ${y}`, start_date: starts[q]!, end_date: ends[q]! }));
      else setForm(p => ({ ...p, start_date: starts[q]!, end_date: ends[q]! }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.quarter, form.year]);

  async function handleSave() {
    setSaving(true);
    try { await onSave({ ...data, ...form }); }
    catch (e) { showToast('error', 'Save failed', e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  }

  return (
    <ModalWrap title={isEdit ? 'Edit Quarter' : 'New Quarter'} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Name">
          <TextField.Root value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Q1 2026" size="1" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Year">
            <TextField.Root type="number" value={String(form.year)} onChange={e => setForm(p => ({ ...p, year: Number(e.target.value), start_date: '', end_date: '' }))} size="1" />
          </Field>
          <Field label="Quarter">
            <Select.Root value={String(form.quarter)} onValueChange={val => setForm(p => ({ ...p, quarter: Number(val), start_date: '', end_date: '' }))}>
              <Select.Trigger className="w-full" />
              <Select.Content>
                {[1,2,3,4].map(q => <Select.Item key={q} value={String(q)}>Q{q}</Select.Item>)}
              </Select.Content>
            </Select.Root>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start Date"><TextField.Root type="date" value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))} size="1" /></Field>
          <Field label="End Date"><TextField.Root type="date" value={form.end_date} onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))} size="1" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Total Budget"><TextField.Root type="number" value={String(form.total_budget)} onChange={e => setForm(p => ({ ...p, total_budget: Number(e.target.value) }))} size="1" /></Field>
          <Field label="Currency">
            <Select.Root value={form.currency} onValueChange={val => setForm(p => ({ ...p, currency: val }))}>
              <Select.Trigger className="w-full" />
              <Select.Content>
                {['USD','EUR','MXN','BRL','GBP','USDC'].map(c => <Select.Item key={c} value={c}>{c}</Select.Item>)}
              </Select.Content>
            </Select.Root>
          </Field>
        </div>
        <Field label="Status">
          <Select.Root value={form.status} onValueChange={val => setForm(p => ({ ...p, status: val as any }))}>
            <Select.Trigger className="w-full" />
            <Select.Content>
              <Select.Item value="planning">Planning</Select.Item>
              <Select.Item value="active">Active</Select.Item>
              <Select.Item value="closed">Closed</Select.Item>
            </Select.Content>
          </Select.Root>
        </Field>
        <Field label="Notes">
          <TextArea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} className="resize-none w-full" size="1" />
        </Field>
      </div>
      <ModalActions onClose={onClose} onSave={handleSave} saving={saving} label={isEdit ? 'Save Changes' : 'Create Quarter'} />
    </ModalWrap>
  );
}

// ─── Category Modal ────────────────────────────────────────────────────────────

// ─── Crypto growth category presets ───────────────────────────────────────────

const CATEGORY_PRESETS = [
  { name: 'KOL Partnerships', color: '#ec4899', tags: ['kol', 'influencer', 'growth'] },
  { name: 'Events & Conferences', color: '#f59e0b', tags: ['events', 'irl', 'brand'] },
  { name: 'PR & Media', color: '#3b82f6', tags: ['pr', 'media', 'comms'] },
  { name: 'Paid Marketing', color: '#8b5cf6', tags: ['ads', 'paid', 'growth'] },
  { name: 'Rewards & Incentives', color: '#10b981', tags: ['rewards', 'loyalty', 'growth'] },
  { name: 'Social & Community', color: '#06b6d4', tags: ['social', 'community', 'content'] },
  { name: 'Tools & Software', color: '#6366f1', tags: ['tools', 'saas', 'ops'] },
  { name: 'Content Production', color: '#f97316', tags: ['content', 'video', 'creative'] },
  { name: 'Airdrop & Token Distribution', color: '#84cc16', tags: ['airdrop', 'tokens', 'growth'] },
  { name: 'Audit & Security', color: '#ef4444', tags: ['security', 'audit', 'dev'] },
  { name: 'Exchange Listings', color: '#14b8a6', tags: ['listings', 'exchange', 'growth'] },
  { name: 'Research & Analytics', color: '#a855f7', tags: ['research', 'data', 'ops'] },
  { name: 'Legal & Compliance', color: '#64748b', tags: ['legal', 'compliance', 'ops'] },
  { name: 'Grants & Ecosystem', color: '#e11d48', tags: ['grants', 'ecosystem', 'community'] },
  { name: 'Headcount & Contractors', color: '#0891b2', tags: ['hr', 'contractors', 'ops'] },
  { name: 'Infrastructure & DevOps', color: '#7c3aed', tags: ['infra', 'devops', 'dev'] },
];

const ALL_PRESET_TAGS = Array.from(new Set(CATEGORY_PRESETS.flatMap(p => p.tags))).sort();

function CategoryModal({ data, quarterId, currency, onSave, onClose }: {
  data?: Partial<Category>; quarterId: string; currency: string;
  onSave: (d: Partial<Category>) => Promise<void>; onClose: () => void;
}) {
  const isEdit = !!data?.id;
  const [form, setForm] = useState({
    name: data?.name || '', planned: data?.planned || 0,
    cac: data?.cac || 0, color: data?.color || PALETTE[0],
    notes: data?.notes || '', tags: data?.tags || [] as string[],
  });
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [showPresets, setShowPresets] = useState(!isEdit);

  const projectedUsers = form.cac > 0 ? Math.round(form.planned / form.cac) : null;

  function applyPreset(preset: typeof CATEGORY_PRESETS[0]) {
    setForm(p => ({ ...p, name: preset.name, color: preset.color, tags: preset.tags }));
    setShowPresets(false);
  }

  function addTag(tag: string) {
    const t = tag.toLowerCase().trim().replace(/\s+/g, '-');
    if (!t || form.tags.includes(t)) return;
    setForm(p => ({ ...p, tags: [...p.tags, t] }));
    setTagInput('');
  }

  function removeTag(tag: string) {
    setForm(p => ({ ...p, tags: p.tags.filter(t => t !== tag) }));
  }

  async function handleSave() {
    if (!form.name.trim()) { showToast('error', 'Name required'); return; }
    setSaving(true);
    try { await onSave({ ...data, ...form, quarter_id: quarterId }); }
    catch (e) { showToast('error', 'Save failed', e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  }

  return (
    <ModalWrap title={isEdit ? 'Edit Category' : 'New Category'} onClose={onClose}>
      <div className="space-y-3">
        {/* Preset picker */}
        {!isEdit && (
          <div>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors text-[11px] text-mission-control-accent flex items-center gap-1"
              onClick={() => setShowPresets(p => !p)}
            >
              <Sparkles size={11} /> {showPresets ? 'Hide presets' : 'Start from a preset'}
            </button>
            {showPresets && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {CATEGORY_PRESETS.map(p => (
                  <button
                    key={p.name} type="button"
                    onClick={() => applyPreset(p)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors flex items-center gap-1.5 px-2 py-1 rounded-lg border border-mission-control-border text-[11px] text-mission-control-text-dim"
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <Field label="Name">
          <TextField.Root value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. KOL Partnerships" autoFocus={isEdit} size="1" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={`Planned Budget (${currency})`}>
            <TextField.Root type="number" value={String(form.planned)} onChange={e => setForm(p => ({ ...p, planned: Number(e.target.value) }))} size="1" />
          </Field>
          <Field label="CAC Est. (per user)">
            <TextField.Root type="number" value={String(form.cac)} onChange={e => setForm(p => ({ ...p, cac: Number(e.target.value) }))} placeholder="0" size="1" />
          </Field>
        </div>

        {projectedUsers !== null && (
          <Flex align="center" gap="2" className="text-xs text-mission-control-text-dim bg-mission-control-bg rounded-lg px-3 py-2">
            <Users size={11} />
            <span>Projected <strong className="text-mission-control-text">{projectedUsers.toLocaleString()} users</strong> at {fmt(form.cac, currency)} CAC</span>
          </Flex>
        )}

        <Field label="Color">
          <div className="flex items-center gap-2 flex-wrap">
            <input type="color" value={form.color} onChange={e => setForm(p => ({ ...p, color: e.target.value }))}
              className="unstyled w-8 h-8 rounded cursor-pointer border border-mission-control-border" />
            {PALETTE.map(c => (
              <button key={c} type="button" onClick={() => setForm(p => ({ ...p, color: c }))}
                className={`inline-flex items-center justify-center w-5 h-5 rounded-full border-2 transition-colors p-0 min-w-0 ${form.color === c ? 'border-white scale-110' : 'border-transparent'}`}
                style={{ backgroundColor: c }} />
            ))}
          </div>
        </Field>

        {/* Tags */}
        <div>
          <label className="block text-xs font-medium text-mission-control-text-dim mb-1">Tags</label>
          {form.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {form.tags.map(t => (
                <span key={t} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border border-mission-control-accent/40 bg-mission-control-accent/10 text-mission-control-accent">
                  {t}
                  <button type="button" className="inline-flex items-center justify-center leading-none w-3 h-3 min-w-0 rounded transition-colors text-mission-control-text-dim hover:text-mission-control-text" onClick={() => removeTag(t)}>
                    <X size={9} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <Flex gap="2">
            <TextField.Root
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(tagInput); } }}
              placeholder="Add tag (Enter to confirm)"
              className="flex-1"
              size="1"
            />
          </Flex>
          {/* Suggested tags */}
          <div className="flex flex-wrap gap-1 mt-1.5">
            {ALL_PRESET_TAGS.filter(t => !form.tags.includes(t) && (!tagInput || t.includes(tagInput.toLowerCase()))).slice(0, 12).map(t => (
              <button key={t} type="button" onClick={() => addTag(t)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors px-1.5 py-0.5 rounded text-[10px] border border-mission-control-border text-mission-control-text-dim">
                + {t}
              </button>
            ))}
          </div>
        </div>

        <Field label="Notes">
          <TextArea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} className="resize-none w-full" size="1" />
        </Field>
      </div>
      <ModalActions onClose={onClose} onSave={handleSave} saving={saving} label={isEdit ? 'Save Changes' : 'Create Category'} />
    </ModalWrap>
  );
}

// ─── Invoice Modal ─────────────────────────────────────────────────────────────

function InvoiceModal({ data, quarterId, currency, categories, allInvoices, onSave, onClose }: {
  data?: Partial<Invoice>; quarterId: string; currency: string;
  categories: Category[]; allInvoices: Invoice[];
  onSave: (d: Partial<Invoice>, file?: File) => Promise<void>; onClose: () => void;
}) {
  const isEdit = !!data?.id;
  const [form, setForm] = useState({
    title: data?.title || '', invoice_number: data?.invoice_number || '',
    description: data?.description || '', amount: data?.amount || 0,
    currency: data?.currency || currency, date: data?.date
      ? new Date(data.date).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0],
    vendor: data?.vendor || '', category_id: data?.category_id || '',
    status: data?.status || 'pending' as const,
    tx_hash: data?.tx_hash || '', tx_chain: data?.tx_chain || 'ethereum',
    notes: data?.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState(data?.file_name || '');
  const [dupWarning, setDupWarning] = useState('');

  // Duplicate detection
  useEffect(() => {
    if (!isEdit) {
      if (form.invoice_number) {
        const dup = allInvoices.find(i => i.invoice_number === form.invoice_number && i.quarter_id === quarterId);
        setDupWarning(dup ? `Invoice #${form.invoice_number} already exists in this quarter` : '');
      } else if (form.amount && form.date && form.vendor) {
        const dateTs = new Date(form.date).getTime();
        const dup = allInvoices.find(i =>
          i.amount === form.amount && i.vendor === form.vendor &&
          Math.abs(i.date - dateTs) < 86400000 && i.quarter_id === quarterId
        );
        setDupWarning(dup ? 'Possible duplicate: same amount, vendor, and date exists' : '');
      } else {
        setDupWarning('');
      }
    }
  }, [form.invoice_number, form.amount, form.date, form.vendor, isEdit, allInvoices, quarterId]);

  function handleExtracted(extracted: Record<string, unknown>) {
    setForm(prev => ({
      ...prev,
      ...(extracted.invoice_number ? { invoice_number: String(extracted.invoice_number) } : {}),
      ...(extracted.title ? { title: String(extracted.title) } : {}),
      ...(extracted.vendor ? { vendor: String(extracted.vendor) } : {}),
      ...(extracted.amount != null ? { amount: Number(extracted.amount) } : {}),
      ...(extracted.date ? { date: String(extracted.date) } : {}),
      ...(extracted.description ? { description: String(extracted.description) } : {}),
      ...(extracted.currency ? { currency: String(extracted.currency) } : {}),
    }));
  }

  async function handleSave() {
    if (!form.title.trim()) { showToast('error', 'Title required'); return; }
    if (!form.amount) { showToast('error', 'Amount required'); return; }
    setSaving(true);
    try {
      const dateTs = new Date(form.date).getTime();
      await onSave({ ...data, ...form, date: dateTs, quarter_id: quarterId }, pendingFile || undefined);
    } catch (e: any) {
      if (e?.status === 409 || e?.message?.includes('duplicate')) {
        showToast('error', 'Duplicate invoice', e.message);
      } else {
        showToast('error', 'Save failed', e instanceof Error ? e.message : String(e));
      }
    } finally { setSaving(false); }
  }

  return (
    <ModalWrap title={isEdit ? 'Edit Invoice' : 'New Invoice'} onClose={onClose} wide>
      <div className="space-y-3">
        {/* File upload with Gemini extraction */}
        <Field label="Invoice Document (AI auto-fill)">
          <FileDropZone
            onExtracted={handleExtracted}
            existingFile={fileName || undefined}
            onRemove={() => { setFileName(''); setPendingFile(null); }}
          />
        </Field>

        {dupWarning && (
          <Flex align="center" gap="2" className="text-xs text-warning bg-warning/10 border border-warning/20 rounded-lg px-3 py-2">
            <AlertTriangle size={11} /> {dupWarning}
          </Flex>
        )}

        <Field label="Title">
          <TextField.Root value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="KOL Partnership, Event Sponsorship…" size="1" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Invoice #">
            <TextField.Root value={form.invoice_number} onChange={e => setForm(p => ({ ...p, invoice_number: e.target.value }))} placeholder="INV-001" size="1" />
          </Field>
          <Field label="Vendor">
            <TextField.Root value={form.vendor} onChange={e => setForm(p => ({ ...p, vendor: e.target.value }))} placeholder="Company name" size="1" />
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <Field label="Amount">
              <TextField.Root type="number" step="0.01" value={form.amount ? String(form.amount) : ''} onChange={e => setForm(p => ({ ...p, amount: Number(e.target.value) }))} placeholder="0.00" size="1" />
            </Field>
          </div>
          <Field label="Currency">
            <Select.Root value={form.currency} onValueChange={val => setForm(p => ({ ...p, currency: val }))}>
              <Select.Trigger className="w-full" />
              <Select.Content>
                {['USD','EUR','MXN','BRL','GBP','USDC'].map(c => <Select.Item key={c} value={c}>{c}</Select.Item>)}
              </Select.Content>
            </Select.Root>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <TextField.Root type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} size="1" />
          </Field>
          <Field label="Status">
            <Select.Root value={form.status} onValueChange={val => setForm(p => ({ ...p, status: val as any }))}>
              <Select.Trigger className="w-full" />
              <Select.Content>
                <Select.Item value="pending">Pending</Select.Item>
                <Select.Item value="paid">Paid</Select.Item>
                <Select.Item value="cancelled">Cancelled</Select.Item>
              </Select.Content>
            </Select.Root>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <Select.Root value={form.category_id || '__uncategorized__'} onValueChange={val => setForm(p => ({ ...p, category_id: val === '__uncategorized__' ? '' : val }))}>
              <Select.Trigger className="w-full" />
              <Select.Content>
                <Select.Item value="__uncategorized__">Uncategorized</Select.Item>
                {categories.map(c => <Select.Item key={c.id} value={c.id}>{c.name}</Select.Item>)}
              </Select.Content>
            </Select.Root>
          </Field>
          <Field label="Notes">
            <TextField.Root value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Optional notes" size="1" />
          </Field>
        </div>

        <Field label="Description">
          <TextArea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} className="resize-none w-full" placeholder="Brief context" size="1" />
        </Field>

        {/* Onchain TX */}
        <div className="border-t border-mission-control-border/50 pt-3">
          <div className="text-[11px] font-medium text-mission-control-text-dim mb-2 flex items-center gap-1.5">
            <Link2 size={11} /> Onchain Transaction (optional)
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <TextField.Root value={form.tx_hash} onChange={e => setForm(p => ({ ...p, tx_hash: e.target.value }))}
                className="font-mono" placeholder="0x…" size="1" />
            </div>
            <Select.Root value={form.tx_chain} onValueChange={val => setForm(p => ({ ...p, tx_chain: val }))}>
              <Select.Trigger className="w-full" />
              <Select.Content>
                {CHAINS.map(c => <Select.Item key={c.id} value={c.id}>{c.name}</Select.Item>)}
              </Select.Content>
            </Select.Root>
          </div>
        </div>
      </div>
      <ModalActions onClose={onClose} onSave={handleSave} saving={saving} label={isEdit ? 'Save Changes' : 'Add Invoice'} />
    </ModalWrap>
  );
}

// ─── Main BudgetPanel ──────────────────────────────────────────────────────────

export default function BudgetPanel() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [quarters, setQuarters] = useState<Quarter[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeQuarterId, setActiveQuarterId] = useState<string | null>(null);
  const [overallStats, setOverallStats] = useState<any>(null);

  // Modals
  const [quarterModal, setQuarterModal] = useState<{ mode: 'create' | 'edit'; data?: Quarter } | null>(null);
  const [categoryModal, setCategoryModal] = useState<{ mode: 'create' | 'edit'; data?: Category } | null>(null);
  const [invoiceModal, setInvoiceModal] = useState<{ mode: 'create' | 'edit'; data?: Invoice } | null>(null);
  const [pdfPreview, setPdfPreview] = useState<Invoice | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'quarter' | 'category' | 'invoice'; id: string; label: string } | null>(null);

  // Invoice list state
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid' | 'cancelled'>('all');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [showAllQuarters, setShowAllQuarters] = useState(false);

  // Quarter drill-down
  const [drillQuarterId, setDrillQuarterId] = useState<string | null>(null);
  const [drillCategories, setDrillCategories] = useState<Category[]>([]);
  const [drillLoading, setDrillLoading] = useState(false);

  // Excel import
  type ImportPreview = {
    year: number; totalBudget: number;
    quarterlyView: { name: string; startDate: string; endDate: string; categories: { name: string; planned: number; color: string }[] }[];
    annualView:    { name: string; startDate: string; endDate: string; categories: { name: string; planned: number; color: string }[] }[];
  };
  const [importModal, setImportModal] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importMode, setImportMode] = useState<'quarterly' | 'annual'>('quarterly');
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);

  // ── Data loading ─────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [qRes, iAllRes, overallRes] = await Promise.all([
        fetch('/api/budget?resource=quarters').then(r => r.json()),
        fetch('/api/budget?resource=invoices&limit=1000').then(r => r.json()),
        fetch('/api/budget?resource=overall').then(r => r.json()),
      ]);

      const qs: Quarter[] = qRes.quarters || [];
      setQuarters(qs);
      setAllInvoices(iAllRes.invoices || []);
      setOverallStats(overallRes.totals || null);

      // Set active quarter (prefer active status, else most recent)
      if (!activeQuarterId || !qs.find(q => q.id === activeQuarterId)) {
        const active = qs.find(q => q.status === 'active') || qs[0];
        setActiveQuarterId(active?.id || null);
      }
    } finally {
      setLoading(false);
    }
  }, [activeQuarterId]);

  const loadQuarterData = useCallback(async (qid: string | null) => {
    if (!qid) { setCategories([]); setInvoices([]); return; }
    const [cRes, iRes] = await Promise.all([
      fetch(`/api/budget?resource=categories&quarter_id=${qid}`).then(r => r.json()),
      fetch(`/api/budget?resource=invoices&quarter_id=${qid}&limit=500`).then(r => r.json()),
    ]);
    setCategories(cRes.categories || []);
    setInvoices(iRes.invoices || []);
  }, []);

  useEffect(() => { load(); }, []);
  useEffect(() => { loadQuarterData(activeQuarterId); }, [activeQuarterId, loadQuarterData]);

  useEffect(() => {
    if (!drillQuarterId) { setDrillCategories([]); return; }
    setDrillLoading(true);
    fetch(`/api/budget?resource=categories&quarter_id=${drillQuarterId}`)
      .then(r => r.json())
      .then(d => setDrillCategories(d.categories || []))
      .catch(() => setDrillCategories([]))
      .finally(() => setDrillLoading(false));
  }, [drillQuarterId]);

  // ── Quarter handlers ──────────────────────────────────────────────────────────

  async function handleSaveQuarter(d: Partial<Quarter>) {
    const method = d.id ? 'PATCH' : 'POST';
    const body = d.id ? { resource: 'quarter', id: d.id, ...d } : { resource: 'quarter', ...d };
    const res = await fetch('/api/budget', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    if (!d.id) setActiveQuarterId(data.quarter.id);
    await load();
    setQuarterModal(null);
    showToast('success', d.id ? 'Quarter updated' : 'Quarter created');
  }

  async function handleDeleteQuarter(id: string) {
    await fetch(`/api/budget?resource=quarter&id=${id}`, { method: 'DELETE' });
    if (activeQuarterId === id) setActiveQuarterId(null);
    await load();
    setConfirmDelete(null);
    showToast('success', 'Quarter deleted');
  }

  // ── Category handlers ─────────────────────────────────────────────────────────

  async function handleSaveCategory(d: Partial<Category>) {
    const method = d.id ? 'PATCH' : 'POST';
    const body = d.id ? { resource: 'category', id: d.id, ...d } : { resource: 'category', ...d };
    const res = await fetch('/api/budget', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(await res.text());
    await loadQuarterData(activeQuarterId);
    setCategoryModal(null);
    showToast('success', d.id ? 'Category updated' : 'Category created');
  }

  async function handleDeleteCategory(id: string) {
    await fetch(`/api/budget?resource=category&id=${id}`, { method: 'DELETE' });
    await loadQuarterData(activeQuarterId);
    setConfirmDelete(null);
    showToast('success', 'Category deleted');
  }

  // ── Invoice handlers ──────────────────────────────────────────────────────────

  async function handleSaveInvoice(d: Partial<Invoice>, file?: File) {
    const method = d.id ? 'PATCH' : 'POST';
    const body = d.id ? { resource: 'invoice', id: d.id, ...d } : { resource: 'invoice', ...d };
    const res = await fetch('/api/budget', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      if (res.status === 409) throw Object.assign(new Error(errData.message || 'Duplicate'), { status: 409 });
      throw new Error(errData.error || 'Save failed');
    }
    const result = await res.json();
    const savedId = result.invoice?.id || d.id;

    // Upload file if provided
    if (file && savedId) {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('invoice_id', savedId);
      await fetch('/api/budget/upload', { method: 'POST', body: fd });
    }

    await Promise.all([loadQuarterData(activeQuarterId), load()]);
    setInvoiceModal(null);
    showToast('success', d.id ? 'Invoice updated' : 'Invoice created');
  }

  async function handleDeleteInvoice(id: string) {
    await fetch(`/api/budget?resource=invoice&id=${id}`, { method: 'DELETE' });
    await fetch(`/api/budget/upload?id=${id}`, { method: 'DELETE' }).catch(() => {});
    await Promise.all([loadQuarterData(activeQuarterId), load()]);
    setConfirmDelete(null);
    showToast('success', 'Invoice deleted');
  }

  async function handleInvoiceStatus(id: string, status: string) {
    await fetch('/api/budget', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resource: 'invoice', id, status }),
    });
    await loadQuarterData(activeQuarterId);
  }

  // ── Bulk invoice handlers ─────────────────────────────────────────────────────

  async function handleBulkStatus(status: string) {
    if (!selectedIds.size) return;
    setBulkLoading(true);
    try {
      await fetch('/api/budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resource: 'bulk-invoices', action: 'status', ids: Array.from(selectedIds), status }),
      });
      setSelectedIds(new Set());
      await loadQuarterData(activeQuarterId);
      showToast('success', `Updated ${selectedIds.size} invoices`);
    } finally { setBulkLoading(false); }
  }

  async function handleBulkDelete() {
    if (!selectedIds.size) return;
    setBulkLoading(true);
    try {
      await fetch('/api/budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resource: 'bulk-invoices', action: 'delete', ids: Array.from(selectedIds) }),
      });
      setSelectedIds(new Set());
      await Promise.all([loadQuarterData(activeQuarterId), load()]);
      showToast('success', `Deleted ${selectedIds.size} invoices`);
    } finally { setBulkLoading(false); }
  }

  // ── Global drag-drop for invoices page ───────────────────────────────────────

  const [globalDragging, setGlobalDragging] = useState(false);
  const [processingFiles, setProcessingFiles] = useState<string[]>([]);

  async function handleGlobalDrop(files: FileList) {
    if (!activeQuarterId) { showToast('error', 'No active quarter selected'); return; }
    const allowed = Array.from(files).filter(f =>
      ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(f.type)
    );
    if (!allowed.length) { showToast('error', 'Only PDF and image files supported'); return; }

    setProcessingFiles(allowed.map(f => f.name));
    let success = 0; let failed = 0;

    for (const file of allowed) {
      try {
        // Extract data with Gemini
        const fd = new FormData();
        fd.append('file', file);
        const extractRes = await fetch('/api/budget/extract', { method: 'POST', body: fd });
        const extractData = extractRes.ok ? await extractRes.json() : null;
        const ex = extractData?.extracted || {};

        // Create invoice
        const invoiceBody = {
          resource: 'invoice', quarter_id: activeQuarterId,
          title: ex.title || file.name.replace(/\.[^.]+$/, ''),
          invoice_number: ex.invoice_number || null,
          vendor: ex.vendor || null,
          amount: ex.amount || 0,
          currency: ex.currency || activeQuarter?.currency || 'USD',
          date: ex.date ? new Date(ex.date).getTime() : Date.now(),
          description: ex.description || null,
          status: 'pending',
        };
        const createRes = await fetch('/api/budget', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(invoiceBody),
        });
        if (!createRes.ok) { failed++; continue; }
        const { invoice } = await createRes.json();

        // Upload file
        const uploadFd = new FormData();
        uploadFd.append('file', file);
        uploadFd.append('invoice_id', invoice.id);
        await fetch('/api/budget/upload', { method: 'POST', body: uploadFd });
        success++;
      } catch { failed++; }
    }

    setProcessingFiles([]);
    await Promise.all([loadQuarterData(activeQuarterId), load()]);
    if (success) showToast('success', `${success} invoice${success > 1 ? 's' : ''} imported`, failed ? `${failed} failed` : undefined);
    else showToast('error', 'Import failed');
  }

  // ── Excel import handlers ─────────────────────────────────────────────────────

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setIsImporting(true);
    setImportStatus('AI analyzing budget structure…');
    setImportPreview(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/budget/import', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.ok && data.preview) {
        setImportPreview(data.preview);
        setImportStatus(null);
      } else {
        setImportStatus(data.error || 'AI analysis failed. Please try again.');
      }
    } catch {
      setImportStatus('Error reading file. Please try again.');
    }
    setIsImporting(false);
  }

  async function handleConfirmImport() {
    if (!importPreview) return;
    const qs = importMode === 'quarterly' ? importPreview.quarterlyView : importPreview.annualView;
    setIsImporting(true);
    let lastId: string | null = null;
    let totalCats = 0;
    try {
      for (let i = 0; i < qs.length; i++) {
        const q = qs[i];
        setImportStatus(`Creating ${q.name}… (${i + 1}/${qs.length})`);
        const qMatch = q.name.match(/Q(\d)/);
        const quarterNum = qMatch ? parseInt(qMatch[1]) : 1;
        const yearMatch = q.name.match(/(\d{4})/);
        const year = yearMatch ? parseInt(yearMatch[1]) : importPreview.year;
        const total = q.categories.reduce((s, c) => s + c.planned, 0);
        const qRes = await fetch('/api/budget', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            resource: 'quarter', name: q.name, year, quarter: quarterNum,
            start_date: q.startDate, end_date: q.endDate,
            total_budget: total, status: 'planning', notes: 'Imported from Excel',
          }),
        });
        if (!qRes.ok) continue;
        const { quarter: newQ } = await qRes.json();
        lastId = newQ.id;
        for (const cat of q.categories) {
          await fetch('/api/budget', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              resource: 'category', quarter_id: newQ.id,
              name: cat.name, planned: cat.planned, color: cat.color, cac: 0,
            }),
          });
          totalCats++;
        }
      }
      if (lastId) setActiveQuarterId(lastId);
      await load();
      showToast('success', `Imported ${qs.length} quarter${qs.length > 1 ? 's' : ''} with ${totalCats} categories`);
      setTimeout(() => { setImportModal(false); setImportPreview(null); setImportStatus(null); setTab('dashboard'); }, 800);
    } catch {
      setImportStatus('Error creating quarters. Please try again.');
    }
    setIsImporting(false);
  }

  // ── CSV export ────────────────────────────────────────────────────────────────

  function exportInvoicesCSV() {
    const rows = displayInvoices;
    const headers = ['Invoice #', 'Title', 'Vendor', 'Amount', 'Currency', 'Date', 'Status', 'Category', 'Description', 'TX Hash', 'TX Chain'];
    const lines = [
      headers.join(','),
      ...rows.map(inv => [
        inv.invoice_number || '',
        `"${(inv.title || '').replace(/"/g, '""')}"`,
        `"${(inv.vendor || '').replace(/"/g, '""')}"`,
        inv.amount,
        inv.currency,
        fmtDate(inv.date),
        inv.status,
        `"${(inv.category_name || '').replace(/"/g, '""')}"`,
        `"${(inv.description || '').replace(/"/g, '""')}"`,
        inv.tx_hash || '',
        inv.tx_chain || '',
      ].join(',')),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoices-${activeQuarter?.name || 'all'}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Derived data ──────────────────────────────────────────────────────────────

  const activeQuarter = quarters.find(q => q.id === activeQuarterId) || null;
  const currency = activeQuarter?.currency || 'USD';

  const displayInvoices = useMemo(() => {
    const src = showAllQuarters ? allInvoices : invoices;
    return src.filter(inv => {
      if (statusFilter !== 'all' && inv.status !== statusFilter) return false;
      if (categoryFilter && inv.category_id !== categoryFilter) return false;
      if (invoiceSearch) {
        const q = invoiceSearch.toLowerCase();
        return inv.title.toLowerCase().includes(q) ||
          inv.vendor?.toLowerCase().includes(q) ||
          inv.invoice_number?.toLowerCase().includes(q) ||
          inv.description?.toLowerCase().includes(q);
      }
      return true;
    });
  }, [invoices, allInvoices, showAllQuarters, statusFilter, categoryFilter, invoiceSearch]);

  const chartData = useMemo(() => categories.map(c => ({
    name: c.name.length > 12 ? `${c.name.slice(0, 12)}…` : c.name,
    Planned: c.planned, Actual: c.actual || 0, fill: c.color,
  })), [categories]);

  const pieData = useMemo(() =>
    categories.filter(c => (c.actual || 0) > 0).map(c => ({ name: c.name, value: c.actual || 0, fill: c.color })),
    [categories]);

  const qTotals = useMemo(() => {
    const actual = invoices.filter(i => i.status !== 'cancelled').reduce((s, i) => s + i.amount, 0);
    const paid = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0);
    const pending = invoices.filter(i => i.status === 'pending').reduce((s, i) => s + i.amount, 0);
    const planned = activeQuarter?.total_budget || 0;
    const remaining = planned - actual;
    const usedPct = pct(actual, planned);
    return { actual, paid, pending, planned, remaining, usedPct };
  }, [invoices, activeQuarter]);

  // Drill-down derived data
  const drillQuarter = useMemo(() =>
    drillQuarterId ? quarters.find(q => q.id === drillQuarterId) ?? null : null,
    [drillQuarterId, quarters]);

  const drillInvoices = useMemo(() =>
    drillQuarterId ? allInvoices.filter(i => i.quarter_id === drillQuarterId) : [],
    [drillQuarterId, allInvoices]);

  const drillChartData = useMemo(() => drillCategories.map(c => ({
    name: c.name.length > 12 ? `${c.name.slice(0, 12)}…` : c.name,
    Planned: c.planned, Actual: c.actual || 0, fill: c.color,
  })), [drillCategories]);

  const drillPieData = useMemo(() =>
    drillCategories.filter(c => (c.actual || 0) > 0).map(c => ({
      name: c.name, value: c.actual || 0, fill: c.color,
    })), [drillCategories]);

  // Year-by-year breakdown for Level 1
  const yearGroups = useMemo(() => {
    const byYear: Record<number, { year: number; count: number; planned: number; actual: number }> = {};
    quarters.forEach(q => {
      if (!byYear[q.year]) byYear[q.year] = { year: q.year, count: 0, planned: 0, actual: 0 };
      byYear[q.year].count++;
      byYear[q.year].planned += q.total_budget;
      byYear[q.year].actual += q.actual || 0;
    });
    return Object.values(byYear).sort((a, b) => b.year - a.year);
  }, [quarters]);

  // Top vendors per category for categories tab
  const catVendors = useMemo(() => {
    const map: Record<string, { vendor: string; amount: number }[]> = {};
    allInvoices.filter(i => i.status !== 'cancelled' && i.vendor && i.category_id).forEach(inv => {
      if (!map[inv.category_id!]) map[inv.category_id!] = [];
      const existing = map[inv.category_id!].find(v => v.vendor === inv.vendor);
      if (existing) existing.amount += inv.amount;
      else map[inv.category_id!].push({ vendor: inv.vendor!, amount: inv.amount });
    });
    Object.keys(map).forEach(k => map[k].sort((a, b) => b.amount - a.amount));
    return map;
  }, [allInvoices]);

  if (loading && !quarters.length) {
    return (
      <Flex align="center" justify="center" gap="2" className="h-full text-mission-control-text-dim">
        <RefreshCw size={16} className="animate-spin" />
        <span className="text-sm">Loading…</span>
      </Flex>
    );
  }

  const tabItems = [
    { id: 'dashboard' as Tab, label: 'Dashboard', icon: BarChart3 },
    { id: 'invoices'  as Tab, label: 'Invoices',  icon: FileText },
    { id: 'categories'as Tab, label: 'Categories',icon: Layers },
    { id: 'chat'      as Tab, label: 'Finance Agent', icon: Bot },
  ];

  return (
    <div className="flex h-full flex-col bg-mission-control-bg overflow-hidden">
      {/* ── Header ── */}
      <div className="border-b border-mission-control-border bg-mission-control-surface shrink-0">
        <Flex align="center" justify="between" className="px-4 py-3">
          <Flex align="center" gap="2">
            <Wallet size={16} className="text-mission-control-accent" />
            <span className="text-sm font-semibold text-mission-control-text">Budget</span>
          </Flex>

          {quarters.length > 0 && (
            <Select.Root value={activeQuarterId || ''} onValueChange={val => setActiveQuarterId(val)}>
              <Select.Trigger />
              <Select.Content>
                {quarters.map(q => (
                  <Select.Item key={q.id} value={q.id}>{q.name} ({q.status})</Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
          )}

          <Flex align="center" gap="2">
            {activeQuarterId && (
              <button type="button" className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors" onClick={() => setQuarterModal({ mode: 'edit', data: activeQuarter || undefined })} title="Edit quarter">
                <Pencil size={13} />
              </button>
            )}
            <button type="button" className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors" onClick={() => load()} title="Refresh">
              <RefreshCw size={14} />
            </button>
            <button type="button" className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors" onClick={() => { setImportModal(true); setImportPreview(null); setImportStatus(null); }} title="Import budget from Excel">
              <Upload size={12} /> Import
            </button>
            <Button variant="solid" size="1" onClick={() => setQuarterModal({ mode: 'create' })}>
              <Plus size={12} /> New Quarter
            </Button>
          </Flex>
        </Flex>

        {/* Tabs */}
        <div className="flex px-4">
          {tabItems.map(t => (
            <button key={t.id} type="button" onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
                tab === t.id ? 'border-mission-control-accent text-mission-control-accent' : 'border-transparent text-mission-control-text-dim hover:text-mission-control-text'
              }`}
            >
              <t.icon size={13} /> {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-hidden">

        {/* ─────────────── DASHBOARD ─────────────── */}
        {tab === 'dashboard' && (
          <div className="h-full overflow-y-auto p-6 space-y-6">

            {/* ── Quarter Drill-down ── */}
            {drillQuarterId && drillQuarter ? (() => {
              const dActual = drillQuarter.actual || 0;
              const dPaid = drillQuarter.paid || 0;
              const dPending = drillQuarter.pending || 0;
              const dPlanned = drillQuarter.total_budget;
              const dRemaining = dPlanned - dActual;
              const dUsedPct = pct(dActual, dPlanned);
              const dCur = drillQuarter.currency;
              return (
                <>
                  {/* Breadcrumb */}
                  <Flex align="center" justify="between">
                    <button type="button" className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors" onClick={() => setDrillQuarterId(null)}>
                      <ChevronLeft size={14} /> All Quarters
                    </button>
                    <Flex align="center" gap="2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        drillQuarter.status === 'active' ? 'bg-success/10 text-success' : drillQuarter.status === 'closed' ? 'bg-mission-control-border/40 text-mission-control-text-dim' : 'bg-info/10 text-info'
                      }`}>{drillQuarter.status}</span>
                      <button type="button" onClick={() => setQuarterModal({ mode: 'edit', data: drillQuarter })} title="Edit quarter" className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors">
                        <Pencil size={12} />
                      </button>
                      <button type="button" className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors" onClick={() => setConfirmDelete({ type: 'quarter', id: drillQuarter.id, label: drillQuarter.name })} title="Delete quarter">
                        <Trash2 size={12} />
                      </button>
                    </Flex>
                  </Flex>

                  {/* Quarter header */}
                  <div>
                    <h2 className="text-base font-semibold text-mission-control-text">{drillQuarter.name}</h2>
                    <p className="text-xs text-mission-control-text-dim mt-0.5">
                      {new Date(drillQuarter.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      {' – '}
                      {new Date(drillQuarter.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      {drillQuarter.notes && <> · <span className="italic">{drillQuarter.notes}</span></>}
                    </p>
                  </div>

                  {drillLoading ? (
                    <Flex align="center" justify="center" gap="2" className="py-8 text-mission-control-text-dim text-sm">
                      <RefreshCw size={14} className="animate-spin" /> Loading…
                    </Flex>
                  ) : (
                    <>
                      {/* Stat cards */}
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <StatCard label="Planned Budget" value={fmt(dPlanned, dCur)} sub={`Q${drillQuarter.quarter} ${drillQuarter.year}`} icon={Target} accent="var(--mission-control-accent)" />
                        <StatCard label="Spent to Date" value={fmt(dActual, dCur)} sub={`${dUsedPct}% of budget`} icon={DollarSign} accent={progressColor(dUsedPct)} />
                        <StatCard label="Remaining" value={fmt(Math.max(dRemaining, 0), dCur)} sub={dRemaining < 0 ? 'Over budget!' : `${100 - dUsedPct}% left`} icon={dRemaining >= 0 ? TrendingDown : AlertTriangle} accent={dRemaining < 0 ? 'var(--color-error)' : 'var(--color-info)'} />
                        <StatCard label="Pending" value={fmt(dPending, dCur)} sub={`${drillInvoices.filter(i => i.status === 'pending').length} invoices`} icon={Clock} accent="var(--color-warning)" />
                      </div>

                      {/* Burn rate */}
                      {dPlanned > 0 && (
                        <div className="rounded-xl border border-mission-control-border bg-mission-control-surface p-4">
                          <Flex align="center" justify="between" className="text-xs mb-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim">Budget Utilization</span>
                            <span className="font-semibold" style={{ color: progressColor(dUsedPct) }}>{dUsedPct}%</span>
                          </Flex>
                          <ProgressBar value={dUsedPct} color={progressColor(dUsedPct)} />
                          <Flex justify="between" className="text-[10px] text-mission-control-text-dim mt-1">
                            <span>{fmt(dPaid, dCur)} paid</span>
                            <span>{fmt(dPending, dCur)} pending</span>
                            <span>{fmt(Math.max(dRemaining, 0), dCur)} remaining</span>
                          </Flex>
                        </div>
                      )}

                      {/* Charts */}
                      {drillChartData.length > 0 && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          <div className="rounded-xl border border-mission-control-border bg-mission-control-surface p-4">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mb-3 flex items-center gap-1.5">
                              <BarChart3 size={11} className="text-mission-control-accent" /> Planned vs Actual
                            </div>
                            <ResponsiveContainer width="100%" height={180}>
                              <BarChart data={drillChartData} barGap={2} barCategoryGap="30%">
                                <XAxis dataKey="name" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                                <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={v => `${(Number(v) / 1000).toFixed(0)}k`} />
                                <Tooltip formatter={(v: unknown) => fmt(Number(v ?? 0), dCur)} contentStyle={{ fontSize: 11, background: 'var(--mission-control-surface, #141414)', border: '1px solid var(--mission-control-border)', borderRadius: 8 }} />
                                <Bar dataKey="Planned" fill="var(--mission-control-border)" radius={[3, 3, 0, 0]} />
                                <Bar dataKey="Actual" radius={[3, 3, 0, 0]}>
                                  {drillChartData.map((_, i) => <Cell key={i} fill={drillChartData[i].fill} />)}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                          {drillPieData.length > 0 && (
                            <div className="rounded-xl border border-mission-control-border bg-mission-control-surface p-4">
                              <div className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mb-3 flex items-center gap-1.5">
                                <PieChartIcon size={11} className="text-mission-control-accent" /> Spend Breakdown
                              </div>
                              <ResponsiveContainer width="100%" height={180}>
                                <RePieChart>
                                  <Pie data={drillPieData} dataKey="value" cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={2}>
                                    {drillPieData.map((_, i) => <Cell key={i} fill={drillPieData[i].fill} />)}
                                  </Pie>
                                  <Tooltip formatter={(v: unknown) => fmt(Number(v ?? 0), dCur)} contentStyle={{ fontSize: 11, background: 'var(--mission-control-surface, #141414)', border: '1px solid var(--mission-control-border)', borderRadius: 8 }} />
                                  <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                                </RePieChart>
                              </ResponsiveContainer>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Category allocation */}
                      {drillCategories.length > 0 && (
                        <div className="rounded-xl border border-mission-control-border bg-mission-control-surface">
                          <div className="px-4 py-3 border-b border-mission-control-border">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim">Budget Allocation</span>
                          </div>
                          <div className="divide-y divide-mission-control-border/50">
                            {drillCategories.map(cat => {
                              const usedP = pct(cat.actual || 0, cat.planned);
                              const rem = cat.planned - (cat.actual || 0);
                              return (
                                <div key={cat.id} className="px-4 py-3">
                                  <Flex align="center" gap="3" className="mb-1.5">
                                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                                    <span className="text-xs font-medium text-mission-control-text flex-1">{cat.name}</span>
                                    <span className="text-[10px] text-mission-control-text-dim shrink-0">{cat.invoice_count || 0} inv</span>
                                    <span className="text-xs text-mission-control-text-dim shrink-0">{fmt(cat.actual || 0, dCur)} / {fmt(cat.planned, dCur)}</span>
                                    <span className="text-[10px] font-semibold w-10 text-right shrink-0" style={{ color: progressColor(usedP) }}>{usedP}%</span>
                                  </Flex>
                                  <ProgressBar value={usedP} color={progressColor(usedP)} />
                                  {cat.cac > 0 && (
                                    <div className="mt-1 text-[10px] text-mission-control-text-dim">
                                      CAC {fmt(cat.cac, dCur)} · ~{Math.floor(cat.planned / cat.cac).toLocaleString()} projected users{rem > 0 ? ` · ${fmt(rem, dCur)} remaining` : ' · Over budget'}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          <Flex align="center" gap="3" className="px-4 py-2.5 border-t border-mission-control-border text-xs">
                            <span className="flex-1 font-medium text-mission-control-text">Total</span>
                            <span className="text-mission-control-text-dim">{fmt(dActual, dCur)} / {fmt(dPlanned, dCur)}</span>
                            <span className="font-semibold w-10 text-right" style={{ color: progressColor(dUsedPct) }}>{dUsedPct}%</span>
                          </Flex>
                        </div>
                      )}

                      {/* Recent invoices */}
                      {drillInvoices.length > 0 && (
                        <div className="rounded-xl border border-mission-control-border bg-mission-control-surface">
                          <Flex align="center" justify="between" className="px-4 py-3 border-b border-mission-control-border">
                            <span className="text-xs font-semibold text-mission-control-text">Invoices ({drillInvoices.length})</span>
                            <button type="button" onClick={() => { setActiveQuarterId(drillQuarter.id); setTab('invoices'); setDrillQuarterId(null); }} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors">
                              View All <ChevronLeft size={10} className="rotate-180" />
                            </button>
                          </Flex>
                          <div className="divide-y divide-mission-control-border/50 max-h-64 overflow-y-auto">
                            {drillInvoices.slice(0, 20).map(inv => (
                              <Flex key={inv.id} align="center" gap="3" className="px-4 py-2.5 text-xs">
                                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: inv.category_color || 'var(--mission-control-accent)' }} />
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-mission-control-text truncate">{inv.title}</div>
                                  {inv.vendor && <div className="text-[10px] text-mission-control-text-dim">{inv.vendor}</div>}
                                </div>
                                <span className="font-medium text-mission-control-text shrink-0">{fmt(inv.amount, inv.currency)}</span>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border shrink-0 ${STATUS_CFG[inv.status].cls}`}>
                                  {STATUS_CFG[inv.status].label}
                                </span>
                              </Flex>
                            ))}
                            {drillInvoices.length > 20 && (
                              <div className="px-4 py-2 text-center text-[10px] text-mission-control-text-dim">
                                +{drillInvoices.length - 20} more — click View All
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Quick actions */}
                      <div className="flex flex-wrap gap-2 pb-2">
                        <Button variant="solid" size="1" onClick={() => { setActiveQuarterId(drillQuarter.id); setInvoiceModal({ mode: 'create' }); }}>
                          <Plus size={12} /> Add Invoice
                        </Button>
                        <button type="button" onClick={() => { setActiveQuarterId(drillQuarter.id); setTab('categories'); setCategoryModal({ mode: 'create' }); setDrillQuarterId(null); }} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors">
                          <Plus size={12} /> Add Category
                        </button>
                        <button type="button" onClick={() => { setActiveQuarterId(drillQuarter.id); setTab('invoices'); setDrillQuarterId(null); }} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors">
                          <FileText size={12} /> Manage Invoices
                        </button>
                        <button type="button" onClick={() => setTab('chat')} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors">
                          <Bot size={12} /> Finance Agent
                        </button>
                      </div>
                    </>
                  )}
                </>
              );
            })() : (
              <>
                {/* ── Lifetime stat row ── */}
                {overallStats && (
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <StatCard label="Total Quarters" value={String(overallStats.quarter_count || 0)} sub="all time" icon={Layers} accent="var(--mission-control-accent)" />
                    <StatCard label="Total Planned" value={fmt(overallStats.total_planned || 0, 'USD')} sub="across all quarters" icon={Target} accent="var(--color-info)" />
                    <StatCard
                      label="Total Spent"
                      value={fmt(overallStats.total_actual || 0, 'USD')}
                      sub={`${pct(overallStats.total_actual || 0, overallStats.total_planned || 0)}% of planned`}
                      icon={DollarSign}
                      accent={progressColor(pct(overallStats.total_actual || 0, overallStats.total_planned || 0))}
                    />
                    <StatCard
                      label="Remaining"
                      value={fmt(Math.max((overallStats.total_planned || 0) - (overallStats.total_actual || 0), 0), 'USD')}
                      sub={`${overallStats.invoice_count || 0} total invoices`}
                      icon={TrendingDown}
                      accent="var(--color-info)"
                    />
                  </div>
                )}

                {/* ── Year-by-year breakdown ── */}
                {yearGroups.length > 1 && (
                  <div className="rounded-xl border border-mission-control-border bg-mission-control-surface p-4">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mb-3 flex items-center gap-1.5">
                      <BarChart3 size={11} className="text-mission-control-accent" /> Year by Year
                    </div>
                    <div className="space-y-2.5">
                      {yearGroups.map(yg => {
                        const yPct = pct(yg.actual, yg.planned);
                        return (
                          <Flex key={yg.year} align="center" gap="3" className="text-xs">
                            <span className="w-10 font-semibold text-mission-control-text shrink-0">{yg.year}</span>
                            <span className="w-10 text-mission-control-text-dim shrink-0">{yg.count} Q</span>
                            <div className="flex-1"><ProgressBar value={yPct} color={progressColor(yPct)} /></div>
                            <span className="text-mission-control-text-dim w-28 text-right shrink-0">{fmt(yg.actual)} / {fmt(yg.planned)}</span>
                            <span className="w-8 text-right shrink-0 font-medium" style={{ color: progressColor(yPct) }}>{yPct}%</span>
                          </Flex>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ── Quarter cards grid ── */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {quarters.map(q => {
                    const qPct = pct(q.actual || 0, q.total_budget);
                    const qRemaining = q.total_budget - (q.actual || 0);
                    return (
                      <div
                        key={q.id}
                        onClick={() => setDrillQuarterId(q.id)}
                        className={`rounded-xl border bg-mission-control-surface p-4 cursor-pointer hover:border-mission-control-accent/50 transition-colors group relative ${
                          q.id === activeQuarterId ? 'border-mission-control-accent/60' : 'border-mission-control-border'
                        }`}
                      >
                        {/* Card header */}
                        <Flex align="start" justify="between" className="mb-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-sm font-semibold text-mission-control-text">{q.name}</h3>
                              {q.id === activeQuarterId && (
                                <span className="px-1.5 py-0.5 text-[9px] font-semibold bg-mission-control-accent/15 text-mission-control-accent rounded-full">Current</span>
                              )}
                              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                                q.status === 'active' ? 'bg-success/10 text-success' :
                                q.status === 'closed' ? 'bg-mission-control-border/40 text-mission-control-text-dim' :
                                'bg-info/10 text-info'
                              }`}>{q.status}</span>
                            </div>
                            <p className="text-[10px] text-mission-control-text-dim mt-0.5">
                              {new Date(q.start_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              {' – '}
                              {new Date(q.end_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </p>
                          </div>
                          <Flex gap="1" className="shrink-0 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button type="button" onClick={e => { e.stopPropagation(); setActiveQuarterId(q.id); setQuarterModal({ mode: 'edit', data: q }); }} title="Edit" className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors">
                              <Pencil size={11} />
                            </button>
                            <button type="button" className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors" onClick={e => { e.stopPropagation(); setConfirmDelete({ type: 'quarter', id: q.id, label: q.name }); }} title="Delete">
                              <Trash2 size={11} />
                            </button>
                          </Flex>
                        </Flex>

                        {/* Stats */}
                        <div className="grid grid-cols-3 gap-2 text-center mb-3">
                          <div>
                            <div className="text-[10px] text-mission-control-text-dim">Planned</div>
                            <div className="text-xs font-semibold text-mission-control-text">{fmt(q.total_budget, q.currency)}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-mission-control-text-dim">Spent</div>
                            <div className="text-xs font-semibold text-mission-control-text">{fmt(q.actual || 0, q.currency)}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-mission-control-text-dim">Remaining</div>
                            <div className={`text-xs font-semibold ${qRemaining < 0 ? 'text-error' : 'text-success'}`}>
                              {fmt(Math.abs(qRemaining), q.currency)}{qRemaining < 0 ? ' over' : ''}
                            </div>
                          </div>
                        </div>

                        {/* Progress */}
                        <ProgressBar value={qPct} color={progressColor(qPct)} />
                        <Flex justify="between" className="text-[10px] text-mission-control-text-dim mt-1">
                          <span>{qPct}% used</span>
                          <span>{q.invoice_count || 0} invoices</span>
                        </Flex>

                        {q.notes && (
                          <p className="text-[10px] text-mission-control-text-dim italic mt-2 border-t border-mission-control-border/50 pt-2 truncate">{q.notes}</p>
                        )}
                      </div>
                    );
                  })}

                  {/* New Quarter card */}
                  <button
                    type="button"
                    onClick={() => setQuarterModal({ mode: 'create' })}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors rounded-xl border-2 border-dashed border-mission-control-border hover:border-mission-control-accent/50 hover:bg-mission-control-surface/50 p-4 flex flex-col items-center justify-center gap-2 text-mission-control-text-dim hover:text-mission-control-text transition-colors min-h-[160px] w-full h-full"
                  >
                    <Plus size={24} />
                    <span className="text-sm font-medium">New Quarter</span>
                  </button>
                </div>
              </>
            )}

          </div>
        )}

        {/* ─────────────── INVOICES ─────────────── */}
        {tab === 'invoices' && (
          <div
            className="flex flex-col h-full"
            onDragOver={e => { e.preventDefault(); setGlobalDragging(true); }}
            onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setGlobalDragging(false); }}
            onDrop={e => { e.preventDefault(); setGlobalDragging(false); handleGlobalDrop(e.dataTransfer.files); }}
          >
            {/* Global drag overlay */}
            {globalDragging && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-mission-control-bg/90 border-2 border-dashed border-mission-control-accent rounded-xl m-2">
                <div className="text-center">
                  <Sparkles size={32} className="text-warning mx-auto mb-2" />
                  <div className="text-lg font-semibold text-mission-control-accent">Drop invoices here</div>
                  <div className="text-sm text-mission-control-text-dim">Gemini AI will auto-extract all fields</div>
                </div>
              </div>
            )}

            {/* Processing progress */}
            {processingFiles.length > 0 && (
              <div className="px-4 py-2 bg-mission-control-accent/10 border-b border-mission-control-accent/20 shrink-0">
                <Flex align="center" gap="2" className="text-xs text-mission-control-accent">
                  <Loader2 size={12} className="animate-spin" />
                  Processing {processingFiles.length} file{processingFiles.length > 1 ? 's' : ''}…
                </Flex>
              </div>
            )}

            {/* Toolbar */}
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-mission-control-border/50 bg-mission-control-surface shrink-0 flex-wrap">
              <div className="relative flex-1 min-w-32">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-mission-control-text-dim pointer-events-none z-10" />
                <TextField.Root
                  value={invoiceSearch} onChange={e => setInvoiceSearch(e.target.value)}
                  placeholder="Search invoices…"
                  className="pl-6"
                  size="1"
                />
              </div>

              {/* Status filter */}
              <div className="flex items-center gap-0.5 p-1 rounded-lg bg-mission-control-bg border border-mission-control-border">
                {(['all', 'pending', 'paid', 'cancelled'] as const).map(f => (
                  <button key={f} type="button" onClick={() => setStatusFilter(f)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize transition-colors ${
                      statusFilter === f ? 'bg-mission-control-accent/10 text-mission-control-accent' : 'text-mission-control-text-dim hover:text-mission-control-text'
                    }`}
                  >{f}</button>
                ))}
              </div>

              {/* Category filter */}
              <Select.Root value={categoryFilter || '__all__'} onValueChange={val => setCategoryFilter(val === '__all__' ? '' : val)}>
                <Select.Trigger placeholder="All categories" />
                <Select.Content>
                  <Select.Item value="__all__">All categories</Select.Item>
                  {categories.map(c => <Select.Item key={c.id} value={c.id}>{c.name}</Select.Item>)}
                </Select.Content>
              </Select.Root>

              {/* All quarters toggle */}
              <button
                type="button"
                onClick={() => { setShowAllQuarters(p => !p); setSelectedIds(new Set()); }}
                className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                  showAllQuarters
                    ? 'bg-mission-control-accent/10 border-mission-control-accent/30 text-mission-control-accent'
                    : 'border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text'
                }`}
              >
                {showAllQuarters ? 'All Time' : activeQuarter?.name || 'Quarter'}
              </button>

              <button type="button" className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors" onClick={exportInvoicesCSV} title="Export to CSV">
                <Download size={11} /> Export
              </button>
              <Button variant="solid" size="1" onClick={() => setInvoiceModal({ mode: 'create' })}>
                <Plus size={11} /> Invoice
              </Button>
            </div>

            {/* Bulk action bar */}
            {selectedIds.size > 0 && (
              <Flex align="center" gap="2" className="shrink-0 px-4 py-2.5 bg-mission-control-surface border-b border-mission-control-border text-xs">
                <span className="text-mission-control-text-dim">{selectedIds.size} selected</span>
                <Flex gap="2" className="ml-auto">
                  <Button variant="soft" color="green" size="1" onClick={() => handleBulkStatus('paid')} disabled={bulkLoading}>Mark Paid</Button>
                  <Button variant="soft" color="yellow" size="1" onClick={() => handleBulkStatus('pending')} disabled={bulkLoading}>Mark Pending</Button>
                  <button type="button" className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors" onClick={() => handleBulkStatus('cancelled')} disabled={bulkLoading}>Cancel</button>
                  <Button variant="soft" color="red" size="1" onClick={handleBulkDelete} disabled={bulkLoading}>
                    {bulkLoading ? <Loader2 size={10} className="animate-spin" /> : 'Delete'}
                  </Button>
                  <button type="button" className="inline-flex items-center justify-center w-5 h-5 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors" onClick={() => setSelectedIds(new Set())}>
                    <X size={10} />
                  </button>
                </Flex>
              </Flex>
            )}

            {/* Invoice table */}
            <div className="flex-1 overflow-y-auto">
              {displayInvoices.length === 0 ? (
                <Flex direction="column" align="center" justify="center" gap="3" className="h-40 text-mission-control-text-dim">
                  <FileText size={28} />
                  <p className="text-sm">No invoices found</p>
                  <p className="text-xs">Drop PDF/images here or click + Invoice to add</p>
                </Flex>
              ) : (
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-mission-control-surface border-b border-mission-control-border">
                    <tr>
                      <th className="w-8 px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim">
                        <Checkbox
                          checked={selectedIds.size === displayInvoices.length && displayInvoices.length > 0}
                          onCheckedChange={checked => setSelectedIds(checked ? new Set(displayInvoices.map(i => i.id)) : new Set())}
                          size="1"
                        />
                      </th>
                      {['Invoice', 'Vendor', 'Amount', 'Date', 'Category', 'Status', ''].map(h => (
                        <th key={h} className="px-2 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {displayInvoices.map(inv => {
                      const S = STATUS_CFG[inv.status];
                      const explorerUrl = inv.tx_hash && inv.tx_chain ? getExplorerUrl(inv.tx_hash, inv.tx_chain) : null;
                      return (
                        <tr key={inv.id} className={`border-b border-mission-control-border/40 last:border-0 hover:bg-mission-control-border/10 transition-colors ${selectedIds.has(inv.id) ? 'bg-mission-control-accent/5' : ''}`}>
                          <td className="px-3 py-2">
                            <Checkbox
                              checked={selectedIds.has(inv.id)}
                              onCheckedChange={checked => setSelectedIds(prev => { const n = new Set(prev); checked ? n.add(inv.id) : n.delete(inv.id); return n; })}
                              size="1"
                            />
                          </td>
                          <td className="px-2 py-2 max-w-[200px]">
                            <div className="font-medium text-mission-control-text truncate">{inv.title}</div>
                            {inv.invoice_number && <div className="text-[10px] text-mission-control-text-dim">#{inv.invoice_number}</div>}
                          </td>
                          <td className="px-2 py-2 text-mission-control-text-dim truncate max-w-[120px]">{inv.vendor || '—'}</td>
                          <td className="px-2 py-2 font-medium text-mission-control-text whitespace-nowrap tabular-nums font-mono">
                            {fmt(inv.amount, inv.currency)}
                          </td>
                          <td className="px-2 py-2 text-mission-control-text-dim whitespace-nowrap">{fmtDate(inv.date)}</td>
                          <td className="px-2 py-2">
                            {inv.category_name ? (
                              <span className="flex items-center gap-1 text-[10px]">
                                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: inv.category_color || 'var(--mission-control-accent)' }} />
                                <span className="truncate max-w-[80px]">{inv.category_name}</span>
                              </span>
                            ) : <span className="text-mission-control-text-dim/70">—</span>}
                          </td>
                          <td className="px-2 py-2">
                            <Select.Root value={inv.status} onValueChange={val => handleInvoiceStatus(inv.id, val)}>
                              <Select.Trigger className={`text-[10px] font-medium ${S.cls}`} />
                              <Select.Content>
                                <Select.Item value="pending">Pending</Select.Item>
                                <Select.Item value="paid">Paid</Select.Item>
                                <Select.Item value="cancelled">Cancelled</Select.Item>
                              </Select.Content>
                            </Select.Root>
                          </td>
                          <td className="px-2 py-2">
                            <Flex align="center" gap="1">
                              {inv.file_name && (
                                <button type="button" onClick={() => setPdfPreview(inv)} title="View document" className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors">
                                  <Eye size={11} />
                                </button>
                              )}
                              {explorerUrl && (
                                <a href={explorerUrl} target="_blank" rel="noopener noreferrer" title={`View on explorer: ${truncateHash(inv.tx_hash!)}`}
                                  className="p-1 rounded hover:bg-mission-control-border/50 text-mission-control-text-dim transition-colors">
                                  <Link2 size={11} />
                                </a>
                              )}
                              <button type="button" onClick={() => setInvoiceModal({ mode: 'edit', data: inv })} className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors">
                                <Pencil size={11} />
                              </button>
                              <button type="button" className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors" onClick={() => setConfirmDelete({ type: 'invoice', id: inv.id, label: inv.title })}>
                                <Trash2 size={11} />
                              </button>
                            </Flex>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer stats */}
            <Flex align="center" gap="4" className="shrink-0 px-4 py-2 border-t border-mission-control-border/50 bg-mission-control-surface text-[10px] text-mission-control-text-dim">
              <span>{displayInvoices.length} invoices</span>
              <span>Total: <strong className="text-mission-control-text">{fmt(displayInvoices.filter(i => i.status !== 'cancelled').reduce((s, i) => s + i.amount, 0), currency)}</strong></span>
              <span>Paid: <strong className="text-success">{fmt(displayInvoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0), currency)}</strong></span>
              <span className="ml-auto">Drop PDF/images to bulk-import with AI extraction</span>
            </Flex>
          </div>
        )}

        {/* ─────────────── CATEGORIES ─────────────── */}
        {tab === 'categories' && (
          <div className="h-full overflow-y-auto p-6">
            <Flex align="center" justify="between" className="mb-3">
              <div>
                <h2 className="text-sm font-semibold text-mission-control-text">Categories</h2>
                <p className="text-xs text-mission-control-text-dim">{activeQuarter?.name || 'No quarter selected'}</p>
              </div>
              <Button variant="solid" size="1" onClick={() => setCategoryModal({ mode: 'create' })} disabled={!activeQuarterId}>
                <Plus size={12} /> New Category
              </Button>
            </Flex>

            {/* Tag filter pills */}
            {categories.some(c => c.tags && c.tags.length > 0) && (() => {
              const allTags = Array.from(new Set(categories.flatMap(c => c.tags || []))).sort();
              return (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  <button
                    type="button"
                    onClick={() => setTagFilter('')}
                    className={`px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors ${
                      !tagFilter ? 'bg-mission-control-accent/10 border-mission-control-accent/30 text-mission-control-accent' : 'border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text'
                    }`}
                  >All</button>
                  {allTags.map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTagFilter(tagFilter === t ? '' : t)}
                      className={`px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors ${
                        tagFilter === t ? 'bg-mission-control-accent/10 border-mission-control-accent/30 text-mission-control-accent' : 'border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text'
                      }`}
                    >{t}</button>
                  ))}
                </div>
              );
            })()}

            {categories.length === 0 ? (
              <Flex direction="column" align="center" justify="center" gap="3" className="h-40 text-mission-control-text-dim">
                <Layers size={28} />
                <p className="text-sm">{activeQuarterId ? 'No categories yet' : 'Select a quarter first'}</p>
                {activeQuarterId && (
                  <Button variant="solid" size="1" onClick={() => setCategoryModal({ mode: 'create' })}>
                    <Plus size={12} /> Add Category
                  </Button>
                )}
              </Flex>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categories.filter(cat => !tagFilter || (cat.tags || []).includes(tagFilter)).map(cat => {
                  const usedP = pct(cat.actual || 0, cat.planned);
                  const remaining = cat.planned - (cat.actual || 0);
                  const projectedUsers = cat.cac > 0 ? Math.round(cat.planned / cat.cac) : null;
                  const topVendors = catVendors[cat.id]?.slice(0, 3) || [];
                  const catInvoices = allInvoices.filter(i => i.category_id === cat.id && i.status !== 'cancelled');
                  const paidAmt = catInvoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0);
                  const pendingAmt = catInvoices.filter(i => i.status === 'pending').reduce((s, i) => s + i.amount, 0);
                  return (
                    <div key={cat.id} className="rounded-xl border border-mission-control-border bg-mission-control-surface p-4 flex flex-col gap-3">
                      {/* Header */}
                      <Flex align="start" gap="2">
                        <div className="w-3 h-3 rounded-full shrink-0 mt-0.5" style={{ backgroundColor: cat.color }} />
                        <Box className="flex-1 min-w-0">
                          <div className="font-semibold text-sm text-mission-control-text truncate">{cat.name}</div>
                          <div className="text-[10px] text-mission-control-text-dim">{cat.invoice_count || 0} invoices</div>
                        </Box>
                        <Flex gap="1" className="shrink-0">
                          <button type="button" onClick={() => setCategoryModal({ mode: 'edit', data: cat })} title="Edit" className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"><Pencil size={11} /></button>
                          <button type="button" className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors" onClick={() => setConfirmDelete({ type: 'category', id: cat.id, label: cat.name })} title="Delete"><Trash2 size={11} /></button>
                        </Flex>
                      </Flex>

                      {/* Stats */}
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <div className="text-[10px] text-mission-control-text-dim">Planned</div>
                          <div className="text-xs font-semibold text-mission-control-text">{fmt(cat.planned, currency)}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-mission-control-text-dim">Actual</div>
                          <div className="text-xs font-semibold text-mission-control-text">{fmt(cat.actual || 0, currency)}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-mission-control-text-dim">Remaining</div>
                          <div className={`text-xs font-semibold ${remaining < 0 ? 'text-error' : 'text-success'}`}>{fmt(Math.abs(remaining), currency)}{remaining < 0 ? ' over' : ''}</div>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div>
                        <Flex justify="between" className="text-[10px] mb-1">
                          <span className="text-mission-control-text-dim">{usedP}% used</span>
                          {usedP >= 100 && <span className="text-error font-medium">Over budget!</span>}
                          {usedP >= 80 && usedP < 100 && <span className="text-warning font-medium">Caution</span>}
                        </Flex>
                        <ProgressBar value={usedP} color={progressColor(usedP)} />
                      </div>

                      {/* Paid / Pending split */}
                      {(paidAmt > 0 || pendingAmt > 0) && (
                        <Flex gap="3" className="text-[10px]">
                          <span className="flex items-center gap-1 text-success"><CheckCircle size={9} /> {fmt(paidAmt, currency)} paid</span>
                          <span className="flex items-center gap-1 text-warning"><Clock size={9} /> {fmt(pendingAmt, currency)} pending</span>
                        </Flex>
                      )}

                      {/* CAC / projections */}
                      {cat.cac > 0 && projectedUsers !== null && (
                        <Flex align="center" gap="2" className="text-[10px] text-mission-control-text-dim bg-mission-control-bg rounded-lg px-2.5 py-1.5">
                          <Users size={10} />
                          <span>~{fmtCompact(projectedUsers)} users at {fmt(cat.cac, currency)} CAC</span>
                          {cat.actual && cat.cac > 0 && (
                            <span className="ml-auto text-mission-control-text-dim">
                              {Math.round((cat.actual || 0) / cat.cac).toLocaleString()} acquired
                            </span>
                          )}
                        </Flex>
                      )}

                      {/* Top vendors */}
                      {topVendors.length > 0 && (
                        <div className="border-t border-mission-control-border/50 pt-2">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mb-1.5">Top Vendors</div>
                          <div className="space-y-1">
                            {topVendors.map((v, vi) => {
                              const vPct = pct(v.amount, cat.actual || 1);
                              return (
                                <Flex key={v.vendor} align="center" gap="2" className="text-[10px]">
                                  <span className="w-3 h-3 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0" style={{ backgroundColor: cat.color + '30', color: cat.color }}>
                                    {vi + 1}
                                  </span>
                                  <span className="flex-1 text-mission-control-text truncate">{v.vendor}</span>
                                  <span className="text-mission-control-text-dim shrink-0">{fmt(v.amount, currency)}</span>
                                  <span className="text-mission-control-text-dim shrink-0 w-8 text-right">{vPct}%</span>
                                </Flex>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Tags */}
                      {cat.tags && cat.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {cat.tags.map(t => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => setTagFilter(tagFilter === t ? '' : t)}
                              className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium border transition-colors ${
                                tagFilter === t ? 'bg-mission-control-accent/10 border-mission-control-accent/30 text-mission-control-accent' : 'border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text'
                              }`}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Notes */}
                      {cat.notes && (
                        <div className="text-[10px] text-mission-control-text-dim italic border-t border-mission-control-border/50 pt-2">{cat.notes}</div>
                      )}

                      {/* View invoices action */}
                      <Flex align="center" justify="between" className="border-t border-mission-control-border/50 pt-2">
                        <button type="button" onClick={() => { setCategoryFilter(cat.id); setTab('invoices'); }} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors">
                          <FileText size={10} /> View invoices
                        </button>
                        <button type="button" onClick={() => { setActiveQuarterId(cat.quarter_id); setCategoryFilter(cat.id); setTab('invoices'); setInvoiceModal({ mode: 'create' }); }} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors">
                          <Plus size={10} /> Add invoice
                        </button>
                      </Flex>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ─────────────── CFO AGENT ─────────────── */}
        {tab === 'chat' && (
          <FinanceAgentChat />
        )}
      </div>

      {/* ── Modals ── */}
      {quarterModal && (
        <QuarterModal
          data={quarterModal.data}
          onSave={handleSaveQuarter}
          onClose={() => setQuarterModal(null)}
        />
      )}

      {categoryModal && activeQuarterId && (
        <CategoryModal
          data={categoryModal.data}
          quarterId={activeQuarterId}
          currency={currency}
          onSave={handleSaveCategory}
          onClose={() => setCategoryModal(null)}
        />
      )}

      {invoiceModal && activeQuarterId && (
        <InvoiceModal
          data={invoiceModal.data}
          quarterId={activeQuarterId}
          currency={currency}
          categories={categories}
          allInvoices={allInvoices}
          onSave={handleSaveInvoice}
          onClose={() => setInvoiceModal(null)}
        />
      )}

      {pdfPreview && <PdfPreviewModal invoice={pdfPreview} onClose={() => setPdfPreview(null)} />}

      {/* Import Budget Modal */}
      {importModal && (
        <ModalWrap title="Import Budget from Excel" onClose={() => { setImportModal(false); setImportPreview(null); setImportStatus(null); }} wide>
          <div className="space-y-4">
            {!importPreview ? (
              <div className="space-y-3">
                <p className="text-xs text-mission-control-text-dim">Upload an Excel or CSV file. AI will automatically extract budget categories and quarterly allocations.</p>
                <div
                  onClick={() => importFileRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed border-mission-control-border/60 rounded-xl cursor-pointer hover:border-mission-control-accent/50 hover:bg-mission-control-accent/5 transition-colors"
                >
                  {isImporting ? (
                    <><Loader2 size={24} className="animate-spin text-mission-control-accent" /><span className="text-sm text-mission-control-accent">{importStatus}</span></>
                  ) : (
                    <>
                      <Flex align="center" gap="2"><Upload size={20} className="text-mission-control-text-dim" /><Sparkles size={16} className="text-warning" /></Flex>
                      <div className="text-sm text-mission-control-text">Drop Excel file or click to browse</div>
                      <div className="text-xs text-mission-control-text-dim">Supports .xlsx, .xls, .csv — AI auto-extracts budget structure</div>
                    </>
                  )}
                </div>
                {importStatus && !isImporting && (
                  <p className="text-xs text-error text-center">{importStatus}</p>
                )}
                <input ref={importFileRef} type="file" className="hidden" accept=".xlsx,.xls,.csv"
                  onChange={handleImportFile} />
              </div>
            ) : (
              <div className="space-y-4">
                <Flex align="center" justify="between">
                  <div>
                    <div className="text-sm font-semibold text-mission-control-text">AI extracted budget for {importPreview.year}</div>
                    <div className="text-xs text-mission-control-text-dim">Total: {fmt(importPreview.totalBudget, currency)}</div>
                  </div>
                  <Flex className="rounded-lg border border-mission-control-border overflow-hidden">
                    {(['quarterly', 'annual'] as const).map(m => (
                      <button key={m} type="button" onClick={() => setImportMode(m)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm transition-colors px-3 py-1.5 capitalize rounded-none ${importMode === m ? 'bg-mission-control-accent text-white' : 'text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40'}`}
                      >
                        {m === 'quarterly' ? `Quarterly (${importPreview.quarterlyView.length} quarters)` : `Annual (1 period)`}
                      </button>
                    ))}
                  </Flex>
                </Flex>

                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {(importMode === 'quarterly' ? importPreview.quarterlyView : importPreview.annualView).map(q => (
                    <div key={q.name} className="rounded-lg border border-mission-control-border bg-mission-control-surface p-3">
                      <Flex align="center" justify="between" className="mb-2">
                        <span className="text-xs font-semibold text-mission-control-text">{q.name}</span>
                        <span className="text-xs text-mission-control-text-dim">{fmt(q.categories.reduce((s, c) => s + c.planned, 0), currency)}</span>
                      </Flex>
                      <div className="flex flex-wrap gap-1.5">
                        {q.categories.map(cat => (
                          <span key={cat.name} className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border border-mission-control-border">
                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat.color }} />
                            {cat.name}: {fmt(cat.planned, currency)}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {importStatus && (
                  <div className="text-xs text-mission-control-accent text-center flex items-center justify-center gap-1.5">
                    {isImporting && <Loader2 size={11} className="animate-spin" />}
                    {importStatus}
                  </div>
                )}

                <Flex align="center" justify="end" gap="2" className="pt-1">
                  <button type="button" className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors" onClick={() => setImportPreview(null)}>
                    Back
                  </button>
                  <Button variant="solid" size="1" onClick={handleConfirmImport} disabled={isImporting}>
                    {isImporting ? <><Loader2 size={11} className="animate-spin" /> Importing…</> : <><CheckCircle size={11} /> Import Budget</>}
                  </Button>
                </Flex>
              </div>
            )}
          </div>
        </ModalWrap>
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <ModalWrap title={`Delete ${confirmDelete.type}?`} onClose={() => setConfirmDelete(null)}>
          <div className="space-y-4">
            <Flex align="start" gap="3" className="p-3 bg-error/5 border border-error/20 rounded-lg">
              <AlertTriangle size={16} className="text-error shrink-0 mt-0.5" />
              <div className="text-sm text-mission-control-text">
                <strong>{confirmDelete.label}</strong> will be permanently deleted.
                {confirmDelete.type === 'quarter' && ' This will also delete all categories and invoices in this quarter.'}
                {confirmDelete.type === 'category' && ' Invoices in this category will become uncategorized.'}
              </div>
            </Flex>
            <ModalActions
              onClose={() => setConfirmDelete(null)}
              onSave={() => {
                if (confirmDelete.type === 'quarter') handleDeleteQuarter(confirmDelete.id);
                else if (confirmDelete.type === 'category') handleDeleteCategory(confirmDelete.id);
                else handleDeleteInvoice(confirmDelete.id);
              }}
              saving={false}
              label="Delete"
              danger
            />
          </div>
        </ModalWrap>
      )}
    </div>
  );
}
