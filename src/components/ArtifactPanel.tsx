import { useState, useRef, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Code,
  Code2,
  Image as ImageIcon,
  FileText,
  Database,
  Network,
  Copy,
  Download,
  Trash2,
  History,
  Monitor,
  Globe,
  RefreshCw,
  Expand,
  WifiOff,
  type LucideIcon,
} from 'lucide-react';
import { useArtifactStore, type Artifact, type ArtifactType } from '../store/artifactStore';
import MarkdownMessage from './MarkdownMessage';

interface ArtifactPanelProps {
  sessionId?: string;
  agentName?: string;
}

const ARTIFACT_ICONS: Record<ArtifactType, LucideIcon> = {
  code: Code,
  image: ImageIcon,
  file: FileText,
  text: FileText,
  diagram: Network,
  data: Database,
};

const ARTIFACT_COLORS: Record<ArtifactType, string> = {
  code: 'text-blue-500 bg-blue-500/10 border-blue-500/30',
  image: 'text-green-500 bg-green-500/10 border-green-500/30',
  file: 'text-purple-500 bg-purple-500/10 border-purple-500/30',
  text: 'text-muted bg-muted-subtle border-muted-border',
  diagram: 'text-orange-500 bg-orange-500/10 border-orange-500/30',
  data: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/30',
};

function isPreviewable(artifact: Artifact): boolean {
  const lang = artifact.metadata?.language?.toLowerCase();
  return lang === 'html' || lang === 'htm' || lang === 'svg';
}

export default function ArtifactPanel({ sessionId, agentName }: ArtifactPanelProps) {
  const {
    artifacts,
    selectedArtifactId,
    isCollapsed,
    toggleCollapse,
    selectArtifact,
    deleteArtifact,
    getFilteredArtifacts,
  } = useArtifactStore();

  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [viewTab, setViewTab] = useState<'preview' | 'code' | 'port'>('code');
  const [portUrl, setPortUrl] = useState<string>('');
  const [loadedPortUrl, setLoadedPortUrl] = useState<string>('');
  const [reloadKey, setReloadKey] = useState(0);
  const [portError, setPortError] = useState(false);

  // Resize state — all stable refs, no useCallback needed
  const MIN_WIDTH = 280;
  const MAX_WIDTH = 800;
  const [width, setWidth] = useState(() => {
    const saved = localStorage.getItem('artifact-panel-width');
    return saved ? Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, parseInt(saved, 10))) : 384;
  });
  const widthRef = useRef(width);
  const dragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);

  // Keep widthRef in sync so mousedown can read current width without being in deps
  useEffect(() => { widthRef.current = width; }, [width]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const delta = dragStartX.current - e.clientX;
      const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, dragStartWidth.current + delta));
      setWidth(next);
      dragStartWidth.current = next;
      dragStartX.current = e.clientX;
    };
    const onMouseUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      localStorage.setItem('artifact-panel-width', String(dragStartWidth.current));
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []); // stable — only refs and stable setWidth used inside

  // Reset viewTab when selected artifact changes
  useEffect(() => {
    const artifact = artifacts.find(a => a.id === selectedArtifactId);
    if (artifact && isPreviewable(artifact)) {
      setViewTab('preview');
    } else {
      setViewTab('code');
    }
    setPortUrl('');
    setLoadedPortUrl('');
  }, [selectedArtifactId, artifacts]);

  // Reset portError when portUrl or loadedPortUrl changes
  useEffect(() => {
    setPortError(false);
  }, [portUrl, loadedPortUrl]);

  // Filter artifacts by session if provided, newest first
  const displayArtifacts = (sessionId
    ? artifacts.filter(a => a.sessionId === sessionId)
    : getFilteredArtifacts()
  ).slice().sort((a, b) => b.timestamp - a.timestamp);

  // Only show a selected artifact if it belongs to the current session's display list
  const selectedArtifact = displayArtifacts.find(a => a.id === selectedArtifactId);

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
  };

  const handleDownload = (artifact: Artifact) => {
    const blob = new Blob([artifact.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${artifact.title}.${getFileExtension(artifact.type, artifact.metadata?.language)}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getFileExtension = (type: ArtifactType, language?: string): string => {
    if (type === 'code' && language) {
      const extensions: Record<string, string> = {
        typescript: 'ts',
        javascript: 'js',
        python: 'py',
        java: 'java',
        cpp: 'cpp',
        c: 'c',
        go: 'go',
        rust: 'rs',
        ruby: 'rb',
        php: 'php',
        swift: 'swift',
        kotlin: 'kt',
      };
      return extensions[language] || 'txt';
    }
    if (type === 'diagram') return 'mmd';
    if (type === 'data') return 'json';
    return 'txt';
  };

  const renderArtifactContent = (artifact: Artifact) => {
    const Icon = ARTIFACT_ICONS[artifact.type];

    switch (artifact.type) {
      case 'code':
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-mission-control-text-dim">
              <Icon size={14} />
              <span className="font-mono">{artifact.metadata?.language || 'code'}</span>
              {artifact.metadata?.filename && (
                <span className="ml-auto text-mission-control-text-dim">{artifact.metadata.filename}</span>
              )}
            </div>
            <div className="bg-mission-control-bg border border-mission-control-border rounded-lg p-4 overflow-x-auto">
              <pre className="text-sm font-mono whitespace-pre-wrap break-words">
                <code>{artifact.content}</code>
              </pre>
            </div>
          </div>
        );

      case 'image':
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-mission-control-text-dim">
              <Icon size={14} />
              <span>Image</span>
            </div>
            <div className="bg-mission-control-bg border border-mission-control-border rounded-lg p-4">
              <img
                src={artifact.content}
                alt={artifact.title}
                className="max-w-full h-auto rounded"
              />
            </div>
          </div>
        );

      case 'diagram':
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-mission-control-text-dim">
              <Icon size={14} />
              <span>Diagram (Mermaid)</span>
            </div>
            <div className="bg-mission-control-bg border border-mission-control-border rounded-lg p-4">
              <MarkdownMessage content={`\`\`\`mermaid\n${artifact.content}\n\`\`\``} />
            </div>
          </div>
        );

      case 'data':
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-mission-control-text-dim">
              <Icon size={14} />
              <span>Data</span>
            </div>
            <div className="bg-mission-control-bg border border-mission-control-border rounded-lg p-4 overflow-x-auto">
              <pre className="text-sm font-mono whitespace-pre-wrap break-words">
                <code>{artifact.content}</code>
              </pre>
            </div>
          </div>
        );

      case 'text':
      case 'file':
      default:
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-mission-control-text-dim">
              <Icon size={14} />
              <span>{artifact.type}</span>
            </div>
            <div className="bg-mission-control-bg border border-mission-control-border rounded-lg p-4">
              <MarkdownMessage content={artifact.content} />
            </div>
          </div>
        );
    }
  };

  if (isCollapsed) {
    return (
      <button
        onClick={toggleCollapse}
        className="fixed right-0 top-1/2 -translate-y-1/2 bg-mission-control-surface border-l border-y border-mission-control-border rounded-l-lg p-2 hover:bg-mission-control-bg transition-colors z-10"
        title="Open Artifacts"
      >
        <ChevronLeft size={20} className="text-mission-control-text-dim" />
        {displayArtifacts.length > 0 && (
          <span className="absolute -top-1 -left-1 w-5 h-5 bg-mission-control-accent text-white text-xs rounded-full flex items-center justify-center">
            {displayArtifacts.length}
          </span>
        )}
      </button>
    );
  }

  return (
    <div
      className="relative border-l border-mission-control-border bg-mission-control-surface flex flex-col h-full flex-shrink-0"
      style={{ width }}
    >
      {/* Resize handle */}
      <div
        onMouseDown={(e) => {
          e.preventDefault();
          dragging.current = true;
          dragStartX.current = e.clientX;
          dragStartWidth.current = widthRef.current;
          document.body.style.cursor = 'col-resize';
          document.body.style.userSelect = 'none';
        }}
        className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-mission-control-accent/40 transition-colors z-10 group"
        title="Drag to resize"
      >
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-full bg-mission-control-border group-hover:bg-mission-control-accent/60 transition-colors" />
      </div>
      {/* Header */}
      <div className="p-4 border-b border-mission-control-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText size={18} className="text-mission-control-accent" />
          <h3 className="font-semibold text-sm">Artifacts</h3>
          {displayArtifacts.length > 0 && (
            <span className="px-2 py-0.5 bg-mission-control-bg text-xs rounded-full text-mission-control-text-dim">
              {displayArtifacts.length}
            </span>
          )}
        </div>
        <button
          onClick={toggleCollapse}
          className="p-1.5 rounded hover:bg-mission-control-border transition-colors"
          title="Collapse panel"
        >
          <ChevronRight size={18} className="text-mission-control-text-dim" />
        </button>
      </div>

      {/* Artifact List or Detail View */}
      {selectedArtifact ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Artifact Header — single compact row */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-mission-control-border">
            <button
              onClick={() => selectArtifact(null)}
              className="p-1 rounded hover:bg-mission-control-border transition-colors flex-shrink-0"
            >
              <ChevronLeft size={15} className="text-mission-control-text-dim" />
            </button>
            <span className="font-medium text-sm truncate flex-1 min-w-0">{selectedArtifact.title}</span>
            <span className={`px-1.5 py-0.5 rounded text-xs border flex-shrink-0 ${ARTIFACT_COLORS[selectedArtifact.type]}`}>
              {selectedArtifact.type}
            </span>
            <span className="text-xs text-mission-control-text-dim flex-shrink-0">v{selectedArtifact.currentVersion}</span>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button onClick={() => handleCopy(selectedArtifact.content)} className="p-1.5 rounded hover:bg-mission-control-border transition-colors text-mission-control-text-dim hover:text-mission-control-text" title="Copy"><Copy size={13} /></button>
              <button onClick={() => handleDownload(selectedArtifact)} className="p-1.5 rounded hover:bg-mission-control-border transition-colors text-mission-control-text-dim hover:text-mission-control-text" title="Download"><Download size={13} /></button>
              <button
                onClick={() => setShowVersionHistory(!showVersionHistory)}
                className={`p-1.5 rounded transition-colors ${showVersionHistory ? 'text-mission-control-accent' : 'text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border'}`}
                title="Version history"
              ><History size={13} /></button>
              <button
                onClick={() => { if (confirm('Delete this artifact?')) { deleteArtifact(selectedArtifact.id); selectArtifact(null); } }}
                className="p-1.5 rounded text-mission-control-text-dim hover:text-error hover:bg-error-subtle transition-colors"
                title="Delete"
              ><Trash2 size={13} /></button>
            </div>
          </div>

          {/* Version History */}
          {showVersionHistory && (
            <div className="p-4 border-b border-mission-control-border bg-mission-control-bg">
              <h5 className="text-xs font-semibold mb-2">Version History</h5>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {selectedArtifact.versions.map((v) => (
                  <div
                    key={v.version}
                    className={`w-full text-left px-2 py-1.5 rounded text-xs ${
                      v.version === selectedArtifact.currentVersion
                        ? 'bg-mission-control-accent/20 border border-mission-control-accent/30'
                        : 'bg-mission-control-bg'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">v{v.version}</span>
                      <span className="text-mission-control-text-dim">
                        {new Date(v.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    {v.changeDescription && (
                      <p className="text-mission-control-text-dim mt-0.5">{v.changeDescription}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab Bar — only for previewable artifacts */}
          {isPreviewable(selectedArtifact) && (
            <div className="flex items-center border-b border-mission-control-border bg-mission-control-surface px-4">
              <div className="flex flex-1">
                {(['preview', 'code', 'port'] as const).map(tab => {
                  const TabIcon = tab === 'preview' ? Monitor : tab === 'code' ? Code2 : Globe;
                  const label = tab === 'preview' ? 'Preview' : tab === 'code' ? 'Code' : 'Port';
                  return (
                    <button
                      key={tab}
                      onClick={() => setViewTab(tab)}
                      className={`flex items-center px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                        viewTab === tab
                          ? 'border-mission-control-accent text-mission-control-accent'
                          : 'border-transparent text-mission-control-text-dim hover:text-mission-control-text'
                      }`}
                    >
                      <TabIcon size={14} className="mr-1.5" />
                      {label}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-1 ml-2">
                <button
                  onClick={() => setReloadKey(k => k + 1)}
                  className="p-1.5 rounded hover:bg-mission-control-border transition-colors text-mission-control-text-dim hover:text-mission-control-text"
                  title="Reload preview"
                >
                  <RefreshCw size={14} />
                </button>
                {viewTab === 'preview' && (
                  <button
                    onClick={() => {
                      const win = window.open('', '_blank');
                      if (win) { win.document.write(selectedArtifact.content); win.document.close(); }
                    }}
                    className="p-1.5 rounded hover:bg-mission-control-border transition-colors text-mission-control-text-dim hover:text-mission-control-text"
                    title="Open in new window"
                  >
                    <Expand size={14} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Artifact Content */}
          {isPreviewable(selectedArtifact) && viewTab === 'preview' ? (
            <div className="flex-1 overflow-hidden" style={{ minHeight: '400px' }}>
              <iframe
                key={`preview-${selectedArtifact.id}-${reloadKey}`}
                srcDoc={selectedArtifact.content}
                sandbox="allow-scripts allow-forms allow-popups"
                className="w-full h-full border-0 rounded-b-lg bg-white"
                title={selectedArtifact.title}
                style={{ minHeight: '400px' }}
              />
            </div>
          ) : isPreviewable(selectedArtifact) && viewTab === 'port' ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="p-4 border-b border-mission-control-border space-y-2">
                <label className="block text-xs font-medium text-mission-control-text">
                  Local Dev Server URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={portUrl}
                    onChange={e => setPortUrl(e.target.value)}
                    placeholder="http://localhost:3000"
                    className="flex-1 px-3 py-1.5 bg-mission-control-bg border border-mission-control-border rounded-lg text-sm text-mission-control-text placeholder-mission-control-text-dim focus:outline-none focus:border-mission-control-accent"
                    onKeyDown={e => { if (e.key === 'Enter') setLoadedPortUrl(portUrl); }}
                  />
                  <button
                    onClick={() => setLoadedPortUrl(portUrl)}
                    className="px-3 py-1.5 bg-mission-control-accent text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                  >
                    Load
                  </button>
                </div>
                <p className="text-xs text-mission-control-text-dim">
                  Only works if a local dev server is running on that port
                </p>
              </div>
              {loadedPortUrl && (
                <div className="flex-1 relative overflow-hidden" style={{ minHeight: '400px' }}>
                  <iframe
                    src={loadedPortUrl}
                    className="w-full h-full border-0 rounded-b-lg"
                    title="Local preview"
                    style={{ minHeight: '400px' }}
                    onError={() => setPortError(true)}
                    onLoad={() => setPortError(false)}
                  />
                  {portError && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-mission-control-bg text-mission-control-text-dim gap-3">
                      <WifiOff size={32} className="opacity-50" />
                      <p className="text-sm font-medium text-mission-control-text">Could not connect to localhost</p>
                      <p className="text-xs text-mission-control-text-dim">Make sure the dev server is running on that port</p>
                      <button
                        onClick={() => { setPortUrl(''); setLoadedPortUrl(''); setPortError(false); }}
                        className="mt-1 px-3 py-1.5 bg-mission-control-bg border border-mission-control-border rounded-lg text-xs hover:bg-mission-control-border transition-colors"
                      >
                        Try again
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-4">
              {renderArtifactContent(selectedArtifact)}
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {displayArtifacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-6 text-mission-control-text-dim">
              <FileText size={48} className="mb-4 opacity-30" />
              <p className="text-sm font-medium mb-2">No artifacts yet</p>
              <p className="text-xs">
                {agentName
                  ? `Ask ${agentName} to generate code, images, or files — they'll appear here.`
                  : 'Artifacts like code, diagrams, and images will appear here as agents create them.'}
              </p>
            </div>
          ) : (
            <div className="p-4 space-y-2">
              {displayArtifacts.map((artifact) => {
                const Icon = ARTIFACT_ICONS[artifact.type];
                const colorClass = ARTIFACT_COLORS[artifact.type];
                return (
                  <button
                    key={artifact.id}
                    onClick={() => selectArtifact(artifact.id)}
                    className="w-full text-left p-3 bg-mission-control-bg border border-mission-control-border rounded-lg hover:border-mission-control-accent/50 transition-colors"
                  >
                    <div className="flex items-start gap-2">
                      <div className={`p-2 rounded border ${colorClass} flex-shrink-0`}>
                        <Icon size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h5 className="font-medium text-sm truncate">{artifact.title}</h5>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-mission-control-text-dim">
                            v{artifact.currentVersion}
                          </span>
                          <span className="text-xs text-mission-control-text-dim">
                            {new Date(artifact.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        {artifact.metadata?.language && (
                          <span className="text-xs text-mission-control-text-dim font-mono">
                            {artifact.metadata.language}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
