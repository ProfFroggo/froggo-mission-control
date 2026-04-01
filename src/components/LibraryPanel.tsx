import { useState, useEffect } from 'react';
import { FolderOpen, FileText, Lightbulb, HardDrive } from 'lucide-react';
import LibraryFilesTab from './LibraryFilesTab';
import LibraryTemplatesTab from './LibraryTemplatesTab';
import LibrarySkillsTab from './LibrarySkillsTab';
import LibraryDriveTab from './LibraryDriveTab';
import PanelHeader from './PanelHeader';
import TabNav, { type TabNavItem } from './TabNav';

type LibraryTab = 'files' | 'drive' | 'templates' | 'skills';

const LIBRARY_TABS: TabNavItem[] = [
  { id: 'files', label: 'Files', icon: FolderOpen },
  { id: 'drive', label: 'Google Drive', icon: HardDrive },
  { id: 'templates', label: 'Templates', icon: FileText },
  { id: 'skills', label: 'Skills', icon: Lightbulb },
];

export default function LibraryPanel() {
  const [activeTab, setActiveTab] = useState<LibraryTab>('files');
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
    <div className="h-full flex flex-col bg-mission-control-bg">
      {/* Header with Tabs */}
      <div className="border-b border-mission-control-border bg-mission-control-surface">
        <PanelHeader
          icon={FolderOpen}
          title="Library"
          subtitle="Skills, templates, files, and resources"
          border={false}
        />
        <TabNav
          tabs={LIBRARY_TABS}
          activeTab={activeTab}
          onTabChange={(id) => setActiveTab(id as LibraryTab)}
          border={false}
        />
      </div>

      {/* Tab Content */}
      <div
        className="flex-1 overflow-hidden"
        role="tabpanel"
        id={`library-tabpanel-${activeTab}`}
        aria-labelledby={`library-tab-${activeTab}`}
      >
        {activeTab === 'files' && <LibraryFilesTab initialPath={navigatePath} />}
        {activeTab === 'drive' && <LibraryDriveTab />}
        {activeTab === 'templates' && <LibraryTemplatesTab />}
        {activeTab === 'skills' && <LibrarySkillsTab />}
      </div>
    </div>
  );
}
