import { useState, useEffect } from 'react';
import { Folder, Check, X } from 'lucide-react';
import { Box, Flex, Text, Heading } from '@radix-ui/themes';
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
    <Box className="bg-mission-control-surface rounded-lg border border-mission-control-border max-w-md w-full">
      {/* Header */}
      <Flex align="center" justify="between" p="4" className="border-b border-mission-control-border">
        <Flex align="center" gap="2">
          <Folder size={16} className="text-mission-control-accent" />
          <Box>
            <Heading size="3" as="h3">Assign to Folders</Heading>
            <Text size="1" className="text-mission-control-text-dim truncate">{getSessionName()}</Text>
          </Box>
        </Flex>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close"
            className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
          >
            <X size={16} />
          </button>
        )}
      </Flex>

      {/* Folders List */}
      <Box className="max-h-96 overflow-y-auto">
        {loading ? (
          <Flex align="center" justify="center" p="6">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-mission-control-accent border-t-transparent" />
          </Flex>
        ) : allFolders.length === 0 ? (
          <Flex direction="column" align="center" p="6" className="text-mission-control-text-dim">
            <Folder size={32} className="mx-auto mb-2 opacity-50" />
            <Text size="2">No folders available</Text>
            <Text size="1" mt="1">Create a folder first</Text>
          </Flex>
        ) : (
          <div className="divide-y divide-mission-control-border">
            {allFolders.map((folder) => {
              const assigned = isAssigned(folder.id);
              const isWorking = assigningId === folder.id;

              return (
                <button
                  type="button"
                  key={folder.id}
                  onClick={() => handleToggle(folder.id, folder.name)}
                  disabled={isWorking}
                  className="w-full p-3 flex items-center gap-3 hover:bg-mission-control-bg/50 transition-colors disabled:opacity-50 text-left"
                >
                  <div className="text-2xl">{folder.icon}</div>
                  <Box flexGrow="1" minWidth="0">
                    <Flex align="center" gap="2">
                      <span className="font-medium">{folder.name}</span>
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: folder.color }}
                      />
                    </Flex>
                    {folder.conversation_count !== undefined && (
                      <Text size="1" className="text-mission-control-text-dim">
                        {folder.conversation_count} conversation{folder.conversation_count !== 1 ? 's' : ''}
                      </Text>
                    )}
                  </Box>
                  <Box flexShrink="0">
                    {isWorking ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-mission-control-accent border-t-transparent" />
                    ) : assigned ? (
                      <Flex align="center" justify="center" className="w-5 h-5 bg-mission-control-accent rounded">
                        <Check size={14} className="text-white" />
                      </Flex>
                    ) : (
                      <div className="w-5 h-5 border-2 border-mission-control-border rounded" />
                    )}
                  </Box>
                </button>
              );
            })}
          </div>
        )}
      </Box>

      {/* Footer */}
      <Box p="3" className="border-t border-mission-control-border bg-mission-control-bg/50">
        <Text size="1" className="text-mission-control-text-dim">
          {assignedFolders.length > 0 ? (
            <span>
              In {assignedFolders.length} folder{assignedFolders.length !== 1 ? 's' : ''}:{' '}
              {assignedFolders.map((f) => f.name).join(', ')}
            </span>
          ) : (
            <span>Not in any folders</span>
          )}
        </Text>
      </Box>
    </Box>
  );
}
