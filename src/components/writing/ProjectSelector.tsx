import { useState } from 'react';
import { Button, IconButton, TextField } from '@radix-ui/themes';
import { useWritingStore, WritingProject } from '../../store/writingStore';
import { useWizardStore } from '../../store/wizardStore';
import { Plus, BookOpen, BookText, Trash2, X, Wand2 } from 'lucide-react';
import ConfirmDialog, { useConfirmDialog } from '../ConfirmDialog';

function relativeTime(ts: number): string {
  const now = Date.now();
  const diff = now - ts;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 30) return `${Math.floor(days / 30)}mo ago`;
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

export default function ProjectSelector() {
  const {
    projects,
    projectsLoading,
    createProject,
    deleteProject,
    openProject,
  } = useWritingStore();

  const { startWizard } = useWizardStore();

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'memoir' | 'novel'>('memoir');
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<WritingProject | null>(null);
  const deleteDialog = useConfirmDialog();

  const handleCreate = async () => {
    if (!title.trim() || creating) return;
    setCreating(true);
    const id = await createProject(title.trim(), type);
    if (id) {
      setTitle('');
      setType('memoir');
      setShowForm(false);
    }
    setCreating(false);
  };

  const handleDelete = async (e: React.MouseEvent, project: WritingProject) => {
    e.stopPropagation();
    setDeleteTarget(project);
    deleteDialog.showConfirm({
      title: 'Delete Project',
      message: `Delete "${project.title}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      type: 'danger',
    }, async () => {
      // Use `project` directly to avoid stale closure on deleteTarget state
      await deleteProject(project.id);
      setDeleteTarget(null);
    });
  };

  return (
    <div className="h-full overflow-y-auto bg-mission-control-bg">
      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-mission-control-text">Writing Projects</h1>
            <p className="text-sm text-mission-control-text-dim mt-1">
              {projects.length} {projects.length === 1 ? 'project' : 'projects'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={startWizard}
              size="2"
              variant="solid"
            >
              <Wand2 size={16} />
              Plan with AI
            </Button>
            <Button
              onClick={() => setShowForm(!showForm)}
              size="2"
              variant="outline"
              color="gray"
            >
              {showForm ? <X size={16} /> : <Plus size={16} />}
              {showForm ? 'Cancel' : 'New Project'}
            </Button>
          </div>
        </div>

        {/* Create form */}
        {showForm && (
          <div className="mb-8 p-4 rounded-lg border border-mission-control-border bg-mission-control-surface">
            <div className="space-y-4">
              <div>
                <label htmlFor="project-title" className="block text-xs font-medium text-mission-control-text-dim mb-1.5">
                  Title
                </label>
                <TextField.Root
                  id="project-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                  placeholder="My Writing Project"
                  size="2"
                />
              </div>
              <div>
                <span className="block text-xs font-medium text-mission-control-text-dim mb-1.5">
                  Type
                </span>
                <div className="flex gap-2">
                  <Button
                    onClick={() => setType('memoir')}
                    size="2"
                    variant={type === 'memoir' ? 'soft' : 'outline'}
                    color="gray"
                   
                  >
                    <BookOpen size={16} />
                    Memoir
                  </Button>
                  <Button
                    onClick={() => setType('novel')}
                    size="2"
                    variant={type === 'novel' ? 'soft' : 'outline'}
                    color="gray"
                   
                  >
                    <BookText size={16} />
                    Novel
                  </Button>
                </div>
              </div>
              <Button
                onClick={handleCreate}
                disabled={!title.trim() || creating}
                size="2"
                variant="solid"
              >
                {creating ? 'Creating...' : 'Create Project'}
              </Button>
            </div>
          </div>
        )}

        {/* Loading state */}
        {projectsLoading && projects.length === 0 && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="p-4 rounded-lg border border-mission-control-border bg-mission-control-surface animate-pulse"
              >
                <div className="h-5 w-48 bg-mission-control-border rounded mb-2" />
                <div className="h-3 w-32 bg-mission-control-border rounded" />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!projectsLoading && projects.length === 0 && (
          <div className="text-center py-16">
            <BookOpen size={48} className="mx-auto text-mission-control-text-dim/30 mb-4" />
            <p className="text-mission-control-text-dim text-sm">
              No writing projects yet. Create your first project to start writing.
            </p>
          </div>
        )}

        {/* Project list */}
        {projects.length > 0 && (
          <div className="space-y-3">
            {projects.map((project) => (
              <Button
                key={project.id}
                onClick={() => openProject(project.id)}
                variant="ghost"
                size="2"
               
                className="w-full text-left p-4 h-auto flex items-start group"
              >
                <div className="flex items-start justify-between w-full">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-mission-control-text truncate">
                        {project.title}
                      </h3>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider ${
                        project.type === 'memoir'
                          ? 'bg-info-subtle text-info'
                          : 'bg-review-subtle text-review'
                      }`}>
                        {project.type === 'memoir' ? <BookOpen size={10} /> : <BookText size={10} />}
                        {project.type}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-mission-control-text-dim">
                      <span>{project.chapterCount} {project.chapterCount === 1 ? 'chapter' : 'chapters'}</span>
                      <span>{project.wordCount.toLocaleString()} words</span>
                      <span>Created {relativeTime(project.createdAt)}</span>
                    </div>
                  </div>
                  <IconButton
                    onClick={(e) => handleDelete(e, project)}
                    size="1"
                    variant="ghost"
                    color="red"
                   
                    title="Delete project"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={14} />
                  </IconButton>
                </div>
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Delete Dialog */}
      <ConfirmDialog
        open={deleteDialog.open}
        onClose={() => {
          deleteDialog.closeConfirm();
          setDeleteTarget(null);
        }}
        onConfirm={() => {
          if (deleteTarget) {
            deleteProject(deleteTarget.id);
            setDeleteTarget(null);
          }
        }}
        {...deleteDialog.config}
      />
    </div>
  );
}
