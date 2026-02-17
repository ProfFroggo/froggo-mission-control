import { useState } from 'react';
import { useWritingStore, WritingProject } from '../../store/writingStore';
import { useWizardStore } from '../../store/wizardStore';
import { Plus, BookOpen, BookText, Trash2, X, Wand2 } from 'lucide-react';

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
    if (window.confirm(`Delete "${project.title}"? This cannot be undone.`)) {
      await deleteProject(project.id);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-clawd-bg">
      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-clawd-text">Writing Projects</h1>
            <p className="text-sm text-clawd-text-dim mt-1">
              {projects.length} {projects.length === 1 ? 'project' : 'projects'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={startWizard}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-clawd-accent text-white text-sm font-medium hover:bg-clawd-accent-dim transition-colors"
            >
              <Wand2 size={16} />
              Plan with AI
            </button>
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-clawd-border text-clawd-text-dim text-sm font-medium hover:border-clawd-accent transition-colors"
            >
              {showForm ? <X size={16} /> : <Plus size={16} />}
              {showForm ? 'Cancel' : 'New Project'}
            </button>
          </div>
        </div>

        {/* Create form */}
        {showForm && (
          <div className="mb-8 p-4 rounded-xl border border-clawd-border bg-clawd-surface">
            <div className="space-y-4">
              <div>
                <label htmlFor="project-title" className="block text-xs font-medium text-clawd-text-dim mb-1.5">
                  Title
                </label>
                <input
                  id="project-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                  placeholder="My Writing Project"
                  className="w-full px-3 py-2 rounded-lg bg-clawd-bg border border-clawd-border text-clawd-text text-sm placeholder:text-clawd-text-dim/50 focus:outline-none focus:border-clawd-accent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-clawd-text-dim mb-1.5">
                  Type
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setType('memoir')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      type === 'memoir'
                        ? 'border-clawd-accent bg-clawd-accent/10 text-clawd-accent'
                        : 'border-clawd-border text-clawd-text-dim hover:border-clawd-text-dim'
                    }`}
                  >
                    <BookOpen size={16} />
                    Memoir
                  </button>
                  <button
                    onClick={() => setType('novel')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      type === 'novel'
                        ? 'border-clawd-accent bg-clawd-accent/10 text-clawd-accent'
                        : 'border-clawd-border text-clawd-text-dim hover:border-clawd-text-dim'
                    }`}
                  >
                    <BookText size={16} />
                    Novel
                  </button>
                </div>
              </div>
              <button
                onClick={handleCreate}
                disabled={!title.trim() || creating}
                className="px-4 py-2 rounded-lg bg-clawd-accent text-white text-sm font-medium hover:bg-clawd-accent-dim transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {creating ? 'Creating...' : 'Create Project'}
              </button>
            </div>
          </div>
        )}

        {/* Loading state */}
        {projectsLoading && projects.length === 0 && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="p-4 rounded-xl border border-clawd-border bg-clawd-surface animate-pulse"
              >
                <div className="h-5 w-48 bg-clawd-border rounded mb-2" />
                <div className="h-3 w-32 bg-clawd-border rounded" />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!projectsLoading && projects.length === 0 && (
          <div className="text-center py-16">
            <BookOpen size={48} className="mx-auto text-clawd-text-dim/30 mb-4" />
            <p className="text-clawd-text-dim text-sm">
              No writing projects yet. Create your first project to start writing.
            </p>
          </div>
        )}

        {/* Project list */}
        {projects.length > 0 && (
          <div className="space-y-3">
            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => openProject(project.id)}
                className="w-full text-left p-4 rounded-xl border border-clawd-border bg-clawd-surface hover:border-clawd-accent/40 hover:shadow-card transition-all group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-clawd-text truncate">
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
                    <div className="flex items-center gap-3 text-xs text-clawd-text-dim">
                      <span>{project.chapterCount} {project.chapterCount === 1 ? 'chapter' : 'chapters'}</span>
                      <span>{project.wordCount.toLocaleString()} words</span>
                      <span>Created {relativeTime(project.createdAt)}</span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDelete(e, project)}
                    className="p-1.5 rounded-lg text-clawd-text-dim/0 group-hover:text-clawd-text-dim hover:!text-error hover:bg-error-subtle transition-all"
                    title="Delete project"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
