import { useRef, useState, useCallback, useEffect } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import type { PanelImperativeHandle, Layout, PanelSize } from 'react-resizable-panels';
import { BookOpen, History, PanelLeftClose, PanelLeftOpen, MessageSquare } from 'lucide-react';
import ChapterSidebar from './ChapterSidebar';
import ChapterEditor from './ChapterEditor';
import ChatPane from './ChatPane';
import ContextPanel from './ContextPanel';
import VersionPanel from './VersionPanel';
import { useWritingStore } from '../../store/writingStore';

const LAYOUT_KEY = 'writing-layout-v2';
const COLLAPSE_KEY = 'writing-collapsed';
const DEFAULT_LAYOUT: Layout = { chapters: 15, chat: 30, editor: 55 };

// Clean up old key on load
try { localStorage.removeItem('writing-layout'); } catch { /* ignore */ }

function getPersistedLayout(): Layout | undefined {
  try {
    const saved = localStorage.getItem(LAYOUT_KEY);
    if (!saved) return undefined;
    const parsed = JSON.parse(saved);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)
      || typeof parsed.chapters !== 'number' || typeof parsed.chat !== 'number' || typeof parsed.editor !== 'number'
      || parsed.chapters < 10 || parsed.chat < 20 || parsed.editor < 25) {
      localStorage.removeItem(LAYOUT_KEY);
      return undefined;
    }
    return parsed as Layout;
  } catch {
    localStorage.removeItem(LAYOUT_KEY);
    return undefined;
  }
}

function getPersistedCollapse(): { chapters: boolean; chat: boolean } {
  try {
    const saved = localStorage.getItem(COLLAPSE_KEY);
    if (!saved) return { chapters: false, chat: false };
    return JSON.parse(saved);
  } catch {
    return { chapters: false, chat: false };
  }
}

function persistCollapse(chapters: boolean, chat: boolean) {
  localStorage.setItem(COLLAPSE_KEY, JSON.stringify({ chapters, chat }));
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
    // Only persist if panes have reasonable sizes (not mid-collapse)
    if (layout.chapters >= 10 && layout.chat >= 20 && layout.editor >= 25) {
      localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
    }
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

  // Restore collapse state on mount
  useEffect(() => {
    const saved = getPersistedCollapse();
    // Small delay to ensure panel refs are ready
    const timer = setTimeout(() => {
      if (saved.chapters && chaptersPanelRef.current && !chaptersPanelRef.current.isCollapsed()) {
        chaptersPanelRef.current.collapse();
      }
      if (saved.chat && chatPanelRef.current && !chatPanelRef.current.isCollapsed()) {
        chatPanelRef.current.collapse();
      }
    }, 50);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- refs are stable, only runs on mount

  // Track collapse state via onResize (asPercentage 0 = collapsed)
  const handleChaptersResize = useCallback((size: PanelSize) => {
    const collapsed = size.asPercentage === 0;
    setIsChaptersCollapsed(collapsed);
    persistCollapse(collapsed, isChatCollapsed);
  }, [isChatCollapsed]);

  const handleChatResize = useCallback((size: PanelSize) => {
    const collapsed = size.asPercentage === 0;
    setIsChatCollapsed(collapsed);
    persistCollapse(isChaptersCollapsed, collapsed);
  }, [isChaptersCollapsed]);

  return (
    <Group
      orientation="horizontal"
      defaultLayout={defaultLayout}
      onLayoutChanged={handleLayoutChanged}
    >
      {/* Left panel: Chapter sidebar */}
      <Panel
        id="chapters"
        minSize="180px"
        maxSize="30%"
        collapsible
        collapsedSize={0}
        panelRef={chaptersPanelRef}
        onResize={handleChaptersResize}
        className="h-full"
        style={{ minHeight: 0, height: '100%' }}
      >
        <div className="h-full overflow-hidden [&>div]:!w-full">
          <ChapterSidebar />
        </div>
      </Panel>

      <Separator className="w-2 bg-clawd-border hover:bg-clawd-accent data-[separator=active]:bg-clawd-accent transition-colors cursor-col-resize group flex items-center justify-center">
        <div className="flex items-center gap-px">
          <div className="w-px h-5 rounded-full bg-clawd-text-dim/30 group-hover:bg-clawd-text/50 group-data-[separator=active]:bg-clawd-text/70 transition-colors" />
          <div className="w-px h-5 rounded-full bg-clawd-text-dim/30 group-hover:bg-clawd-text/50 group-data-[separator=active]:bg-clawd-text/70 transition-colors" />
        </div>
      </Separator>

      {/* Center panel: AI Chat */}
      <Panel
        id="chat"
        minSize="280px"
        maxSize="50%"
        collapsible
        collapsedSize={0}
        panelRef={chatPanelRef}
        onResize={handleChatResize}
        className="h-full"
        style={{ minHeight: 0, height: '100%' }}
      >
        <ChatPane />
      </Panel>

      <Separator className="w-2 bg-clawd-border hover:bg-clawd-accent data-[separator=active]:bg-clawd-accent transition-colors cursor-col-resize group flex items-center justify-center">
        <div className="flex items-center gap-px">
          <div className="w-px h-5 rounded-full bg-clawd-text-dim/30 group-hover:bg-clawd-text/50 group-data-[separator=active]:bg-clawd-text/70 transition-colors" />
          <div className="w-px h-5 rounded-full bg-clawd-text-dim/30 group-hover:bg-clawd-text/50 group-data-[separator=active]:bg-clawd-text/70 transition-colors" />
        </div>
      </Separator>

      {/* Right panel: Editor workspace */}
      <Panel
        id="editor"
        minSize="300px"
        className="h-full"
        style={{ minHeight: 0, height: '100%' }}
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
