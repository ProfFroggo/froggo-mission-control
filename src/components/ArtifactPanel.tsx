import { useState, useEffect } from 'react';
import { ChevronRight, ChevronLeft, FileText, Image as ImageIcon, Code, File, Trash2 } from 'lucide-react';
import MarkdownMessage from './MarkdownMessage';

interface Artifact {
  id: string;
  type: 'code' | 'image' | 'file' | 'text';
  title: string;
  content: string;
  messageId: string;
  timestamp: number;
  metadata?: {
    language?: string;
    filename?: string;
    size?: number;
  };
}

interface ArtifactPanelProps {
  artifacts: Artifact[];
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onClearArtifacts?: () => void;
}

export default function ArtifactPanel({ 
  artifacts, 
  isCollapsed, 
  onToggleCollapse,
  onClearArtifacts 
}: ArtifactPanelProps) {
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);

  // Auto-select first artifact when artifacts change
  useEffect(() => {
    if (artifacts.length > 0 && !selectedArtifact) {
      setSelectedArtifact(artifacts[0]);
    } else if (artifacts.length === 0) {
      setSelectedArtifact(null);
    }
  }, [artifacts, selectedArtifact]);

  const getArtifactIcon = (type: Artifact['type']) => {
    switch (type) {
      case 'code':
        return <Code size={16} />;
      case 'image':
        return <ImageIcon size={16} />;
      case 'file':
        return <File size={16} />;
      case 'text':
        return <FileText size={16} />;
      default:
        return <FileText size={16} />;
    }
  };

  if (isCollapsed) {
    return (
      <div className="w-12 border-l border-clawd-border bg-clawd-bg flex flex-col items-center py-4">
        <button
          onClick={onToggleCollapse}
          className="p-2 rounded-lg hover:bg-clawd-surface transition-colors text-clawd-text-dim hover:text-clawd-text"
          title="Expand artifact panel"
          aria-label="Expand artifact panel"
        >
          <ChevronLeft size={20} />
        </button>
        {artifacts.length > 0 && (
          <div className="mt-4 w-6 h-6 rounded-full bg-clawd-accent text-white text-xs flex items-center justify-center">
            {artifacts.length}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-96 border-l border-clawd-border bg-clawd-bg flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-clawd-border">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-clawd-text">Artifacts</h3>
          {artifacts.length > 0 && (
            <span className="px-2 py-0.5 bg-clawd-accent/10 text-clawd-accent text-xs font-medium rounded-full">
              {artifacts.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {artifacts.length > 0 && onClearArtifacts && (
            <button
              onClick={onClearArtifacts}
              className="p-1.5 rounded-lg hover:bg-clawd-surface transition-colors text-clawd-text-dim hover:text-error"
              title="Clear all artifacts"
              aria-label="Clear all artifacts"
            >
              <Trash2 size={16} />
            </button>
          )}
          <button
            onClick={onToggleCollapse}
            className="p-1.5 rounded-lg hover:bg-clawd-surface transition-colors text-clawd-text-dim hover:text-clawd-text"
            title="Collapse artifact panel"
            aria-label="Collapse artifact panel"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* Artifact List */}
      {artifacts.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-clawd-surface border border-clawd-border flex items-center justify-center mb-4">
            <FileText size={28} className="text-clawd-text-dim" />
          </div>
          <h4 className="text-sm font-medium text-clawd-text mb-1">No artifacts yet</h4>
          <p className="text-xs text-clawd-text-dim max-w-xs">
            Code blocks, images, and files from your chat will appear here
          </p>
        </div>
      ) : (
        <>
          {/* Artifact tabs/list */}
          <div className="border-b border-clawd-border bg-clawd-surface/50">
            <div className="flex overflow-x-auto">
              {artifacts.map((artifact) => (
                <button
                  key={artifact.id}
                  onClick={() => setSelectedArtifact(artifact)}
                  className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-colors whitespace-nowrap ${
                    selectedArtifact?.id === artifact.id
                      ? 'border-clawd-accent text-clawd-accent'
                      : 'border-transparent text-clawd-text-dim hover:text-clawd-text hover:bg-clawd-bg/50'
                  }`}
                >
                  {getArtifactIcon(artifact.type)}
                  <span className="text-sm font-medium truncate max-w-[120px]">
                    {artifact.title}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Artifact content */}
          {selectedArtifact && (
            <div className="flex-1 overflow-y-auto p-4">
              <div className="mb-3">
                <h4 className="text-sm font-semibold text-clawd-text mb-1">
                  {selectedArtifact.title}
                </h4>
                <div className="flex items-center gap-2 text-xs text-clawd-text-dim">
                  <span>
                    {new Date(selectedArtifact.timestamp).toLocaleString()}
                  </span>
                  {selectedArtifact.metadata?.language && (
                    <>
                      <span>•</span>
                      <span className="font-mono">{selectedArtifact.metadata.language}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Render based on type */}
              {selectedArtifact.type === 'code' && (
                <div className="bg-clawd-surface border border-clawd-border rounded-lg overflow-hidden">
                  <div className="bg-clawd-bg px-3 py-2 border-b border-clawd-border flex items-center justify-between">
                    <span className="text-xs font-mono text-clawd-text-dim">
                      {selectedArtifact.metadata?.language || 'code'}
                    </span>
                  </div>
                  <pre className="p-4 overflow-x-auto text-sm">
                    <code className="font-mono">{selectedArtifact.content}</code>
                  </pre>
                </div>
              )}

              {selectedArtifact.type === 'image' && (
                <div className="bg-clawd-surface border border-clawd-border rounded-lg overflow-hidden">
                  <img
                    src={selectedArtifact.content}
                    alt={selectedArtifact.title}
                    className="w-full h-auto"
                  />
                </div>
              )}

              {selectedArtifact.type === 'text' && (
                <div className="bg-clawd-surface border border-clawd-border rounded-lg p-4">
                  <MarkdownMessage content={selectedArtifact.content} />
                </div>
              )}

              {selectedArtifact.type === 'file' && (
                <div className="bg-clawd-surface border border-clawd-border rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-lg bg-clawd-bg border border-clawd-border flex items-center justify-center">
                      <File size={24} className="text-clawd-text-dim" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-clawd-text">
                        {selectedArtifact.metadata?.filename || selectedArtifact.title}
                      </div>
                      {selectedArtifact.metadata?.size && (
                        <div className="text-xs text-clawd-text-dim">
                          {(selectedArtifact.metadata.size / 1024).toFixed(2)} KB
                        </div>
                      )}
                    </div>
                  </div>
                  <pre className="text-xs font-mono bg-clawd-bg p-3 rounded border border-clawd-border overflow-x-auto">
                    {selectedArtifact.content}
                  </pre>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
