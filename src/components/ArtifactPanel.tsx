import { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Code,
  Image as ImageIcon,
  FileText,
  Database,
  Network,
  Copy,
  Download,
  Trash2,
  History,
  X,
} from 'lucide-react';
import { useArtifactStore, type Artifact, type ArtifactType } from '../store/artifactStore';
import MarkdownMessage from './MarkdownMessage';

interface ArtifactPanelProps {
  sessionId?: string;
}

const ARTIFACT_ICONS: Record<ArtifactType, React.ComponentType<{ size?: number; className?: string }>> = {
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
  text: 'text-gray-500 bg-gray-500/10 border-gray-500/30',
  diagram: 'text-orange-500 bg-orange-500/10 border-orange-500/30',
  data: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/30',
};

export default function ArtifactPanel({ sessionId }: ArtifactPanelProps) {
  const {
    artifacts,
    selectedArtifactId,
    isCollapsed,
    toggleCollapse,
    selectArtifact,
    deleteArtifact,
    getFilteredArtifacts,
    setFilterBySession,
  } = useArtifactStore();

  const [showVersionHistory, setShowVersionHistory] = useState(false);

  // Filter artifacts by session if provided
  const displayArtifacts = sessionId
    ? artifacts.filter(a => a.sessionId === sessionId)
    : getFilteredArtifacts();

  const selectedArtifact = artifacts.find(a => a.id === selectedArtifactId);

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
    const colorClass = ARTIFACT_COLORS[artifact.type];

    switch (artifact.type) {
      case 'code':
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-clawd-text-dim">
              <Icon size={14} />
              <span className="font-mono">{artifact.metadata?.language || 'code'}</span>
              {artifact.metadata?.filename && (
                <span className="ml-auto text-clawd-text-dim">{artifact.metadata.filename}</span>
              )}
            </div>
            <div className="bg-clawd-bg border border-clawd-border rounded-lg p-4 overflow-x-auto">
              <pre className="text-sm font-mono whitespace-pre-wrap break-words">
                <code>{artifact.content}</code>
              </pre>
            </div>
          </div>
        );

      case 'image':
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-clawd-text-dim">
              <Icon size={14} />
              <span>Image</span>
            </div>
            <div className="bg-clawd-bg border border-clawd-border rounded-lg p-4">
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
            <div className="flex items-center gap-2 text-xs text-clawd-text-dim">
              <Icon size={14} />
              <span>Diagram (Mermaid)</span>
            </div>
            <div className="bg-clawd-bg border border-clawd-border rounded-lg p-4">
              <MarkdownMessage content={`\`\`\`mermaid\n${artifact.content}\n\`\`\``} />
            </div>
          </div>
        );

      case 'data':
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-clawd-text-dim">
              <Icon size={14} />
              <span>Data</span>
            </div>
            <div className="bg-clawd-bg border border-clawd-border rounded-lg p-4 overflow-x-auto">
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
            <div className="flex items-center gap-2 text-xs text-clawd-text-dim">
              <Icon size={14} />
              <span>{artifact.type}</span>
            </div>
            <div className="bg-clawd-bg border border-clawd-border rounded-lg p-4">
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
        className="fixed right-0 top-1/2 -translate-y-1/2 bg-clawd-surface border-l border-y border-clawd-border rounded-l-lg p-2 hover:bg-clawd-bg transition-colors z-10"
        title="Open Artifacts"
      >
        <ChevronLeft size={20} className="text-clawd-text-dim" />
        {displayArtifacts.length > 0 && (
          <span className="absolute -top-1 -left-1 w-5 h-5 bg-clawd-accent text-white text-xs rounded-full flex items-center justify-center">
            {displayArtifacts.length}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="w-96 border-l border-clawd-border bg-clawd-surface flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-clawd-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText size={18} className="text-clawd-accent" />
          <h3 className="font-semibold text-sm">Artifacts</h3>
          {displayArtifacts.length > 0 && (
            <span className="px-2 py-0.5 bg-clawd-bg text-xs rounded-full text-clawd-text-dim">
              {displayArtifacts.length}
            </span>
          )}
        </div>
        <button
          onClick={toggleCollapse}
          className="p-1.5 rounded hover:bg-clawd-border transition-colors"
          title="Collapse panel"
        >
          <ChevronRight size={18} className="text-clawd-text-dim" />
        </button>
      </div>

      {/* Artifact List or Detail View */}
      {selectedArtifact ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Artifact Header */}
          <div className="p-4 border-b border-clawd-border space-y-3">
            <div className="flex items-start justify-between gap-2">
              <button
                onClick={() => selectArtifact(null)}
                className="p-1 rounded hover:bg-clawd-border transition-colors flex-shrink-0"
              >
                <ChevronLeft size={16} className="text-clawd-text-dim" />
              </button>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-sm truncate">{selectedArtifact.title}</h4>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`px-2 py-0.5 rounded text-xs border ${ARTIFACT_COLORS[selectedArtifact.type]}`}>
                    {selectedArtifact.type}
                  </span>
                  <span className="text-xs text-clawd-text-dim">
                    v{selectedArtifact.currentVersion}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleCopy(selectedArtifact.content)}
                className="flex-1 px-3 py-1.5 bg-clawd-bg border border-clawd-border rounded-lg hover:bg-clawd-border transition-colors text-xs flex items-center justify-center gap-1.5"
                title="Copy content"
              >
                <Copy size={14} />
                Copy
              </button>
              <button
                onClick={() => handleDownload(selectedArtifact)}
                className="flex-1 px-3 py-1.5 bg-clawd-bg border border-clawd-border rounded-lg hover:bg-clawd-border transition-colors text-xs flex items-center justify-center gap-1.5"
                title="Download"
              >
                <Download size={14} />
                Download
              </button>
              <button
                onClick={() => setShowVersionHistory(!showVersionHistory)}
                className={`px-3 py-1.5 border rounded-lg transition-colors text-xs flex items-center justify-center gap-1.5 ${
                  showVersionHistory
                    ? 'bg-clawd-accent text-white border-clawd-accent'
                    : 'bg-clawd-bg border-clawd-border hover:bg-clawd-border'
                }`}
                title="Version history"
              >
                <History size={14} />
              </button>
              <button
                onClick={() => {
                  if (confirm('Delete this artifact?')) {
                    deleteArtifact(selectedArtifact.id);
                    selectArtifact(null);
                  }
                }}
                className="px-3 py-1.5 bg-error-subtle border border-error text-error rounded-lg hover:bg-error hover:text-white transition-colors text-xs flex items-center justify-center gap-1.5"
                title="Delete"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          {/* Version History */}
          {showVersionHistory && (
            <div className="p-4 border-b border-clawd-border bg-clawd-bg">
              <h5 className="text-xs font-semibold mb-2">Version History</h5>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {selectedArtifact.versions.map((v) => (
                  <button
                    key={v.version}
                    onClick={() => {
                      // TODO: Implement version revert
                      console.log('Revert to version', v.version);
                    }}
                    className={`w-full text-left px-2 py-1.5 rounded text-xs ${
                      v.version === selectedArtifact.currentVersion
                        ? 'bg-clawd-accent/20 border border-clawd-accent/30'
                        : 'hover:bg-clawd-surface'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">v{v.version}</span>
                      <span className="text-clawd-text-dim">
                        {new Date(v.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    {v.changeDescription && (
                      <p className="text-clawd-text-dim mt-0.5">{v.changeDescription}</p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Artifact Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {renderArtifactContent(selectedArtifact)}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {displayArtifacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-6 text-clawd-text-dim">
              <FileText size={48} className="mb-4 opacity-30" />
              <p className="text-sm font-medium mb-2">No Artifacts Yet</p>
              <p className="text-xs">
                Artifacts like code, diagrams, and images will appear here as agents create them.
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
                    className="w-full text-left p-3 bg-clawd-bg border border-clawd-border rounded-lg hover:border-clawd-accent/50 transition-colors"
                  >
                    <div className="flex items-start gap-2">
                      <div className={`p-2 rounded border ${colorClass} flex-shrink-0`}>
                        <Icon size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h5 className="font-medium text-sm truncate">{artifact.title}</h5>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-clawd-text-dim">
                            v{artifact.currentVersion}
                          </span>
                          <span className="text-xs text-clawd-text-dim">
                            {new Date(artifact.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        {artifact.metadata?.language && (
                          <span className="text-xs text-clawd-text-dim font-mono">
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
