import { useState, useEffect } from 'react';
import { Folder, Check, X } from 'lucide-react';
import { showToast } from './Toast';

interface FolderSelectorProps {
  sessionKey: string;
  onClose?: () => void;
}

export default function FolderSelector({ sessionKey, onClose }: FolderSelectorProps) {
  const [allFolders, setAllFolders] = useState<MessageFolder[]>([]);
  const [assignedFolders, setAssignedFolders] = useState<AssignedFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigningId, setAssigningId] = useState<number | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [foldersResult, assignedResult] = await Promise.all([
        fetch('/api/library?action=folders').then(r => r.ok ? r.json() : { success: false }),
        fetch(`/api/library?action=folders-for-conversation&sessionKey=${encodeURIComponent(sessionKey)}`).then(r => r.ok ? r.json() : { success: false }),
      ]);

      if (foldersResult.success) {
        setAllFolders(foldersResult.folders || []);
      }

      if (assignedResult.success) {
        setAssignedFolders(assignedResult.folders || []);
      }
    } catch (error) {
      // '[FolderSelector] Load error:', error;
      showToast('error', 'Failed to load folders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [sessionKey]);

  const isAssigned = (folderId: number) => {
    return assignedFolders.some((f) => f.id === folderId);
  };

  const handleToggle = async (folderId: number, folderName: string) => {
    setAssigningId(folderId);
    try {
      const assigned = isAssigned(folderId);
      
      if (assigned) {
        // Unassign
        const result = await fetch('/api/library', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'folder-unassign', folderId, sessionKey }),
        }).then(r => r.ok ? r.json() : { success: false });
        if (result.success) {
          showToast('success', `Removed from "${folderName}"`);
          loadData();
        } else {
          showToast('error', result.error || 'Failed to remove from folder');
        }
      } else {
        // Assign
        const result = await fetch('/api/library', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'folder-assign', folderId, sessionKey }),
        }).then(r => r.ok ? r.json() : { success: false });
        if (result.success) {
          showToast('success', `Added to "${folderName}"`);
          loadData();
        } else {
          showToast('error', result.error || 'Failed to add to folder');
        }
      }
    } catch (error) {
      // '[FolderSelector] Toggle error:', error;
      showToast('error', 'Failed to update folder assignment');
    } finally {
      setAssigningId(null);
    }
  };

  const getSessionName = () => {
    const parts = sessionKey.split(':');
    return parts[parts.length - 1].slice(0, 30) + (parts[parts.length - 1].length > 30 ? '...' : '');
  };

  return (
    <div className="bg-clawd-surface rounded-lg border border-clawd-border max-w-md w-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-clawd-border">
        <div className="flex items-center gap-2">
          <Folder size={16} className="text-clawd-accent" />
          <div>
            <h3 className="font-semibold">Assign to Folders</h3>
            <p className="text-xs text-clawd-text-dim truncate">{getSessionName()}</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-clawd-border rounded-lg transition-colors"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Folders List */}
      <div className="max-h-96 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-clawd-accent border-t-transparent" />
          </div>
        ) : allFolders.length === 0 ? (
          <div className="p-8 text-center text-clawd-text-dim">
            <Folder size={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">No folders available</p>
            <p className="text-xs mt-1">Create a folder first</p>
          </div>
        ) : (
          <div className="divide-y divide-clawd-border">
            {allFolders.map((folder) => {
              const assigned = isAssigned(folder.id);
              const isWorking = assigningId === folder.id;

              return (
                <button
                  key={folder.id}
                  onClick={() => handleToggle(folder.id, folder.name)}
                  disabled={isWorking}
                  className="w-full p-3 flex items-center gap-3 hover:bg-clawd-bg/50 transition-colors disabled:opacity-50 text-left"
                >
                  <div className="text-2xl">{folder.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{folder.name}</span>
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: folder.color }}
                      />
                    </div>
                    {folder.conversation_count !== undefined && (
                      <div className="text-xs text-clawd-text-dim">
                        {folder.conversation_count} conversation{folder.conversation_count !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    {isWorking ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-clawd-accent border-t-transparent" />
                    ) : assigned ? (
                      <div className="w-5 h-5 bg-clawd-accent rounded flex items-center justify-center">
                        <Check size={14} className="text-white" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 border-2 border-clawd-border rounded" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-clawd-border bg-clawd-bg/50">
        <div className="text-xs text-clawd-text-dim">
          {assignedFolders.length > 0 ? (
            <span>
              In {assignedFolders.length} folder{assignedFolders.length !== 1 ? 's' : ''}:{' '}
              {assignedFolders.map((f) => f.name).join(', ')}
            </span>
          ) : (
            <span>Not in any folders</span>
          )}
        </div>
      </div>
    </div>
  );
}
