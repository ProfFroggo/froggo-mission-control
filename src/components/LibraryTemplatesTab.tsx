import { useState } from 'react';
import { FileText, Plus, Edit3, Trash2, Copy, Search, Mail, MessageSquare, Star, StarOff, LayoutTemplate } from 'lucide-react';
import EmptyState from './EmptyState';
import ConfirmDialog, { useConfirmDialog } from './ConfirmDialog';
import { showToast } from './Toast';
import { copyToClipboard } from '../utils/clipboard';

// X logo component
const XIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

interface Template {
  id: string;
  name: string;
  content: string;
  type: 'tweet' | 'email' | 'message' | 'generic';
  tags: string[];
  starred: boolean;
  usageCount: number;
  createdAt: number;
  updatedAt: number;
}

const typeConfig: Record<string, { icon: any; color: string; label: string }> = {
  tweet: { icon: XIcon, color: 'text-white', label: 'Post' },
  email: { icon: Mail, color: 'text-error', label: 'Email' },
  message: { icon: MessageSquare, color: 'text-success', label: 'Message' },
  generic: { icon: FileText, color: 'text-mission-control-text-dim', label: 'Generic' },
};

// Default templates
const defaultTemplates: Template[] = [
  {
    id: 'tpl-1',
    name: 'GM Tweet',
    content: 'gm frens 🐸\n\n{topic}\n\nWho else is building today?',
    type: 'tweet',
    tags: ['morning', 'engagement'],
    starred: true,
    usageCount: 12,
    createdAt: Date.now() - 86400000 * 7,
    updatedAt: Date.now() - 86400000,
  },
  {
    id: 'tpl-2',
    name: 'Thread Opener',
    content: '🧵 Thread: {title}\n\nLet me explain {topic} in simple terms:\n\n1/',
    type: 'tweet',
    tags: ['thread', 'educational'],
    starred: true,
    usageCount: 8,
    createdAt: Date.now() - 86400000 * 5,
    updatedAt: Date.now() - 86400000 * 2,
  },
  {
    id: 'tpl-3',
    name: 'Quick Reply',
    content: 'Thanks for sharing! {response}\n\nLet me know if you have questions 🐸',
    type: 'tweet',
    tags: ['reply', 'engagement'],
    starred: false,
    usageCount: 5,
    createdAt: Date.now() - 86400000 * 3,
    updatedAt: Date.now() - 86400000,
  },
  {
    id: 'tpl-4',
    name: 'Meeting Follow-up',
    content: 'Hi {name},\n\nGreat meeting today! Here are the key takeaways:\n\n{points}\n\nLet me know if I missed anything.\n\nBest,\nKevin',
    type: 'email',
    tags: ['meeting', 'follow-up'],
    starred: false,
    usageCount: 3,
    createdAt: Date.now() - 86400000 * 10,
    updatedAt: Date.now() - 86400000 * 5,
  },
];

export default function LibraryTemplatesTab() {
  const [templates, setTemplates] = useState<Template[]>(defaultTemplates);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editName, setEditName] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newTemplate, setNewTemplate] = useState({ name: '', content: '', type: 'generic' as Template['type'] });
  const { open, config, onConfirm, showConfirm, closeConfirm } = useConfirmDialog();

  const filteredTemplates = templates.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.content.toLowerCase().includes(search.toLowerCase()) ||
      t.tags.some(tag => tag.toLowerCase().includes(search.toLowerCase()));
    const matchesType = typeFilter === 'all' || t.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const handleCopy = async (template: Template) => {
    const success = await copyToClipboard(template.content);
    if (success) {
      setTemplates(prev => prev.map(t => 
        t.id === template.id ? { ...t, usageCount: t.usageCount + 1 } : t
      ));
      showToast('success', 'Copied!', template.name);
    } else {
      showToast('error', 'Copy failed', 'Unable to copy to clipboard');
    }
  };

  const handleStar = (id: string) => {
    setTemplates(prev => prev.map(t =>
      t.id === id ? { ...t, starred: !t.starred } : t
    ));
  };

  const handleEdit = (template: Template) => {
    setEditingId(template.id);
    setEditName(template.name);
    setEditContent(template.content);
  };

  const handleSave = () => {
    if (!editingId) return;
    setTemplates(prev => prev.map(t =>
      t.id === editingId ? { ...t, name: editName, content: editContent, updatedAt: Date.now() } : t
    ));
    setEditingId(null);
    showToast('success', 'Template saved');
  };

  const handleDelete = (id: string) => {
    showConfirm({
      title: 'Delete Template',
      message: 'Are you sure you want to delete this template?',
      confirmLabel: 'Delete',
      type: 'danger',
    }, () => {
      setTemplates(prev => prev.filter(t => t.id !== id));
      showToast('info', 'Template deleted');
    });
  };

  const handleCreate = () => {
    if (!newTemplate.name || !newTemplate.content) return;
    const template: Template = {
      id: `tpl-${Date.now()}`,
      name: newTemplate.name,
      content: newTemplate.content,
      type: newTemplate.type,
      tags: [],
      starred: false,
      usageCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setTemplates(prev => [template, ...prev]);
    setNewTemplate({ name: '', content: '', type: 'generic' });
    setShowCreate(false);
    showToast('success', 'Template created', newTemplate.name);
  };

  // Sort: starred first, then by usage
  const sortedTemplates = [...filteredTemplates].sort((a, b) => {
    if (a.starred !== b.starred) return a.starred ? -1 : 1;
    return b.usageCount - a.usageCount;
  });

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="p-6 border-b border-mission-control-border bg-mission-control-surface">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-mission-control-text-dim">
            Reusable content templates
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent/90"
          >
            <Plus size={16} />
            New Template
          </button>
        </div>

        {/* Search and filters */}
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-mission-control-text-dim" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search templates..."
              className="w-full pl-9 pr-4 py-2 bg-mission-control-surface border border-mission-control-border rounded-lg focus:outline-none focus:border-mission-control-accent"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 bg-mission-control-surface border border-mission-control-border rounded-lg focus:outline-none focus:border-mission-control-accent"
          >
            <option value="all">All Types</option>
            <option value="tweet">Tweets</option>
            <option value="email">Emails</option>
            <option value="message">Messages</option>
            <option value="generic">Generic</option>
          </select>
        </div>
      </div>

      {/* Templates List */}
      <div className="flex-1 overflow-y-auto p-6">
        {sortedTemplates.length === 0 ? (
          <EmptyState icon={LayoutTemplate} title="No templates" description="Create your first template" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedTemplates.map(template => {
              const config = typeConfig[template.type];
              const Icon = config.icon;
              const isEditing = editingId === template.id;

              return (
                <div
                  key={template.id}
                  className={`p-4 rounded-lg border transition-all ${
                    isEditing
                      ? 'bg-mission-control-accent/5 border-mission-control-accent/30'
                      : 'bg-mission-control-surface border-mission-control-border hover:border-mission-control-accent/30'
                  }`}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Icon size={16} className={config.color} />
                      {isEditing ? (
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="font-medium bg-transparent border-b border-mission-control-accent focus:outline-none"
                        />
                      ) : (
                        <span className="font-medium">{template.name}</span>
                      )}
                    </div>
                    <button
                      onClick={() => handleStar(template.id)}
                      className="p-1 hover:bg-mission-control-border rounded"
                    >
                      {template.starred ? (
                        <Star size={14} className="text-warning fill-yellow-400" />
                      ) : (
                        <StarOff size={14} className="text-mission-control-text-dim" />
                      )}
                    </button>
                  </div>

                  {/* Content */}
                  {isEditing ? (
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="w-full h-24 bg-mission-control-bg border border-mission-control-border rounded-lg p-2 text-sm resize-none focus:outline-none focus:border-mission-control-accent"
                    />
                  ) : (
                    <p className="text-sm text-mission-control-text-dim line-clamp-3 mb-3">
                      {template.content}
                    </p>
                  )}

                  {/* Tags */}
                  {template.tags.length > 0 && !isEditing && (
                    <div className="flex gap-1 mb-3">
                      {template.tags.map(tag => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 bg-mission-control-border text-mission-control-text-dim text-xs rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-mission-control-text-dim">
                      Used {template.usageCount}x
                    </span>
                    <div className="flex gap-1">
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => setEditingId(null)}
                            className="px-2 py-1 text-xs text-mission-control-text-dim hover:text-mission-control-text"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleSave}
                            className="px-2 py-1 text-xs bg-mission-control-accent text-white rounded"
                          >
                            Save
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleCopy(template)}
                            className="p-1.5 hover:bg-mission-control-border rounded"
                            title="Copy"
                          >
                            <Copy size={14} className="text-mission-control-text-dim" />
                          </button>
                          <button
                            onClick={() => handleEdit(template)}
                            className="p-1.5 hover:bg-mission-control-border rounded"
                            title="Edit"
                          >
                            <Edit3 size={14} className="text-mission-control-text-dim" />
                          </button>
                          <button
                            onClick={() => handleDelete(template.id)}
                            className="p-1.5 hover:bg-error-subtle rounded"
                            title="Delete"
                          >
                            <Trash2 size={14} className="text-error" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 modal-backdrop backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass-modal rounded-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-4">New Template</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="template-name" className="block text-sm text-mission-control-text-dim mb-1">Name</label>
                <input
                  id="template-name"
                  type="text"
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                  className="w-full px-3 py-2 bg-mission-control-surface border border-mission-control-border rounded-lg focus:outline-none focus:border-mission-control-accent"
                  placeholder="Template name"
                />
              </div>
              <div>
                <label htmlFor="template-type" className="block text-sm text-mission-control-text-dim mb-1">Type</label>
                <select
                  id="template-type"
                  value={newTemplate.type}
                  onChange={(e) => setNewTemplate({ ...newTemplate, type: e.target.value as Template['type'] })}
                  className="w-full px-3 py-2 bg-mission-control-surface border border-mission-control-border rounded-lg focus:outline-none focus:border-mission-control-accent"
                >
                  <option value="tweet">Tweet</option>
                  <option value="email">Email</option>
                  <option value="message">Message</option>
                  <option value="generic">Generic</option>
                </select>
              </div>
              <div>
                <label htmlFor="template-content" className="block text-sm text-mission-control-text-dim mb-1">Content</label>
                <textarea
                  id="template-content"
                  value={newTemplate.content}
                  onChange={(e) => setNewTemplate({ ...newTemplate, content: e.target.value })}
                  className="w-full h-32 px-3 py-2 bg-mission-control-surface border border-mission-control-border rounded-lg focus:outline-none focus:border-mission-control-accent resize-none"
                  placeholder="Use {variable} for placeholders"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 text-mission-control-text-dim hover:text-mission-control-text"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!newTemplate.name || !newTemplate.content}
                className="px-4 py-2 bg-mission-control-accent text-white rounded-lg disabled:opacity-50"
              >
                Create
              </button>
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
