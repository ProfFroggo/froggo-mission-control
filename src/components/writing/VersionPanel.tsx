import { useEffect } from 'react';
import { X, Save, GitCompare, RotateCcw, Trash2, Loader2 } from 'lucide-react';
import { useWritingStore } from '../../store/writingStore';
import { useVersionStore } from '../../store/versionStore';
import VersionDiff from './VersionDiff';

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

  useEffect(() => {
    if (activeProjectId && activeChapterId) {
      loadVersions(activeProjectId, activeChapterId);
    }
    return () => {
      reset();
    };
  }, [activeProjectId, activeChapterId]);

  const handleSave = async () => {
    if (!activeProjectId || !activeChapterId) return;
    const label = window.prompt('Version label (optional):', '');
    if (label === null) return; // User cancelled

    // Flush current content to disk before snapshotting
    if (activeChapterContent !== null) {
      await saveChapter(activeChapterContent);
    }

    await saveVersion(activeProjectId, activeChapterId, label || undefined);
  };

  const handleRestore = async (versionId: string, versionLabel: string) => {
    if (!activeProjectId || !activeChapterId) return;
    const confirmed = window.confirm(`Restore "${versionLabel}"? This will replace the current chapter content.`);
    if (!confirmed) return;

    const success = await restoreVersion(activeProjectId, activeChapterId, versionId);
    if (success) {
      // Reload chapter content in the editor
      await openChapter(activeChapterId);
    }
  };

  const handleDelete = async (versionId: string, versionLabel: string) => {
    if (!activeProjectId || !activeChapterId) return;
    const confirmed = window.confirm(`Delete version "${versionLabel}"? This cannot be undone.`);
    if (!confirmed) return;

    await deleteVersion(activeProjectId, activeChapterId, versionId);
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
    <div className="w-80 h-full flex flex-col bg-clawd-surface border-l border-clawd-border flex-shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-clawd-border">
        <h3 className="text-xs font-semibold text-clawd-text uppercase tracking-wide">Versions</h3>
        <button
          onClick={onClose}
          className="p-1 text-clawd-text-dim hover:text-clawd-text rounded transition-colors"
          title="Close versions panel"
        >
          <X size={14} />
        </button>
      </div>

      {/* Save button */}
      <div className="px-3 py-2 border-b border-clawd-border">
        <button
          onClick={handleSave}
          disabled={!activeChapterId}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-clawd-accent/20 text-clawd-accent hover:bg-clawd-accent/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title="Saves the current chapter content as a version snapshot"
        >
          <Save size={13} />
          Save Snapshot
        </button>
      </div>

      {/* Version list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-clawd-text-dim">
            <Loader2 size={16} className="animate-spin" />
          </div>
        ) : versions.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-clawd-text-dim">
            <p>No versions saved yet.</p>
            <p className="mt-1">Save a snapshot before making major edits.</p>
          </div>
        ) : (
          <div className="divide-y divide-clawd-border/50">
            {versions.map((v) => (
              <div key={v.id} className="px-3 py-2 group hover:bg-clawd-border/30 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-clawd-text truncate">{v.label}</div>
                    <div className="text-[10px] text-clawd-text-dim mt-0.5">
                      {formatTime(v.createdAt)} &middot; {v.wordCount.toLocaleString()} words
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button
                      onClick={() => handleCompare(v.id)}
                      disabled={diffLoading}
                      className="p-1 text-clawd-text-dim hover:text-clawd-accent rounded transition-colors"
                      title="Compare with current"
                    >
                      <GitCompare size={13} />
                    </button>
                    <button
                      onClick={() => handleRestore(v.id, v.label)}
                      className="p-1 text-clawd-text-dim hover:text-warning rounded transition-colors"
                      title="Restore this version"
                    >
                      <RotateCcw size={13} />
                    </button>
                    <button
                      onClick={() => handleDelete(v.id, v.label)}
                      className="p-1 text-clawd-text-dim hover:text-error rounded transition-colors"
                      title="Delete this version"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
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
    </div>
  );
}
