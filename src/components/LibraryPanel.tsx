import { useState, useEffect } from 'react';
import { FolderOpen, FileText, BookOpen, Lightbulb } from 'lucide-react';
import LibraryFilesTab from './LibraryFilesTab';
import LibraryTemplatesTab from './LibraryTemplatesTab';
import LibrarySkillsTab from './LibrarySkillsTab';

type LibraryTab = 'files' | 'templates' | 'skills' | 'resources';

const tabs: Array<{ id: LibraryTab; label: string; icon: any }> = [
  { id: 'skills', label: 'Skills', icon: Lightbulb },
  { id: 'templates', label: 'Templates', icon: FileText },
  { id: 'files', label: 'Files', icon: FolderOpen },
  { id: 'resources', label: 'Resources', icon: BookOpen },
];

export default function LibraryPanel() {
  const [activeTab, setActiveTab] = useState<LibraryTab>('templates');
  const [navigatePath, setNavigatePath] = useState<string | null>(null);

  // Check for navigation path from HRSection or other sources
  useEffect(() => {
    const path = sessionStorage.getItem('library-navigate-path');
    if (path) {
      setActiveTab('files');
      setNavigatePath(path);
      sessionStorage.removeItem('library-navigate-path');
    }
  }, []);

  return (
    <div className="h-full flex flex-col bg-clawd-bg">
      {/* Header with Tabs */}
      <div className="border-b border-clawd-border bg-clawd-surface">
        <div className="p-6 pb-0">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-clawd-accent/20 rounded-xl">
              <FolderOpen size={24} className="text-clawd-accent" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Library</h1>
              <p className="text-sm text-clawd-text-dim">
                Skills, templates, files, and resources
              </p>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 px-6">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                activeTab === id
                  ? 'border-clawd-accent text-clawd-accent'
                  : 'border-transparent text-clawd-text-dim hover:text-clawd-text'
              }`}
            >
              <Icon size={16} />
              <span className="font-medium">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'files' && <LibraryFilesTab initialPath={navigatePath} />}
        {activeTab === 'templates' && <LibraryTemplatesTab />}
        {activeTab === 'skills' && <LibrarySkillsTab />}
        {activeTab === 'resources' && (
          <div className="h-full flex items-center justify-center p-8">
            <div className="text-center">
              <BookOpen size={48} className="text-clawd-text-dim mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Resources Coming Soon</h3>
              <p className="text-clawd-text-dim max-w-md">
                This section will contain documentation, guides, and reference materials.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
