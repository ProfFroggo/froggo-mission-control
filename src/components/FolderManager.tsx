import { useState, useEffect } from 'react';
import { Folder, Plus, Edit2, Trash2, X, Check, FolderOpen, Tag, Zap, Star, Briefcase, User, Package, Flame, Lightbulb, Target, Pin, Bookmark, BookOpen, type LucideIcon } from 'lucide-react';
import { Button, IconButton, TextField, Box, Flex, Grid, Text, Heading } from '@radix-ui/themes';
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
    icon: 'Folder',
    color: '#6366f1',
    description: '',
  });
  const { open, config, onConfirm, showConfirm, closeConfirm } = useConfirmDialog();

  const loadFolders = async () => {
    setLoading(true);
    try {
      const result = await fetch('/api/library?action=folders').then(r => r.ok ? r.json() : { success: false });
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
      const result = await fetch('/api/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'folder-create', ...formData }),
      }).then(r => r.ok ? r.json() : { success: false });
      if (result?.success) {
        showToast('success', `Folder "${formData.name}" created`);
        setFormData({ name: '', icon: 'Folder', color: '#6366f1', description: '' });
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
      const result = await fetch('/api/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'folder-update', id: folderId, ...formData }),
      }).then(r => r.ok ? r.json() : { success: false });
      if (result?.success) {
        showToast('success', 'Folder updated');
        setEditingId(null);
        setFormData({ name: '', icon: 'Folder', color: '#6366f1', description: '' });
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
        const result = await fetch('/api/library', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'folder-delete', id: folderId }),
        }).then(r => r.ok ? r.json() : { success: false });
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
    setFormData({ name: '', icon: 'Folder', color: '#6366f1', description: '' });
  };

  const cancelCreate = () => {
    setShowCreate(false);
    setFormData({ name: '', icon: 'Folder', color: '#6366f1', description: '' });
  };

  const iconOptions: { value: string; label: string; icon: LucideIcon }[] = [
    { value: 'Folder', label: 'Folder', icon: Folder },
    { value: 'Star', label: 'Star', icon: Star },
    { value: 'Briefcase', label: 'Work', icon: Briefcase },
    { value: 'User', label: 'Person', icon: User },
    { value: 'Package', label: 'Package', icon: Package },
    { value: 'Flame', label: 'Hot', icon: Flame },
    { value: 'Lightbulb', label: 'Idea', icon: Lightbulb },
    { value: 'Target', label: 'Target', icon: Target },
    { value: 'Pin', label: 'Pin', icon: Pin },
    { value: 'Tag', label: 'Tag', icon: Tag },
    { value: 'Bookmark', label: 'Bookmark', icon: Bookmark },
    { value: 'BookOpen', label: 'Library', icon: BookOpen },
  ];

  const getIconComponent = (iconValue: string): LucideIcon => {
    return iconOptions.find(o => o.value === iconValue)?.icon ?? Folder;
  };
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
    <Flex direction="column" height="100%" className="bg-mission-control-surface">
      {/* Header */}
      <Flex align="center" justify="between" p="4" className="border-b border-mission-control-border">
        <Flex align="center" gap="3">
          <Folder size={20} className="text-mission-control-accent" />
          <Heading size="4" as="h2">Folder Management</Heading>
        </Flex>
        <Flex align="center" gap="2">
          <Button
            onClick={() => setShowCreate(true)}
            size="2"
            variant="solid"
          >
            <Plus size={14} />
            New Folder
          </Button>
          {onClose && (
            <IconButton
              onClick={onClose}
              size="2"
              variant="ghost"
              aria-label="Close"
            >
              <X size={16} />
            </IconButton>
          )}
        </Flex>
      </Flex>

      {/* Create Form */}
      {showCreate && (
        <Box p="4" className="border-b border-mission-control-border bg-mission-control-bg">
          <Flex direction="column" gap="3">
            <Flex gap="3">
              {/* Icon Picker */}
              <Box style={{ width: '6rem' }}>
                <Text size="1" weight="medium" mb="1" className="text-mission-control-text-dim" as="div">Icon</Text>
                <Grid columns="4" gap="1" p="1" className="bg-mission-control-surface border border-mission-control-border rounded-lg">
                  {iconOptions.map((opt) => {
                    const OptIcon = opt.icon;
                    return (
                      <IconButton
                        key={opt.value}
                        onClick={() => setFormData({ ...formData, icon: opt.value })}
                        title={opt.label}
                        size="1"
                        variant={formData.icon === opt.value ? 'soft' : 'ghost'}
                       
                        aria-label={opt.label}
                      >
                        <OptIcon size={16} />
                      </IconButton>
                    );
                  })}
                </Grid>
              </Box>

              {/* Name & Description */}
              <Flex direction="column" gap="2" flexGrow="1">
                <Box>
                  <label htmlFor="folder-name" className="block text-xs font-medium mb-1 text-mission-control-text-dim">Name</label>
                  <TextField.Root
                    id="folder-name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Client Work"
                    size="2"
                  />
                </Box>
                <Box>
                  <label htmlFor="folder-description" className="block text-xs font-medium mb-1 text-mission-control-text-dim">Description (optional)</label>
                  <TextField.Root
                    id="folder-description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="e.g., Work-related discussions"
                    size="2"
                  />
                </Box>
              </Flex>

              {/* Color Picker */}
              <Box style={{ width: '7rem' }}>
                <Text size="1" weight="medium" mb="1" className="text-mission-control-text-dim" as="div">Color</Text>
                <Grid columns="5" gap="1" p="1" className="bg-mission-control-surface border border-mission-control-border rounded-lg">
                  {colorOptions.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormData({ ...formData, color })}
                      className={`w-6 h-6 rounded transition-all ${
                        formData.color === color ? 'ring-2 ring-white dark:ring-white/80 scale-110' : 'hover:scale-110'
                      }`}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </Grid>
              </Box>
            </Flex>

            {/* Actions */}
            <Flex justify="end" gap="2">
              <Button onClick={cancelCreate} size="2" variant="ghost">
                Cancel
              </Button>
              <Button onClick={handleCreate} size="2" variant="solid">
                <Check size={14} />
                Create
              </Button>
            </Flex>
          </Flex>
        </Box>
      )}

      {/* Folders List */}
      <Box flexGrow="1" className="overflow-y-auto">
        {loading ? (
          <Flex align="center" justify="center" style={{ height: '8rem' }}>
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-mission-control-accent border-t-transparent" />
          </Flex>
        ) : folders.length === 0 ? (
          <Flex direction="column" align="center" p="6" className="text-mission-control-text-dim">
            <FolderOpen size={32} className="mx-auto mb-3 opacity-50" />
            <Text as="p">No folders yet</Text>
            <Text size="2" mt="1" as="p">Create your first folder to organize conversations</Text>
          </Flex>
        ) : (
          <div className="divide-y divide-mission-control-border">
            {folders.map((folder) => (
              <Box
                key={folder.id}
                p="4"
                className="hover:bg-mission-control-bg/50 transition-colors group"
              >
                {editingId === folder.id ? (
                  /* Edit Mode */
                  <Flex direction="column" gap="3">
                    <Flex gap="3">
                      {/* Icon Picker */}
                      <Box style={{ width: '6rem' }}>
                        <Grid columns="4" gap="1" p="1" className="bg-mission-control-surface border border-mission-control-border rounded-lg">
                          {iconOptions.map((opt) => {
                            const OptIcon = opt.icon;
                            return (
                              <IconButton
                                key={opt.value}
                                onClick={() => setFormData({ ...formData, icon: opt.value })}
                                title={opt.label}
                                size="1"
                                variant={formData.icon === opt.value ? 'soft' : 'ghost'}
                                aria-label={opt.label}
                              >
                                <OptIcon size={16} />
                              </IconButton>
                            );
                          })}
                        </Grid>
                      </Box>

                      <Flex direction="column" gap="2" flexGrow="1">
                        <TextField.Root
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          size="2"
                        />
                        <TextField.Root
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          placeholder="Description (optional)"
                          size="2"
                        />
                      </Flex>

                      <Box style={{ width: '7rem' }}>
                        <Grid columns="5" gap="1" p="1" className="bg-mission-control-surface border border-mission-control-border rounded-lg">
                          {colorOptions.map((color) => (
                            <button
                              key={color}
                              type="button"
                              onClick={() => setFormData({ ...formData, color })}
                              className={`w-6 h-6 rounded transition-all ${
                                formData.color === color ? 'ring-2 ring-white dark:ring-white/80 scale-110' : 'hover:scale-110'
                              }`}
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </Grid>
                      </Box>
                    </Flex>

                    <Flex justify="end" gap="2">
                      <Button onClick={cancelEdit} size="2" variant="ghost">
                        Cancel
                      </Button>
                      <Button onClick={() => handleUpdate(folder.id)} size="2" variant="solid">
                        <Check size={14} />
                        Save
                      </Button>
                    </Flex>
                  </Flex>
                ) : (
                  /* View Mode */
                  <Flex align="start" gap="3">
                    {(() => { const FolderIcon = getIconComponent(folder.icon ?? 'Folder'); return <div className="text-mission-control-text-dim"><FolderIcon size={28} /></div>; })()}
                    <Box flexGrow="1" minWidth="0">
                      <Flex align="center" gap="2" mb="1">
                        <Heading size="3" as="h3">{folder.name}</Heading>
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: folder.color }}
                          title={folder.color}
                        />
                        {folder.is_smart === 1 && (
                          <span className="px-2 py-0.5 text-xs bg-mission-control-accent/20 text-mission-control-accent rounded-full">
                            Smart
                          </span>
                        )}
                      </Flex>
                      {folder.description && (
                        <Text size="2" className="text-mission-control-text-dim" mb="2" as="p">{folder.description}</Text>
                      )}
                      <Text size="1" className="text-mission-control-text-dim">
                        {folder.conversation_count} conversation{folder.conversation_count !== 1 ? 's' : ''}
                      </Text>
                    </Box>
                    <Flex gap="1" className="opacity-0 group-hover:opacity-100 transition-opacity">
                      {onSelect && (
                        <IconButton
                          onClick={() => onSelect(folder.id)}
                          size="2"
                          variant="ghost"
                         
                          title="View conversations"
                          aria-label="View conversations"
                        >
                          <Tag size={14} />
                        </IconButton>
                      )}
                      <IconButton
                        onClick={() => setEditingRuleId(folder.id)}
                        size="2"
                        variant={folder.is_smart === 1 ? 'soft' : 'ghost'}
                       
                        title="Smart folder rules"
                        aria-label="Smart folder rules"
                      >
                        <Zap size={14} />
                      </IconButton>
                      <IconButton
                        onClick={() => startEdit(folder)}
                        size="2"
                        variant="ghost"
                       
                        title="Edit folder"
                        aria-label="Edit folder"
                      >
                        <Edit2 size={14} />
                      </IconButton>
                      <IconButton
                        onClick={() => handleDelete(folder.id, folder.name)}
                        size="2"
                        variant="ghost"
                        color="red"
                       
                        title="Delete folder"
                        aria-label="Delete folder"
                      >
                        <Trash2 size={14} />
                      </IconButton>
                    </Flex>
                  </Flex>
                )}
              </Box>
            ))}
          </div>
        )}
      </Box>

      {/* Smart Folder Rule Editor Modal */}
      {editingRuleId && (
        <Flex align="center" justify="center" className="fixed inset-0 z-50 bg-black/50">
          <Box className="w-full max-w-4xl h-[90vh] bg-mission-control-surface rounded-lg shadow-2xl overflow-hidden">
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
          </Box>
        </Flex>
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
