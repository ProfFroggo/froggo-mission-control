/* eslint-disable react-hooks/exhaustive-deps */
// LEGACY: VersionPanel uses file-level suppression for intentional patterns.
// Version panel for writing - patterns are safe.
// Review: 2026-02-17 - suppression retained, patterns are safe

import { useEffect, useState } from 'react';
import { X, Save, GitCompare, RotateCcw, Trash2, Loader2 } from 'lucide-react';
import { Button, Flex } from '@radix-ui/themes';
import { useWritingStore } from '../../store/writingStore';
import { useVersionStore } from '../../store/versionStore';
import VersionDiff from './VersionDiff';
import ConfirmDialog, { useConfirmDialog } from '../ConfirmDialog';

interface VersionPanelProps {
  onClose: () => void;
}

export default function VersionPanel({ onClose }: VersionPanelProps) {
  const { activeProjectId, activeChapterId, openChapter, saveChapter, activeChapterContent } = useWritingStore();
  const {
    versions,
    loading,
    activeDiff,
    diffLoading,
    loadVersions,
    saveVersion,
    deleteVersion,
    restoreVersion,
    loadDiff,
    clearDiff,
    reset,
  } = useVersionStore();

  // Modal state
  const [restoreTarget, setRestoreTarget] = useState<{id: string, label: string} | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{id: string, label: string} | null>(null);
  const saveDialog = useConfirmDialog();
  const restoreDialog = useConfirmDialog();
  const deleteDialog = useConfirmDialog();

  useEffect(() => {
    if (activeProjectId && activeChapterId) {
      loadVersions(activeProjectId, activeChapterId);
    }
    return () => {
      reset();
    };
  }, [activeProjectId, activeChapterId]);

  const handleSaveConfirm = async () => {
    if (!activeProjectId || !activeChapterId) return;

    // Flush current content to disk before snapshotting
    if (activeChapterContent !== null) {
      await saveChapter(activeChapterContent);
    }

    await saveVersion(activeProjectId, activeChapterId, undefined);
  };

  const handleRestoreConfirm = async () => {
    if (!activeProjectId || !activeChapterId || !restoreTarget) return;

    const success = await restoreVersion(activeProjectId, activeChapterId, restoreTarget.id);
    if (success) {
      await openChapter(activeChapterId);
    }
    setRestoreTarget(null);
  };

  const handleDeleteConfirm = async () => {
    if (!activeProjectId || !activeChapterId || !deleteTarget) return;

    await deleteVersion(activeProjectId, activeChapterId, deleteTarget.id);
    setDeleteTarget(null);
  };

  const handleCompare = async (versionId: string) => {
    if (!activeProjectId || !activeChapterId) return;

    // Flush current content to disk so diff is accurate
    if (activeChapterContent !== null) {
      await saveChapter(activeChapterContent);
    }

    await loadDiff(activeProjectId, activeChapterId, versionId);
  };

  const formatTime = (isoString: string): string => {
    try {
      return new Date(isoString).toLocaleString();
    } catch {
      return isoString;
    }
  };

  return (
    <Flex direction="column" height="100%" className="w-80 bg-mission-control-surface border-l border-mission-control-border flex-shrink-0">
      {/* Header */}
      <Flex align="center" justify="between" className="px-3 py-2 border-b border-mission-control-border">
        <h3 className="text-[10px] font-bold text-mission-control-text uppercase tracking-wide">Versions</h3>
        <button
          className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
          onClick={onClose}
          title="Close versions panel"
        >
          <X size={14} />
        </button>
      </Flex>

      {/* Save button */}
      <div className="px-3 py-2 border-b border-mission-control-border">
        <Button
          size="1"
          variant="soft"
          className="w-full"
          onClick={() => {
            saveDialog.showConfirm({
              title: 'Save Snapshot',
              message: 'Save the current chapter content as a version snapshot',
              confirmLabel: 'Save',
              type: 'info',
            }, handleSaveConfirm);
          }}
          disabled={!activeChapterId}
          title="Saves the current chapter content as a version snapshot"
        >
          <Save size={13} />
          Save Snapshot
        </Button>
      </div>

      {/* Version list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <Flex align="center" justify="center" className="py-8 text-mission-control-text-dim">
            <Loader2 size={16} className="animate-spin" />
          </Flex>
        ) : versions.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-mission-control-text-dim">
            <p>No versions saved yet.</p>
            <p className="mt-1">Save a snapshot before making major edits.</p>
          </div>
        ) : (
          <div className="divide-y divide-mission-control-border/50">
            {versions.map((v) => (
              <div key={v.id} className="px-3 py-2 group hover:bg-mission-control-border/30 transition-colors">
                <Flex align="start" justify="between" gap="2">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-mission-control-text truncate">{v.label}</div>
                    <div className="text-[10px] text-mission-control-text-dim mt-0.5">
                      {formatTime(v.createdAt)} &middot; {v.wordCount.toLocaleString()} words
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button
                      className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors disabled:opacity-50"
                      onClick={() => handleCompare(v.id)}
                      disabled={diffLoading}
                      title="Compare with current"
                    >
                      <GitCompare size={13} />
                    </button>
                    <button
                      className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
                      onClick={() => {
                        setRestoreTarget({ id: v.id, label: v.label });
                        restoreDialog.showConfirm({
                          title: 'Restore Version',
                          message: `Restore "${v.label}"? This will replace the current chapter content.`,
                          confirmLabel: 'Restore',
                          type: 'warning',
                        }, handleRestoreConfirm);
                      }}
                      title="Restore this version"
                    >
                      <RotateCcw size={13} />
                    </button>
                    <button
                      className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
                      onClick={() => {
                        setDeleteTarget({ id: v.id, label: v.label });
                        deleteDialog.showConfirm({
                          title: 'Delete Version',
                          message: `Delete version "${v.label}"? This cannot be undone.`,
                          confirmLabel: 'Delete',
                          type: 'danger',
                        }, handleDeleteConfirm);
                      }}
                      title="Delete this version"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </Flex>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Diff viewer */}
      {activeDiff && (
        <VersionDiff
          changes={activeDiff.changes}
          versionLabel={activeDiff.versionLabel}
          onClose={clearDiff}
        />
      )}

      {/* Save Dialog */}
      <ConfirmDialog
        open={saveDialog.open}
        onClose={() => {
          saveDialog.closeConfirm();
        }}
        onConfirm={handleSaveConfirm}
        {...saveDialog.config}
      />

      {/* Restore Dialog */}
      <ConfirmDialog
        open={restoreDialog.open}
        onClose={() => {
          restoreDialog.closeConfirm();
          setRestoreTarget(null);
        }}
        onConfirm={handleRestoreConfirm}
        {...restoreDialog.config}
      />

      {/* Delete Dialog */}
      <ConfirmDialog
        open={deleteDialog.open}
        onClose={() => {
          deleteDialog.closeConfirm();
          setDeleteTarget(null);
        }}
        onConfirm={handleDeleteConfirm}
        {...deleteDialog.config}
      />
    </Flex>
  );
}
