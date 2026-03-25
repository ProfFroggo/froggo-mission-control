import { useState, useEffect } from 'react';
import { X, FolderPlus, CheckSquare, Square, Loader2 } from 'lucide-react';
import { Button, Flex } from '@radix-ui/themes';
import { showToast } from './Toast';
import { createLogger } from '../utils/logger';

const logger = createLogger('BulkFolderAssign');

interface BulkFolderAssignProps {
  sessionKeys: string[];
  onClose: () => void;
}

export default function BulkFolderAssign({ sessionKeys, onClose }: BulkFolderAssignProps) {
  const [folders, setFolders] = useState<MessageFolder[]>([]);
  const [selectedFolders, setSelectedFolders] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    loadFolders();
  }, []);

  const loadFolders = async () => {
    try {
      setLoading(true);
      const result = await fetch('/api/library?action=folders').then(r => r.ok ? r.json() : { success: false });
      if (result.success && result.folders) {
        setFolders(result.folders);
      }
    } catch (error) {
      // '[BulkFolderAssign] Failed to load folders:', error;
    } finally {
      setLoading(false);
    }
  };

  const toggleFolder = (folderId: number) => {
    const newSelected = new Set(selectedFolders);
    if (newSelected.has(folderId)) {
      newSelected.delete(folderId);
    } else {
      newSelected.add(folderId);
    }
    setSelectedFolders(newSelected);
  };

  const handleAssign = async () => {
    if (selectedFolders.size === 0) {
      showToast('warning', 'Please select at least one folder');
      return;
    }

    try {
      setAssigning(true);
      
      // Assign each session to selected folders
      for (const sessionKey of sessionKeys) {
        for (const folderId of selectedFolders) {
          const result = await fetch('/api/library', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'folder-assign', folderId, sessionKey, note: 'Bulk assignment' }),
          }).then(r => r.ok ? r.json() : { success: false });
          
          if (!result.success) {
            logger.error(`Failed to assign ${sessionKey} to folder ${folderId}:`, result.error);
          }
        }
      }

      onClose();
    } catch (error) {
      // '[BulkFolderAssign] Failed to assign folders:', error;
      showToast('error', 'Failed to assign folders. See console for details.');
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-mission-control-surface rounded-lg shadow-xl overflow-hidden">
      {/* Header */}
      <Flex align="center" justify="between" className="p-4 border-b border-mission-control-border">
        <Flex align="center" gap="2">
          <FolderPlus size={20} className="text-mission-control-accent" />
          <h3 className="font-semibold">Bulk Folder Assignment</h3>
        </Flex>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
        >
          <X size={16} />
        </button>
      </Flex>

      {/* Info */}
      <div className="p-4 bg-[var(--color-info)]/10 border-b border-mission-control-border">
        <p className="text-sm text-[var(--color-info)]">
          Assigning {sessionKeys.length} conversation{sessionKeys.length !== 1 ? 's' : ''} to selected folders
        </p>
      </div>

      {/* Folder List */}
      <div className="p-4 max-h-96 overflow-y-auto">
        {loading ? (
          <Flex align="center" justify="center" className="py-8">
            <Loader2 size={24} className="animate-spin text-mission-control-text-dim" />
          </Flex>
        ) : folders.length === 0 ? (
          <div className="text-center py-8 text-mission-control-text-dim">
            <p className="mb-2">No folders available</p>
            <p className="text-xs">Create folders first in Folder Manager</p>
          </div>
        ) : (
          <div className="space-y-2">
            {folders.map((folder) => {
              const isSelected = selectedFolders.has(folder.id);
              return (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() => toggleFolder(folder.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                    isSelected
                      ? 'border-mission-control-accent bg-mission-control-accent/5 text-mission-control-text'
                      : 'border-mission-control-border text-mission-control-text hover:bg-mission-control-border/20'
                  }`}
                >
                  <div className="flex-shrink-0">
                    {isSelected ? (
                      <CheckSquare size={16} className="text-mission-control-accent" />
                    ) : (
                      <Square size={16} className="text-mission-control-text-dim" />
                    )}
                  </div>
                  <div
                    className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                    style={{ backgroundColor: folder.color }}
                  >
                    {folder.icon}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <div className="font-medium truncate">{folder.name}</div>
                    {folder.description && (
                      <div className="text-xs text-mission-control-text-dim truncate">
                        {folder.description}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <Flex align="center" justify="between" gap="3" className="p-4 border-t border-mission-control-border bg-mission-control-bg">
        <div className="text-sm text-mission-control-text-dim">
          {selectedFolders.size} folder{selectedFolders.size !== 1 ? 's' : ''} selected
        </div>
        <Flex gap="2">
          <button
            type="button"
            onClick={onClose}
            disabled={assigning}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <Button
            onClick={handleAssign}
            disabled={selectedFolders.size === 0 || assigning}
            variant="solid"
            size="2"
          >
            {assigning ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Assigning...
              </>
            ) : (
              <>
                <FolderPlus size={16} />
                Assign to Folders
              </>
            )}
          </Button>
        </Flex>
      </Flex>
    </div>
  );
}
