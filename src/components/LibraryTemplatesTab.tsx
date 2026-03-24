import { useState } from 'react';
import { Button, IconButton, TextField, Select, TextArea, Flex } from '@radix-ui/themes';
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
    <Flex direction="column" height="100%">
      {/* Toolbar */}
      <div className="p-6 border-b border-mission-control-border bg-mission-control-surface">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-mission-control-text-dim">
            Reusable content templates
          </p>
          <Button
            onClick={() => setShowCreate(true)}
            size="2"
            variant="solid"
          >
            <Plus size={16} />
            New Template
          </Button>
        </div>

        {/* Search and filters */}
        <div className="flex gap-3">
          <div className="flex-1">
            <TextField.Root
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search templates..."
              size="2"
            >
              <TextField.Slot>
                <Search size={16} />
              </TextField.Slot>
            </TextField.Root>
          </div>
          <Select.Root value={typeFilter} onValueChange={setTypeFilter}>
            <Select.Trigger />
            <Select.Content>
              <Select.Item value="all">All Types</Select.Item>
              <Select.Item value="tweet">Tweets</Select.Item>
              <Select.Item value="email">Emails</Select.Item>
              <Select.Item value="message">Messages</Select.Item>
              <Select.Item value="generic">Generic</Select.Item>
            </Select.Content>
          </Select.Root>
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
                        <TextField.Root
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          size="1"
                          variant="soft"
                        />
                      ) : (
                        <span className="font-medium">{template.name}</span>
                      )}
                    </div>
                    <IconButton
                      onClick={() => handleStar(template.id)}
                      size="1"
                      variant="ghost"
                     
                    >
                      {template.starred ? (
                        <Star size={14} className="text-warning fill-yellow-400" />
                      ) : (
                        <StarOff size={14} className="text-mission-control-text-dim" />
                      )}
                    </IconButton>
                  </div>

                  {/* Content */}
                  {isEditing ? (
                    <TextArea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="w-full"
                      style={{ height: '6rem' }}
                      resize="none"
                      size="1"
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
                          <Button
                            onClick={() => setEditingId(null)}
                            size="1"
                            variant="ghost"
                            color="gray"
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={handleSave}
                            size="1"
                            variant="solid"
                          >
                            Save
                          </Button>
                        </>
                      ) : (
                        <>
                          <IconButton
                            onClick={() => handleCopy(template)}
                            size="1"
                            variant="ghost"
                           
                            title="Copy"
                          >
                            <Copy size={14} />
                          </IconButton>
                          <IconButton
                            onClick={() => handleEdit(template)}
                            size="1"
                            variant="ghost"
                           
                            title="Edit"
                          >
                            <Edit3 size={14} />
                          </IconButton>
                          <IconButton
                            onClick={() => handleDelete(template.id)}
                            size="1"
                            variant="ghost"
                            color="red"
                           
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </IconButton>
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
                <TextField.Root
                  id="template-name"
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                  placeholder="Template name"
                  size="2"
                />
              </div>
              <div>
                <label htmlFor="template-type" className="block text-sm text-mission-control-text-dim mb-1">Type</label>
                <Select.Root value={newTemplate.type} onValueChange={(v) => setNewTemplate({ ...newTemplate, type: v as Template['type'] })}>
                  <Select.Trigger id="template-type" className="w-full" />
                  <Select.Content>
                    <Select.Item value="tweet">Tweet</Select.Item>
                    <Select.Item value="email">Email</Select.Item>
                    <Select.Item value="message">Message</Select.Item>
                    <Select.Item value="generic">Generic</Select.Item>
                  </Select.Content>
                </Select.Root>
              </div>
              <div>
                <label htmlFor="template-content" className="block text-sm text-mission-control-text-dim mb-1">Content</label>
                <TextArea
                  id="template-content"
                  value={newTemplate.content}
                  onChange={(e) => setNewTemplate({ ...newTemplate, content: e.target.value })}
                  className="w-full"
                  style={{ height: '8rem' }}
                  resize="none"
                  placeholder="Use {variable} for placeholders"
                  size="2"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button
                onClick={() => setShowCreate(false)}
                size="2"
                variant="ghost"
                color="gray"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!newTemplate.name || !newTemplate.content}
                size="2"
                variant="solid"
              >
                Create
              </Button>
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
    </Flex>
  );
}
