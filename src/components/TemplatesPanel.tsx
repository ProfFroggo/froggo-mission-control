import { useState, useEffect, useCallback } from 'react';
import { FileText, Plus, Edit3, Trash2, Copy, Search, Tag, Twitter, Mail, MessageSquare, Star, StarOff } from 'lucide-react';
import { showToast } from './Toast';
import EmptyState from './EmptyState';

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
  tweet: { icon: Twitter, color: 'text-blue-400', label: 'Tweet' },
  email: { icon: Mail, color: 'text-red-400', label: 'Email' },
  message: { icon: MessageSquare, color: 'text-green-400', label: 'Message' },
  generic: { icon: FileText, color: 'text-gray-400', label: 'Generic' },
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

export default function TemplatesPanel() {
  const [templates, setTemplates] = useState<Template[]>(defaultTemplates);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editName, setEditName] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newTemplate, setNewTemplate] = useState({ name: '', content: '', type: 'generic' as Template['type'] });

  const filteredTemplates = templates.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.content.toLowerCase().includes(search.toLowerCase()) ||
      t.tags.some(tag => tag.toLowerCase().includes(search.toLowerCase()));
    const matchesType = typeFilter === 'all' || t.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const handleCopy = (template: Template) => {
    navigator.clipboard.writeText(template.content);
    setTemplates(prev => prev.map(t => 
      t.id === template.id ? { ...t, usageCount: t.usageCount + 1 } : t
    ));
    showToast('success', 'Copied!', template.name);
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
    if (!confirm('Delete this template?')) return;
    setTemplates(prev => prev.filter(t => t.id !== id));
    showToast('info', 'Template deleted');
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
      {/* Header */}
      <div className="p-6 border-b border-clawd-border bg-clawd-surface">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500/20 rounded-xl">
              <FileText size={24} className="text-orange-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Templates</h1>
              <p className="text-sm text-clawd-text-dim">
                Reusable content templates
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-clawd-accent text-white rounded-xl hover:bg-clawd-accent/90"
          >
            <Plus size={16} />
            New Template
          </button>
        </div>

        {/* Search and filters */}
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-clawd-text-dim" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search templates..."
              className="w-full pl-9 pr-4 py-2 bg-clawd-bg border border-clawd-border rounded-xl focus:outline-none focus:border-clawd-accent"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 bg-clawd-bg border border-clawd-border rounded-xl focus:outline-none focus:border-clawd-accent"
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
          <EmptyState type="generic" title="No templates" description="Create your first template" />
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {sortedTemplates.map(template => {
              const config = typeConfig[template.type];
              const Icon = config.icon;
              const isEditing = editingId === template.id;

              return (
                <div
                  key={template.id}
                  className={`p-4 rounded-xl border transition-all ${
                    isEditing
                      ? 'bg-clawd-accent/5 border-clawd-accent/30'
                      : 'bg-clawd-surface border-clawd-border hover:border-clawd-accent/30'
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
                          className="font-medium bg-transparent border-b border-clawd-accent focus:outline-none"
                        />
                      ) : (
                        <span className="font-medium">{template.name}</span>
                      )}
                    </div>
                    <button
                      onClick={() => handleStar(template.id)}
                      className="p-1 hover:bg-clawd-border rounded"
                    >
                      {template.starred ? (
                        <Star size={14} className="text-yellow-400 fill-yellow-400" />
                      ) : (
                        <StarOff size={14} className="text-clawd-text-dim" />
                      )}
                    </button>
                  </div>

                  {/* Content */}
                  {isEditing ? (
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="w-full h-24 bg-clawd-bg border border-clawd-border rounded-lg p-2 text-sm resize-none focus:outline-none focus:border-clawd-accent"
                    />
                  ) : (
                    <p className="text-sm text-clawd-text-dim line-clamp-3 mb-3">
                      {template.content}
                    </p>
                  )}

                  {/* Tags */}
                  {template.tags.length > 0 && !isEditing && (
                    <div className="flex gap-1 mb-3">
                      {template.tags.map(tag => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 bg-clawd-border text-clawd-text-dim text-xs rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-clawd-text-dim">
                      Used {template.usageCount}x
                    </span>
                    <div className="flex gap-1">
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => setEditingId(null)}
                            className="px-2 py-1 text-xs text-clawd-text-dim hover:text-clawd-text"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleSave}
                            className="px-2 py-1 text-xs bg-clawd-accent text-white rounded"
                          >
                            Save
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleCopy(template)}
                            className="p-1.5 hover:bg-clawd-border rounded"
                            title="Copy"
                          >
                            <Copy size={14} className="text-clawd-text-dim" />
                          </button>
                          <button
                            onClick={() => handleEdit(template)}
                            className="p-1.5 hover:bg-clawd-border rounded"
                            title="Edit"
                          >
                            <Edit3 size={14} className="text-clawd-text-dim" />
                          </button>
                          <button
                            onClick={() => handleDelete(template.id)}
                            className="p-1.5 hover:bg-red-500/20 rounded"
                            title="Delete"
                          >
                            <Trash2 size={14} className="text-red-400" />
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass-modal rounded-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-4">New Template</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-clawd-text-dim mb-1">Name</label>
                <input
                  type="text"
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                  className="w-full px-3 py-2 bg-clawd-bg border border-clawd-border rounded-xl focus:outline-none focus:border-clawd-accent"
                  placeholder="Template name"
                />
              </div>
              <div>
                <label className="block text-sm text-clawd-text-dim mb-1">Type</label>
                <select
                  value={newTemplate.type}
                  onChange={(e) => setNewTemplate({ ...newTemplate, type: e.target.value as Template['type'] })}
                  className="w-full px-3 py-2 bg-clawd-bg border border-clawd-border rounded-xl focus:outline-none focus:border-clawd-accent"
                >
                  <option value="tweet">Tweet</option>
                  <option value="email">Email</option>
                  <option value="message">Message</option>
                  <option value="generic">Generic</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-clawd-text-dim mb-1">Content</label>
                <textarea
                  value={newTemplate.content}
                  onChange={(e) => setNewTemplate({ ...newTemplate, content: e.target.value })}
                  className="w-full h-32 px-3 py-2 bg-clawd-bg border border-clawd-border rounded-xl focus:outline-none focus:border-clawd-accent resize-none"
                  placeholder="Use {variable} for placeholders"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 text-clawd-text-dim hover:text-clawd-text"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!newTemplate.name || !newTemplate.content}
                className="px-4 py-2 bg-clawd-accent text-white rounded-xl disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
