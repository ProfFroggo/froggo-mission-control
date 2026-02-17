import { useState, useEffect } from 'react';
import { Folder, Plus, Edit2, Trash2, X, Check, FolderOpen, Tag, Zap } from 'lucide-react';
import { showToast } from './Toast';
import SmartFolderRuleEditor from './SmartFolderRuleEditor';
import ConfirmDialog, { useConfirmDialog } from './ConfirmDialog';

interface FolderManagerProps {
  onClose?: () => void;
  onSelect?: (folderId: number) => void;
}

export default function FolderManager({ onClose, onSelect }: FolderManagerProps) {
  const [folders, setFolders] = useState<MessageFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    icon: '📁',
    color: '#6366f1',
    description: '',
  });
  const { open, config, onConfirm, showConfirm, closeConfirm } = useConfirmDialog();

  const loadFolders = async () => {
    setLoading(true);
    try {
      const result = await window.clawdbot?.folders.list();
      if (result?.success) {
        setFolders(result?.folders || []);
      } else {
        showToast('error', 'Failed to load folders');
      }
    } catch (error) {
      // '[FolderManager] Load error:', error;
      showToast('error', 'Failed to load folders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFolders();
  }, []);

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      showToast('error', 'Folder name is required');
      return;
    }

    try {
      const result = await window.clawdbot?.folders.create(formData);
      if (result?.success) {
        showToast('success', `Folder "${formData.name}" created`);
        setFormData({ name: '', icon: '📁', color: '#6366f1', description: '' });
        setShowCreate(false);
        loadFolders();
      } else {
        showToast('error', result?.error || 'Failed to create folder');
      }
    } catch (error) {
      // '[FolderManager] Create error:', error;
      showToast('error', 'Failed to create folder');
    }
  };

  const handleUpdate = async (folderId: number) => {
    if (!formData.name.trim()) {
      showToast('error', 'Folder name is required');
      return;
    }

    try {
      const result = await window.clawdbot?.folders.update(folderId, formData);
      if (result?.success) {
        showToast('success', 'Folder updated');
        setEditingId(null);
        setFormData({ name: '', icon: '📁', color: '#6366f1', description: '' });
        loadFolders();
      } else {
        showToast('error', result?.error || 'Failed to update folder');
      }
    } catch (error) {
      // '[FolderManager] Update error:', error;
      showToast('error', 'Failed to update folder');
    }
  };

  const handleDelete = async (folderId: number, folderName: string) => {
    showConfirm({
      title: 'Delete Folder',
      message: `Delete folder "${folderName}"? This will remove all conversation assignments.`,
      confirmLabel: 'Delete Folder',
      type: 'danger',
    }, async () => {
      try {
        const result = await window.clawdbot?.folders.delete(folderId);
        if (result?.success) {
          showToast('success', `Folder "${folderName}" deleted`);
          loadFolders();
        } else {
          showToast('error', result?.error || 'Failed to delete folder');
        }
      } catch (error) {
        // '[FolderManager] Delete error:', error;
        showToast('error', 'Failed to delete folder');
      }
    });
  };

  const startEdit = (folder: MessageFolder) => {
    setEditingId(folder.id);
    setFormData({
      name: folder.name,
      icon: folder.icon ?? '',
      color: folder.color ?? '',
      description: folder.description || '',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormData({ name: '', icon: '📁', color: '#6366f1', description: '' });
  };

  const cancelCreate = () => {
    setShowCreate(false);
    setFormData({ name: '', icon: '📁', color: '#6366f1', description: '' });
  };

  const iconOptions = ['📁', '⭐', '💼', '👤', '📦', '🔥', '💡', '🎯', '📌', '🏷️', '🔖', '📚'];
  const colorOptions = [
    '#6366f1', // indigo
    '#f59e0b', // amber
    '#3b82f6', // blue
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#10b981', // green
    '#f43f5e', // rose
    '#6b7280', // gray
    '#06b6d4', // cyan
    '#84cc16', // lime
  ];

  return (
    <div className="h-full flex flex-col bg-clawd-surface">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-clawd-border">
        <div className="flex items-center gap-3">
          <Folder size={20} className="text-clawd-accent" />
          <h2 className="text-lg font-semibold">Folder Management</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-clawd-accent hover:bg-clawd-accent-hover text-white rounded-lg transition-colors text-sm"
          >
            <Plus size={14} />
            New Folder
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-clawd-border rounded-lg transition-colors"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="p-4 border-b border-clawd-border bg-clawd-bg">
          <div className="space-y-3">
            <div className="flex gap-3">
              {/* Icon Picker */}
              <div className="w-24">
                <span className="block text-xs font-medium mb-1 text-clawd-text-dim">Icon</span>
                <div className="grid grid-cols-4 gap-1 p-1 bg-clawd-surface border border-clawd-border rounded-lg">
                  {iconOptions.map((icon) => (
                    <button
                      key={icon}
                      onClick={() => setFormData({ ...formData, icon })}
                      className={`text-2xl p-1 rounded transition-colors ${
                        formData.icon === icon ? 'bg-clawd-accent/20' : 'hover:bg-clawd-border'
                      }`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>

              {/* Name & Description */}
              <div className="flex-1 space-y-2">
                <div>
                  <label htmlFor="folder-name" className="block text-xs font-medium mb-1 text-clawd-text-dim">Name</label>
                  <input
                    id="folder-name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Client Work"
                    className="w-full bg-clawd-surface border border-clawd-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-clawd-accent"
                    /* autoFocus removed for accessibility */
                  />
                </div>
                <div>
                  <label htmlFor="folder-description" className="block text-xs font-medium mb-1 text-clawd-text-dim">Description (optional)</label>
                  <input
                    id="folder-description"
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="e.g., Work-related discussions"
                    className="w-full bg-clawd-surface border border-clawd-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-clawd-accent"
                  />
                </div>
              </div>

              {/* Color Picker */}
              <div className="w-28">
                <span className="block text-xs font-medium mb-1 text-clawd-text-dim">Color</span>
                <div className="grid grid-cols-5 gap-1 p-1 bg-clawd-surface border border-clawd-border rounded-lg">
                  {colorOptions.map((color) => (
                    <button
                      key={color}
                      onClick={() => setFormData({ ...formData, color })}
                      className={`w-6 h-6 rounded transition-all ${
                        formData.color === color ? 'ring-2 ring-white scale-110' : 'hover:scale-110'
                      }`}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <button
                onClick={cancelCreate}
                className="px-3 py-1.5 text-sm bg-clawd-border hover:bg-clawd-border/80 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-clawd-accent hover:bg-clawd-accent-hover text-white rounded-lg transition-colors"
              >
                <Check size={14} />
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Folders List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-clawd-accent border-t-transparent" />
          </div>
        ) : folders.length === 0 ? (
          <div className="p-8 text-center text-clawd-text-dim">
            <FolderOpen size={32} className="mx-auto mb-3 opacity-50" />
            <p>No folders yet</p>
            <p className="text-sm mt-1">Create your first folder to organize conversations</p>
          </div>
        ) : (
          <div className="divide-y divide-clawd-border">
            {folders.map((folder) => (
              <div
                key={folder.id}
                className="p-4 hover:bg-clawd-bg/50 transition-colors group"
              >
                {editingId === folder.id ? (
                  /* Edit Mode */
                  <div className="space-y-3">
                    <div className="flex gap-3">
                      {/* Icon Picker */}
                      <div className="w-24">
                        <div className="grid grid-cols-4 gap-1 p-1 bg-clawd-surface border border-clawd-border rounded-lg">
                          {iconOptions.map((icon) => (
                            <button
                              key={icon}
                              onClick={() => setFormData({ ...formData, icon })}
                              className={`text-2xl p-1 rounded transition-colors ${
                                formData.icon === icon ? 'bg-clawd-accent/20' : 'hover:bg-clawd-border'
                              }`}
                            >
                              {icon}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex-1 space-y-2">
                        <input
                          type="text"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="w-full bg-clawd-surface border border-clawd-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-clawd-accent"
                        />
                        <input
                          type="text"
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          placeholder="Description (optional)"
                          className="w-full bg-clawd-surface border border-clawd-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-clawd-accent"
                        />
                      </div>

                      <div className="w-28">
                        <div className="grid grid-cols-5 gap-1 p-1 bg-clawd-surface border border-clawd-border rounded-lg">
                          {colorOptions.map((color) => (
                            <button
                              key={color}
                              onClick={() => setFormData({ ...formData, color })}
                              className={`w-6 h-6 rounded transition-all ${
                                formData.color === color ? 'ring-2 ring-white scale-110' : 'hover:scale-110'
                              }`}
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2">
                      <button
                        onClick={cancelEdit}
                        className="px-3 py-1.5 text-sm bg-clawd-border hover:bg-clawd-border/80 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleUpdate(folder.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-clawd-accent hover:bg-clawd-accent-hover text-white rounded-lg transition-colors"
                      >
                        <Check size={14} />
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  /* View Mode */
                  <div className="flex items-start gap-3">
                    <div className="text-3xl">{folder.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">{folder.name}</h3>
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: folder.color }}
                          title={folder.color}
                        />
                        {folder.is_smart === 1 && (
                          <span className="px-2 py-0.5 text-xs bg-clawd-accent/20 text-clawd-accent rounded-full">
                            Smart
                          </span>
                        )}
                      </div>
                      {folder.description && (
                        <p className="text-sm text-clawd-text-dim mb-2">{folder.description}</p>
                      )}
                      <div className="text-xs text-clawd-text-dim">
                        {folder.conversation_count} conversation{folder.conversation_count !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {onSelect && (
                        <button
                          onClick={() => onSelect(folder.id)}
                          className="p-2 hover:bg-clawd-border rounded-lg transition-colors"
                          title="View conversations"
                        >
                          <Tag size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => setEditingRuleId(folder.id)}
                        className="p-2 hover:bg-clawd-border rounded-lg transition-colors"
                        title="Smart folder rules"
                      >
                        <Zap size={14} className={folder.is_smart === 1 ? 'text-clawd-accent' : ''} />
                      </button>
                      <button
                        onClick={() => startEdit(folder)}
                        className="p-2 hover:bg-clawd-border rounded-lg transition-colors"
                        title="Edit folder"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(folder.id, folder.name)}
                        className="p-2 hover:bg-error-subtle text-error rounded-lg transition-colors"
                        title="Delete folder"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Smart Folder Rule Editor Modal */}
      {editingRuleId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-4xl h-[90vh] bg-clawd-surface rounded-xl shadow-2xl overflow-hidden">
            <SmartFolderRuleEditor
              folderId={editingRuleId}
              folderName={folders.find(f => f.id === editingRuleId)?.name || 'Folder'}
              onClose={() => {
                setEditingRuleId(null);
                loadFolders(); // Reload to update is_smart badge
              }}
              onSave={() => {
                loadFolders(); // Reload to update is_smart badge
              }}
            />
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
