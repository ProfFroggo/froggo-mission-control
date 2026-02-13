import { useRef, useState, useCallback } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import type { PanelImperativeHandle, Layout, PanelSize } from 'react-resizable-panels';
import { BookOpen, History, PanelLeftClose, PanelLeftOpen, MessageSquare } from 'lucide-react';
import ChapterSidebar from './ChapterSidebar';
import ChapterEditor from './ChapterEditor';
import ContextPanel from './ContextPanel';
import VersionPanel from './VersionPanel';
import { useWritingStore } from '../../store/writingStore';

const LAYOUT_KEY = 'writing-layout';
const DEFAULT_LAYOUT: Layout = { chapters: 15, chat: 30, editor: 55 };

function getPersistedLayout(): Layout | undefined {
  try {
    const saved = localStorage.getItem(LAYOUT_KEY);
    if (!saved) return undefined;
    const parsed = JSON.parse(saved);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Layout;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export default function ProjectEditor() {
  const { activeChapterId } = useWritingStore();
  const [contextOpen, setContextOpen] = useState(false);
  const [versionOpen, setVersionOpen] = useState(false);
  const [isChaptersCollapsed, setIsChaptersCollapsed] = useState(false);
  const [isChatCollapsed, setIsChatCollapsed] = useState(false);

  const chaptersPanelRef = useRef<PanelImperativeHandle | null>(null);
  const chatPanelRef = useRef<PanelImperativeHandle | null>(null);

  const defaultLayout = getPersistedLayout() || DEFAULT_LAYOUT;

  const handleLayoutChanged = useCallback((layout: Layout) => {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
  }, []);

  const toggleContext = () => {
    setContextOpen((v) => !v);
    if (!contextOpen) setVersionOpen(false);
  };

  const toggleVersion = () => {
    setVersionOpen((v) => !v);
    if (!versionOpen) setContextOpen(false);
  };

  const toggleChaptersPanel = () => {
    const panel = chaptersPanelRef.current;
    if (!panel) return;
    if (panel.isCollapsed()) {
      panel.expand();
    } else {
      panel.collapse();
    }
  };

  const toggleChatPanel = () => {
    const panel = chatPanelRef.current;
    if (!panel) return;
    if (panel.isCollapsed()) {
      panel.expand();
    } else {
      panel.collapse();
    }
  };

  // Track collapse state via onResize (asPercentage 0 = collapsed)
  const handleChaptersResize = useCallback((size: PanelSize) => {
    setIsChaptersCollapsed(size.asPercentage === 0);
  }, []);

  const handleChatResize = useCallback((size: PanelSize) => {
    setIsChatCollapsed(size.asPercentage === 0);
  }, []);

  return (
    <Group
      orientation="horizontal"
      defaultLayout={defaultLayout}
      onLayoutChanged={handleLayoutChanged}
    >
      {/* Left panel: Chapter sidebar */}
      <Panel
        id="chapters"
        minSize={10}
        maxSize={25}
        collapsible
        collapsedSize={0}
        panelRef={chaptersPanelRef}
        onResize={handleChaptersResize}
        className="h-full"
      >
        <div className="h-full overflow-hidden [&>div]:!w-full">
          <ChapterSidebar />
        </div>
      </Panel>

      <Separator className="w-1 bg-clawd-border hover:bg-clawd-accent transition-colors cursor-col-resize data-[resize-handle-active]:bg-clawd-accent" />

      {/* Center panel: Chat placeholder (Plan 03 replaces with ChatPane) */}
      <Panel
        id="chat"
        minSize={15}
        maxSize={50}
        collapsible
        collapsedSize={0}
        panelRef={chatPanelRef}
        onResize={handleChatResize}
        className="h-full"
      >
        <div className="flex flex-col h-full bg-clawd-surface border-r border-clawd-border">
          <div className="px-3 py-2 border-b border-clawd-border flex items-center gap-2 flex-shrink-0">
            <MessageSquare size={14} className="text-clawd-text-dim" />
            <span className="text-xs font-medium text-clawd-text-dim">Chat</span>
          </div>
          <div className="flex-1 flex items-center justify-center text-clawd-text-dim text-sm">
            Chat pane (coming soon)
          </div>
        </div>
      </Panel>

      <Separator className="w-1 bg-clawd-border hover:bg-clawd-accent transition-colors cursor-col-resize data-[resize-handle-active]:bg-clawd-accent" />

      {/* Right panel: Editor workspace */}
      <Panel
        id="editor"
        minSize={25}
        className="h-full"
      >
        <div className="relative h-full">
          {/* Collapse toggle buttons */}
          <div className="absolute top-2 left-2 z-10 flex items-center gap-1">
            <button
              onClick={toggleChaptersPanel}
              className="p-1.5 rounded transition-colors bg-clawd-surface text-clawd-text-dim hover:bg-clawd-border hover:text-clawd-text"
              title={isChaptersCollapsed ? 'Show chapters sidebar' : 'Hide chapters sidebar'}
            >
              {isChaptersCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            </button>
            <button
              onClick={toggleChatPanel}
              className={`p-1.5 rounded transition-colors ${
                isChatCollapsed
                  ? 'bg-clawd-surface text-clawd-text-dim hover:bg-clawd-border hover:text-clawd-text'
                  : 'bg-clawd-accent/20 text-clawd-accent hover:bg-clawd-accent/30'
              }`}
              title={isChatCollapsed ? 'Show chat pane' : 'Hide chat pane'}
            >
              <MessageSquare size={16} />
            </button>
          </div>

          {/* Panel toggle buttons (context/version) */}
          <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
            {activeChapterId && (
              <button
                onClick={toggleVersion}
                className={`p-1.5 rounded transition-colors ${
                  versionOpen
                    ? 'bg-clawd-accent/20 text-clawd-accent'
                    : 'bg-clawd-surface text-clawd-text-dim hover:bg-clawd-border hover:text-clawd-text'
                }`}
                title={versionOpen ? 'Hide version history' : 'Show version history'}
              >
                <History size={16} />
              </button>
            )}
            <button
              onClick={toggleContext}
              className={`p-1.5 rounded transition-colors ${
                contextOpen
                  ? 'bg-clawd-accent/20 text-clawd-accent'
                  : 'bg-clawd-surface text-clawd-text-dim hover:bg-clawd-border hover:text-clawd-text'
              }`}
              title={contextOpen ? 'Hide context panel' : 'Show context panel'}
            >
              <BookOpen size={16} />
            </button>
          </div>

          {/* Editor content */}
          <div className="h-full">
            {activeChapterId ? (
              <ChapterEditor />
            ) : (
              <div className="flex items-center justify-center h-full text-clawd-text-dim">
                <div className="text-center space-y-1">
                  <p className="text-sm">Select a chapter to start writing</p>
                  <p className="text-xs">or create a new chapter from the sidebar</p>
                </div>
              </div>
            )}
          </div>

          {/* Context panel overlay */}
          {contextOpen && (
            <div className="absolute top-0 right-0 h-full z-20">
              <ContextPanel />
            </div>
          )}

          {/* Version panel overlay */}
          {versionOpen && (
            <div className="absolute top-0 right-0 h-full z-20">
              <VersionPanel onClose={() => setVersionOpen(false)} />
            </div>
          )}
        </div>
      </Panel>
    </Group>
  );
}
