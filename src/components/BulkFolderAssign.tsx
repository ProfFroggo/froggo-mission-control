import { useState, useEffect } from 'react';
import { X, FolderPlus, CheckSquare, Square, Loader2 } from 'lucide-react';
import { Button, IconButton } from '@radix-ui/themes';
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
      <div className="flex items-center justify-between p-4 border-b border-mission-control-border">
        <div className="flex items-center gap-2">
          <FolderPlus size={20} className="text-mission-control-accent" />
          <h3 className="font-semibold">Bulk Folder Assignment</h3>
        </div>
        <IconButton
          onClick={onClose}
          aria-label="Close"
          variant="ghost"
          color="gray"
          size="2"
          radius="medium"
        >
          <X size={16} />
        </IconButton>
      </div>

      {/* Info */}
      <div className="p-4 bg-info-subtle border-b border-mission-control-border">
        <p className="text-sm text-info">
          Assigning {sessionKeys.length} conversation{sessionKeys.length !== 1 ? 's' : ''} to selected folders
        </p>
      </div>

      {/* Folder List */}
      <div className="p-4 max-h-96 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={24} className="animate-spin text-mission-control-text-dim" />
          </div>
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
                <Button
                  key={folder.id}
                  onClick={() => toggleFolder(folder.id)}
                  variant={isSelected ? 'soft' : 'ghost'}
                  color="gray"
                  size="3"
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all ${
                    isSelected
                      ? 'border-mission-control-accent'
                      : 'border-mission-control-border'
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
                </Button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-3 p-4 border-t border-mission-control-border bg-mission-control-bg">
        <div className="text-sm text-mission-control-text-dim">
          {selectedFolders.size} folder{selectedFolders.size !== 1 ? 's' : ''} selected
        </div>
        <div className="flex gap-2">
          <Button
            onClick={onClose}
            variant="ghost"
            color="gray"
            size="2"
            disabled={assigning}
          >
            Cancel
          </Button>
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
        </div>
      </div>
    </div>
  );
}
