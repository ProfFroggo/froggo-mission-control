// LEGACY: This file uses file-level suppression for intentional stable ref patterns.
// The suppressions are legitimate because:
// - Most callbacks are stable (modal handlers, event handlers)
// - like categoryFilter are Dependencies on store values intentional
// Review: 2026-02-17 - suppression retained for stability

import { useState, useEffect } from 'react';
import { Star, Plus, Edit, Trash2, Save, X, CheckCircle } from 'lucide-react';
import { showToast } from './Toast';
import ConfirmDialog, { useConfirmDialog } from './ConfirmDialog';

interface VipSender {
  id: number;
  identifier: string;
  identifier_type: string;
  label: string;
  priority_boost: number;
  category?: string;
  notes?: string;
  added_at: string;
  added_by: string;
  last_message_at?: string;
  message_count: number;
  auto_detected: number;
}

const CATEGORY_OPTIONS = [
  { value: 'boss', label: 'Boss', emoji: '👔', color: 'text-review' },
  { value: 'client', label: 'Client', emoji: '💼', color: 'text-info' },
  { value: 'stakeholder', label: 'Stakeholder', emoji: '🎯', color: 'text-warning' },
  { value: 'team', label: 'Team', emoji: '👥', color: 'text-success' },
  { value: 'family', label: 'Family', emoji: '❤️', color: 'text-pink-400' },
];

const TYPE_OPTIONS = [
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'username', label: 'Username' },
  { value: 'domain', label: 'Domain' },
  { value: 'pattern', label: 'Pattern' },
];

export default function VIPSettingsPanel() {
  const [vips, setVips] = useState<VipSender[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const { open, config, onConfirm, showConfirm, closeConfirm } = useConfirmDialog();
  
  // Form state
  const [formData, setFormData] = useState({
    identifier: '',
    label: '',
    type: 'email',
    category: 'boss',
    boost: 30,
    notes: '',
  });

  useEffect(() => {
    loadVips();
  }, [categoryFilter]);

  const loadVips = async () => {
    setLoading(true);
    try {
      const data = await window.clawdbot?.vip.list(categoryFilter || undefined);
      setVips((data || []) as unknown as VipSender[]);
    } catch (error) {
      // '[VIP] Load error:', error;
      showToast('error', 'Failed to load VIPs');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!formData.identifier || !formData.label) {
      showToast('error', 'Identifier and label are required');
      return;
    }

    try {
      const result = await window.clawdbot?.vip.add({
        identifier: formData.identifier,
        label: formData.label,
        type: formData.type,
        category: formData.category,
        boost: formData.boost,
        notes: formData.notes || undefined,
      });

      if (result?.success) {
        showToast('success', `VIP added: ${formData.label}`);
        setShowAddForm(false);
        resetForm();
        loadVips();
      } else {
        showToast('error', result?.error || 'Failed to add VIP');
      }
    } catch (error: unknown) {
      // '[VIP] Add error:', error;
      showToast('error', error.message || 'Failed to add VIP');
    }
  };

  const handleUpdate = async (id: number) => {
    const vip = vips.find(v => v.id === id);
    if (!vip) return;

    try {
      const result = await window.clawdbot?.vip.update(id, {
        label: formData.label,
        boost: formData.boost,
        category: formData.category,
        notes: formData.notes || undefined,
      });

      if (result?.success) {
        showToast('success', `VIP updated: ${formData.label}`);
        setEditingId(null);
        resetForm();
        loadVips();
      } else {
        showToast('error', result?.error || 'Failed to update VIP');
      }
    } catch (error: unknown) {
      // '[VIP] Update error:', error;
      showToast('error', error.message || 'Failed to update VIP');
    }
  };

  const handleRemove = async (id: number, label: string) => {
    showConfirm({
      title: 'Remove VIP',
      message: `Are you sure you want to remove VIP: ${label}?`,
      confirmLabel: 'Remove',
      type: 'warning',
    }, async () => {
      try {
        const result = await window.clawdbot?.vip.remove(id);

        if (result?.success) {
          showToast('success', `VIP removed: ${label}`);
          loadVips();
        } else {
          showToast('error', result?.error || 'Failed to remove VIP');
        }
      } catch (error: unknown) {
        // '[VIP] Remove error:', error;
        showToast('error', error.message || 'Failed to remove VIP');
      }
    });
  };

  const startEdit = (vip: VipSender) => {
    setEditingId(vip.id);
    setFormData({
      identifier: vip.identifier,
      label: vip.label,
      type: vip.identifier_type,
      category: vip.category || 'boss',
      boost: vip.priority_boost,
      notes: vip.notes || '',
    });
  };

  const resetForm = () => {
    setFormData({
      identifier: '',
      label: '',
      type: 'email',
      category: 'boss',
      boost: 30,
      notes: '',
    });
    setEditingId(null);
    setShowAddForm(false);
  };

  const getCategoryInfo = (category?: string) => {
    return CATEGORY_OPTIONS.find(c => c.value === category) || CATEGORY_OPTIONS[0];
  };

  return (
    <div className="h-full flex flex-col bg-clawd-bg">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-slate-800/50">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Star className="text-warning" size={24} />
            VIP Senders
          </h2>
          <p className="text-sm text-clawd-text-dim mt-1">
            Manage important senders and priority boosts
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-info-subtle hover:bg-info-subtle 
                   text-info rounded-lg transition-colors"
        >
          <Plus size={16} />
          Add VIP
        </button>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 px-6 py-3 border-b border-slate-800/50 overflow-x-auto">
        <button
          onClick={() => setCategoryFilter(null)}
          className={`px-3 py-1.5 rounded-lg text-sm transition-colors whitespace-nowrap ${
            categoryFilter === null
              ? 'bg-clawd-surface text-white'
              : 'text-clawd-text-dim hover:bg-clawd-surface/50'
          }`}
        >
          All
        </button>
        {CATEGORY_OPTIONS.map(cat => (
          <button
            key={cat.value}
            onClick={() => setCategoryFilter(cat.value)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors whitespace-nowrap ${
              categoryFilter === cat.value
                ? 'bg-clawd-surface text-white'
                : 'text-clawd-text-dim hover:bg-clawd-surface/50'
            }`}
          >
            {cat.emoji} {cat.label}
          </button>
        ))}
      </div>

      {/* VIP List */}
      <div className="flex-1 overflow-y-auto p-6 space-y-3">
        {loading ? (
          <div className="text-center text-clawd-text-dim py-12">Loading...</div>
        ) : vips.length === 0 ? (
          <div className="text-center text-clawd-text-dim py-12">
            <Star size={48} className="mx-auto mb-4 opacity-20" />
            <p>No VIP senders configured</p>
            <p className="text-sm mt-2">Add important senders to prioritize their messages</p>
          </div>
        ) : (
          vips.map(vip => {
            const catInfo = getCategoryInfo(vip.category);
            const isEditing = editingId === vip.id;

            return (
              <div
                key={vip.id}
                className="bg-clawd-bg/50 border border-slate-800/50 rounded-lg p-4 hover:border-slate-700/50 
                         transition-colors"
              >
                {isEditing ? (
                  // Edit Form
                  <div className="space-y-3">
                    <div>
                      <label htmlFor="vip-label" className="block text-sm text-clawd-text-dim mb-1">Label</label>
                      <input
                        id="vip-label"
                        type="text"
                        value={formData.label}
                        onChange={e => setFormData({ ...formData, label: e.target.value })}
                        className="w-full bg-clawd-surface border border-slate-700 rounded px-3 py-2 text-white
                                 focus:outline-none focus:border-info-border"
                      />
                    </div>
                    <div>
                      <label htmlFor="vip-category" className="block text-sm text-clawd-text-dim mb-1">Category</label>
                      <select
                        id="vip-category"
                        value={formData.category}
                        onChange={e => setFormData({ ...formData, category: e.target.value })}
                        className="w-full bg-clawd-surface border border-slate-700 rounded px-3 py-2 text-white
                                 focus:outline-none focus:border-info-border"
                      >
                        {CATEGORY_OPTIONS.map(cat => (
                          <option key={cat.value} value={cat.value}>
                            {cat.emoji} {cat.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="vip-boost" className="block text-sm text-clawd-text-dim mb-1">
                        Priority Boost ({formData.boost})
                      </label>
                      <input
                        id="vip-boost"
                        type="range"
                        min="0"
                        max="50"
                        value={formData.boost}
                        onChange={e => setFormData({ ...formData, boost: parseInt(e.target.value) })}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label htmlFor="vip-notes" className="block text-sm text-clawd-text-dim mb-1">Notes</label>
                      <textarea
                        id="vip-notes"
                        value={formData.notes}
                        onChange={e => setFormData({ ...formData, notes: e.target.value })}
                        rows={2}
                        className="w-full bg-clawd-surface border border-slate-700 rounded px-3 py-2 text-white
                                 focus:outline-none focus:border-info-border"
                        placeholder="Why is this person a VIP?"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleUpdate(vip.id)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-success-subtle hover:bg-success-subtle
                                 text-success rounded transition-colors"
                      >
                        <Save size={14} />
                        Save
                      </button>
                      <button
                        onClick={resetForm}
                        className="flex items-center gap-2 px-3 py-1.5 bg-clawd-surface hover:bg-clawd-border
                                 text-white rounded transition-colors"
                      >
                        <X size={14} />
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  // View Mode
                  <div>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Star className="text-warning" size={20} />
                        <span className="text-lg font-semibold text-white">{vip.label}</span>
                        <span className={`text-sm ${catInfo.color}`}>
                          {catInfo.emoji} {catInfo.label}
                        </span>
                        {vip.auto_detected === 1 && (
                          <span className="text-xs px-2 py-0.5 bg-info-subtle text-info rounded">
                            🤖 Auto
                          </span>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => startEdit(vip)}
                          className="p-1.5 text-clawd-text-dim hover:text-info hover:bg-info-subtle rounded
                                   transition-colors"
                          title="Edit"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleRemove(vip.id, vip.label)}
                          className="p-1.5 text-clawd-text-dim hover:text-error hover:bg-error-subtle rounded
                                   transition-colors"
                          title="Remove"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-2 text-clawd-text-dim">
                        <span className="font-mono text-info">{vip.identifier}</span>
                        <span className="text-clawd-text-dim">({vip.identifier_type})</span>
                      </div>
                      <div className="text-clawd-text-dim">
                        Priority boost: <span className="text-warning font-semibold">+{vip.priority_boost}</span>
                      </div>
                      {vip.notes && (
                        <div className="text-clawd-text-dim italic">{vip.notes}</div>
                      )}
                      {vip.message_count > 0 && (
                        <div className="text-clawd-text-dim">
                          {vip.message_count} messages
                          {vip.last_message_at && ` • Last: ${new Date(vip.last_message_at).toLocaleDateString()}`}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Add VIP Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-clawd-bg border border-slate-700 rounded-lg p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">Add VIP Sender</h3>
              <button type="button" onClick={resetForm} className="text-clawd-text-dim hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="vip-identifier" className="block text-sm text-clawd-text-dim mb-1">
                  Identifier <span className="text-error">*</span>
                </label>
                <input
                  id="vip-identifier"
                  type="text"
                  value={formData.identifier}
                  onChange={e => setFormData({ ...formData, identifier: e.target.value })}
                  placeholder="email@example.com, +1234567890, @username, domain.com"
                  className="w-full bg-clawd-surface border border-slate-700 rounded px-3 py-2 text-white
                           focus:outline-none focus:border-info-border"
                />
              </div>

              <div>
                <label htmlFor="vip-type" className="block text-sm text-clawd-text-dim mb-1">
                  Type
                </label>
                <select
                  id="vip-type"
                  value={formData.type}
                  onChange={e => setFormData({ ...formData, type: e.target.value })}
                  className="w-full bg-clawd-surface border border-slate-700 rounded px-3 py-2 text-white
                           focus:outline-none focus:border-info-border"
                >
                  {TYPE_OPTIONS.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="vip-label" className="block text-sm text-clawd-text-dim mb-1">
                  Label <span className="text-error">*</span>
                </label>
                <input
                  id="vip-label"
                  type="text"
                  value={formData.label}
                  onChange={e => setFormData({ ...formData, label: e.target.value })}
                  placeholder="Kevin, CEO, Key Client"
                  className="w-full bg-clawd-surface border border-slate-700 rounded px-3 py-2 text-white
                           focus:outline-none focus:border-info-border"
                />
              </div>

              <div>
                <label htmlFor="vip-category" className="block text-sm text-clawd-text-dim mb-1">Category</label>
                <select
                  id="vip-category"
                  value={formData.category}
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                  className="w-full bg-clawd-surface border border-slate-700 rounded px-3 py-2 text-white
                           focus:outline-none focus:border-info-border"
                >
                  {CATEGORY_OPTIONS.map(cat => (
                    <option key={cat.value} value={cat.value}>
                      {cat.emoji} {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="vip-boost" className="block text-sm text-clawd-text-dim mb-1">
                  Priority Boost: {formData.boost} (0-50)
                </label>
                <input
                  id="vip-boost"
                  type="range"
                  min="0"
                  max="50"
                  value={formData.boost}
                  onChange={e => setFormData({ ...formData, boost: parseInt(e.target.value) })}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-clawd-text-dim mt-1">
                  <span>Low</span>
                  <span>Medium</span>
                  <span>High</span>
                </div>
              </div>

              <div>
                <label htmlFor="vip-notes" className="block text-sm text-clawd-text-dim mb-1">Notes</label>
                <textarea
                  id="vip-notes"
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  placeholder="Why is this person a VIP?"
                  className="w-full bg-clawd-surface border border-slate-700 rounded px-3 py-2 text-white
                           focus:outline-none focus:border-info-border"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleAdd}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-clawd-accent hover:bg-clawd-accent-dim
                           text-white rounded-lg transition-colors"
                >
                  <CheckCircle size={16} />
                  Add VIP
                </button>
                <button
                  onClick={resetForm}
                  className="px-4 py-2 bg-clawd-surface hover:bg-clawd-border text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={open}
        onClose={closeConfirm}
        onConfirm={onConfirm}
        title={config.title}
        message={config.message}
        confirmLabel={config.confirmLabel}
        cancelLabel={config.cancelLabel}
        type={config.type}
      />
    </div>
  );
}
