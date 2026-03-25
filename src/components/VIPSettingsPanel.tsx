// LEGACY: This file uses file-level suppression for intentional stable ref patterns.
// The suppressions are legitimate because:
// - Most callbacks are stable (modal handlers, event handlers)
// - like categoryFilter are Dependencies on store values intentional
// Review: 2026-02-17 - suppression retained for stability

import { useState, useEffect } from 'react';
import { Star, Plus, Edit, Trash2, Save, X, CheckCircle, Bot, Briefcase, Target, Users, Heart, ShoppingBag } from 'lucide-react';
import { Button, IconButton, Select, TextField, TextArea, Spinner, Flex } from '@radix-ui/themes';
import { showToast } from './Toast';
import ConfirmDialog, { useConfirmDialog } from './ConfirmDialog';
import { settingsApi } from '../lib/api';

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
  { value: 'boss', label: 'Boss', icon: <ShoppingBag size={12} />, color: 'text-review' },
  { value: 'client', label: 'Client', icon: <Briefcase size={12} />, color: 'text-info' },
  { value: 'stakeholder', label: 'Stakeholder', icon: <Target size={12} />, color: 'text-warning' },
  { value: 'team', label: 'Team', icon: <Users size={12} />, color: 'text-success' },
  { value: 'family', label: 'Family', icon: <Heart size={12} />, color: 'text-error' },
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
      const result = await settingsApi.get('vip');
      let data = result?.value || result || [];
      if (!Array.isArray(data)) data = [];
      if (categoryFilter) {
        data = data.filter((v: any) => v.category === categoryFilter);
      }
      setVips(data as unknown as VipSender[]);
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
      const newVip = {
        identifier: formData.identifier,
        label: formData.label,
        type: formData.type,
        category: formData.category,
        boost: formData.boost,
        notes: formData.notes || undefined,
      };
      const allVips = [...vips, { ...newVip, id: Date.now(), identifier_type: newVip.type, priority_boost: newVip.boost, added_at: new Date().toISOString(), added_by: 'user', message_count: 0, auto_detected: 0 }];
      const result = await settingsApi.set('vip', allVips);

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
      showToast('error', error instanceof Error ? error.message : 'Failed to add VIP');
    }
  };

  const handleUpdate = async (id: number) => {
    const vip = vips.find(v => v.id === id);
    if (!vip) return;

    try {
      const updatedVips = vips.map(v => v.id === id ? { ...v, label: formData.label, priority_boost: formData.boost, category: formData.category, notes: formData.notes || undefined } : v);
      const result = await settingsApi.set('vip', updatedVips);

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
      showToast('error', error instanceof Error ? error.message : 'Failed to update VIP');
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
        const updatedVips = vips.filter(v => v.id !== id);
        const result = await settingsApi.set('vip', updatedVips);

        if (result?.success) {
          showToast('success', `VIP removed: ${label}`);
          loadVips();
        } else {
          showToast('error', result?.error || 'Failed to remove VIP');
        }
      } catch (error: unknown) {
        // '[VIP] Remove error:', error;
        showToast('error', error instanceof Error ? error.message : 'Failed to remove VIP');
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
    <div className="h-full flex flex-col bg-mission-control-bg">
      {/* Header */}
      <Flex align="center" justify="between" className="p-6 border-b border-mission-control-border/50">
        <div>
          <h2 className="text-lg font-semibold text-mission-control-text flex items-center gap-2">
            <Star className="text-warning" size={24} />
            VIP Senders
          </h2>
          <p className="text-sm text-mission-control-text-dim mt-1">
            Manage important senders and priority boosts
          </p>
        </div>
        <Button
          onClick={() => setShowAddForm(true)}
          variant="soft"
          color="gray"
          size="2"
        >
          <Plus size={16} />
          Add VIP
        </Button>
      </Flex>

      {/* Category Filter */}
      <div className="flex gap-2 px-6 py-3 border-b border-mission-control-border/50 overflow-x-auto">
        <Button
          onClick={() => setCategoryFilter(null)}
          variant={categoryFilter === null ? 'soft' : 'ghost'}
          color="gray"
          size="2"
        >
          All
        </Button>
        {CATEGORY_OPTIONS.map(cat => (
          <Button
            key={cat.value}
            onClick={() => setCategoryFilter(cat.value)}
            variant={categoryFilter === cat.value ? 'soft' : 'ghost'}
            color="gray"
            size="2"
          >
            <span className="inline-flex items-center gap-1">{cat.icon} {cat.label}</span>
          </Button>
        ))}
      </div>

      {/* VIP List */}
      <div className="flex-1 overflow-y-auto p-6 space-y-3">
        {loading ? (
          <Flex align="center" justify="center" gap="2" className="py-12 text-mission-control-text-dim">
            <Spinner size="2" /> Loading...
          </Flex>
        ) : vips.length === 0 ? (
          <div className="text-center text-mission-control-text-dim py-12">
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
                className="bg-mission-control-bg/50 border border-mission-control-border/50 rounded-lg p-4 hover:border-mission-control-border transition-colors"
              >
                {isEditing ? (
                  // Edit Form
                  <div className="space-y-3">
                    <div>
                      <label htmlFor="vip-label" className="block text-sm text-mission-control-text-dim mb-1">Label</label>
                      <TextField.Root
                        id="vip-label"
                        size="2"
                        value={formData.label}
                        onChange={e => setFormData({ ...formData, label: e.target.value })}
                      />
                    </div>
                    <div>
                      <label htmlFor="vip-category" className="block text-sm text-mission-control-text-dim mb-1">Category</label>
                      <Select.Root
                        value={formData.category}
                        onValueChange={val => setFormData({ ...formData, category: val })}
                      >
                        <Select.Trigger />
                        <Select.Content>
                          {CATEGORY_OPTIONS.map(cat => (
                            <Select.Item key={cat.value} value={cat.value}>{cat.label}</Select.Item>
                          ))}
                        </Select.Content>
                      </Select.Root>
                    </div>
                    <div>
                      <label htmlFor="vip-boost" className="block text-sm text-mission-control-text-dim mb-1">
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
                      <label htmlFor="vip-notes" className="block text-sm text-mission-control-text-dim mb-1">Notes</label>
                      <TextArea
                        id="vip-notes"
                        value={formData.notes}
                        onChange={e => setFormData({ ...formData, notes: e.target.value })}
                        rows={2}
                        size="2"
                        variant="soft"
                        placeholder="Why is this person a VIP?"
                      />
                    </div>
                    <Flex gap="2">
                      <Button
                        onClick={() => handleUpdate(vip.id)}
                        variant="solid"
                        color="violet"
                        size="2"
                      >
                        <Save size={14} />
                        Save
                      </Button>
                      <Button
                        onClick={resetForm}
                        variant="soft"
                        color="gray"
                        size="2"
                      >
                        <X size={14} />
                        Cancel
                      </Button>
                    </Flex>
                  </div>
                ) : (
                  // View Mode
                  <div>
                    <Flex align="start" justify="between" className="mb-2">
                      <Flex align="center" gap="2">
                        <Star className="text-warning" size={20} />
                        <span className="text-lg font-semibold text-mission-control-text">{vip.label}</span>
                        <span className={`text-sm inline-flex items-center gap-1 ${catInfo.color}`}>
                          {catInfo.icon} {catInfo.label}
                        </span>
                        {vip.auto_detected === 1 && (
                          <span className="text-xs px-2 py-0.5 bg-info-subtle text-info rounded inline-flex items-center gap-1">
                            <Bot size={10} /> Auto
                          </span>
                        )}
                      </Flex>
                      <Flex gap="1">
                        <IconButton
                          onClick={() => startEdit(vip)}
                          variant="ghost"
                          color="gray"
                          size="2"
                          title="Edit"
                        >
                          <Edit size={16} />
                        </IconButton>
                        <IconButton
                          onClick={() => handleRemove(vip.id, vip.label)}
                          variant="ghost"
                          color="red"
                          size="2"
                          title="Remove"
                        >
                          <Trash2 size={16} />
                        </IconButton>
                      </Flex>
                    </Flex>

                    <div className="space-y-1 text-sm">
                      <Flex align="center" gap="2" className="text-mission-control-text-dim">
                        <span className="font-mono text-info">{vip.identifier}</span>
                        <span className="text-mission-control-text-dim">({vip.identifier_type})</span>
                      </Flex>
                      <div className="text-mission-control-text-dim">
                        Priority boost: <span className="text-warning font-semibold">+{vip.priority_boost}</span>
                      </div>
                      {vip.notes && (
                        <div className="text-mission-control-text-dim italic">{vip.notes}</div>
                      )}
                      {vip.message_count > 0 && (
                        <div className="text-mission-control-text-dim">
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
          <div className="bg-mission-control-bg border border-mission-control-border rounded-lg p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <Flex align="center" justify="between" className="mb-4">
              <h3 className="text-lg font-semibold text-mission-control-text">Add VIP Sender</h3>
              <IconButton
                type="button"
                onClick={resetForm}
                variant="ghost"
                color="gray"
                size="2"
              >
                <X size={20} />
              </IconButton>
            </Flex>

            <div className="space-y-4">
              <div>
                <label htmlFor="vip-identifier" className="block text-sm text-mission-control-text-dim mb-1">
                  Identifier <span className="text-error">*</span>
                </label>
                <TextField.Root
                  id="vip-identifier"
                  size="2"
                  value={formData.identifier}
                  onChange={e => setFormData({ ...formData, identifier: e.target.value })}
                  placeholder="email@example.com, +1234567890, @username, domain.com"
                />
              </div>

              <div>
                <label htmlFor="vip-type" className="block text-sm text-mission-control-text-dim mb-1">
                  Type
                </label>
                <Select.Root
                  value={formData.type}
                  onValueChange={val => setFormData({ ...formData, type: val })}
                >
                  <Select.Trigger />
                  <Select.Content>
                    {TYPE_OPTIONS.map(type => (
                      <Select.Item key={type.value} value={type.value}>{type.label}</Select.Item>
                    ))}
                  </Select.Content>
                </Select.Root>
              </div>

              <div>
                <label htmlFor="vip-label-add" className="block text-sm text-mission-control-text-dim mb-1">
                  Label <span className="text-error">*</span>
                </label>
                <TextField.Root
                  id="vip-label-add"
                  size="2"
                  value={formData.label}
                  onChange={e => setFormData({ ...formData, label: e.target.value })}
                  placeholder="Kevin, CEO, Key Client"
                />
              </div>

              <div>
                <label htmlFor="vip-category-add" className="block text-sm text-mission-control-text-dim mb-1">Category</label>
                <Select.Root
                  value={formData.category}
                  onValueChange={val => setFormData({ ...formData, category: val })}
                >
                  <Select.Trigger />
                  <Select.Content>
                    {CATEGORY_OPTIONS.map(cat => (
                      <Select.Item key={cat.value} value={cat.value}>{cat.label}</Select.Item>
                    ))}
                  </Select.Content>
                </Select.Root>
              </div>

              <div>
                <label htmlFor="vip-boost-add" className="block text-sm text-mission-control-text-dim mb-1">
                  Priority Boost: {formData.boost} (0-50)
                </label>
                <input
                  id="vip-boost-add"
                  type="range"
                  min="0"
                  max="50"
                  value={formData.boost}
                  onChange={e => setFormData({ ...formData, boost: parseInt(e.target.value) })}
                  className="w-full"
                />
                <Flex justify="between" className="text-xs text-mission-control-text-dim mt-1">
                  <span>Low</span>
                  <span>Medium</span>
                  <span>High</span>
                </Flex>
              </div>

              <div>
                <label htmlFor="vip-notes-add" className="block text-sm text-mission-control-text-dim mb-1">Notes</label>
                <TextArea
                  id="vip-notes-add"
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  size="2"
                  variant="soft"
                  placeholder="Why is this person a VIP?"
                />
              </div>

              <Flex gap="3" className="pt-4">
                <Button
                  onClick={handleAdd}
                  variant="solid"
                  color="violet"
                  size="2"
                  className="flex-1"
                >
                  <CheckCircle size={16} />
                  Add VIP
                </Button>
                <Button
                  onClick={resetForm}
                  variant="soft"
                  color="gray"
                  size="2"
                >
                  Cancel
                </Button>
              </Flex>
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
