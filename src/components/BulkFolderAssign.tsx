import { useState, useEffect } from 'react';
import { X, FolderPlus, CheckSquare, Square, Loader2 } from 'lucide-react';

interface MessageFolder {
  id: number;
  name: string;
  icon: string;
  color: string;
  description?: string;
}

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
      const result = await window.clawdbot!.folders.list();
      if (result.success && result.folders) {
        setFolders(result.folders);
      }
    } catch (error) {
      console.error('[BulkFolderAssign] Failed to load folders:', error);
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
      alert('Please select at least one folder');
      return;
    }

    try {
      setAssigning(true);
      
      // Assign each session to selected folders
      for (const sessionKey of sessionKeys) {
        for (const folderId of selectedFolders) {
          const result = await window.clawdbot!.folders.assign(
            folderId,
            sessionKey,
            'Bulk assignment'
          );
          
          if (!result.success) {
            console.error(`[BulkFolderAssign] Failed to assign ${sessionKey} to folder ${folderId}:`, result.error);
          }
        }
      }

      onClose();
    } catch (error) {
      console.error('[BulkFolderAssign] Failed to assign folders:', error);
      alert('Failed to assign folders. See console for details.');
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-clawd-surface rounded-lg shadow-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-clawd-border">
        <div className="flex items-center gap-2">
          <FolderPlus size={20} className="text-clawd-accent" />
          <h3 className="font-semibold">Bulk Folder Assignment</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-clawd-border rounded transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Info */}
      <div className="p-4 bg-info-subtle border-b border-clawd-border">
        <p className="text-sm text-info">
          Assigning {sessionKeys.length} conversation{sessionKeys.length !== 1 ? 's' : ''} to selected folders
        </p>
      </div>

      {/* Folder List */}
      <div className="p-4 max-h-96 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={24} className="animate-spin text-clawd-text-dim" />
          </div>
        ) : folders.length === 0 ? (
          <div className="text-center py-8 text-clawd-text-dim">
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
                  onClick={() => toggleFolder(folder.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all ${
                    isSelected
                      ? 'border-clawd-accent bg-clawd-accent/10'
                      : 'border-clawd-border hover:border-clawd-accent/50 hover:bg-clawd-bg'
                  }`}
                >
                  <div className="flex-shrink-0">
                    {isSelected ? (
                      <CheckSquare size={16} className="text-clawd-accent" />
                    ) : (
                      <Square size={16} className="text-clawd-text-dim" />
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
                      <div className="text-xs text-clawd-text-dim truncate">
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
      <div className="flex items-center justify-between gap-3 p-4 border-t border-clawd-border bg-clawd-bg">
        <div className="text-sm text-clawd-text-dim">
          {selectedFolders.size} folder{selectedFolders.size !== 1 ? 's' : ''} selected
        </div>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-clawd-border hover:bg-clawd-border/80 rounded-lg transition-colors"
            disabled={assigning}
          >
            Cancel
          </button>
          <button
            onClick={handleAssign}
            disabled={selectedFolders.size === 0 || assigning}
            className="px-4 py-2 bg-clawd-accent hover:bg-clawd-accent/90 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
          </button>
        </div>
      </div>
    </div>
  );
}
