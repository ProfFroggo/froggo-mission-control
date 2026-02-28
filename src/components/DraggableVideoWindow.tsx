/**
 * DraggableVideoWindow - Draggable, resizable video preview for screen share
 * 
 * Features:
 * - Drag to reposition
 * - Resize with corner handles
 * - Toggle between compact and full-width modes
 * - Switch source button
 * - Minimize/maximize controls
 */

import { useState, useRef, useEffect } from 'react';
import { X, Minimize2, Maximize2, Monitor, Video, Move } from 'lucide-react';
import { createLogger } from '../utils/logger';

const logger = createLogger('VideoWindow');

interface DraggableVideoWindowProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  videoStream: MediaStream | null;
  videoMode: 'camera' | 'screen';
  onClose: () => void;
  onSwitchSource?: () => void;
}

type ViewMode = 'compact' | 'fullwidth' | 'minimized';

export default function DraggableVideoWindow({
  videoRef,
  videoStream,
  videoMode,
  onClose,
  onSwitchSource,
}: DraggableVideoWindowProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('compact');
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [size, setSize] = useState({ width: 400, height: 225 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, w: 0, h: 0 });

  // Update video srcObject when stream changes
  useEffect(() => {
    if (videoRef.current && videoStream) {
      videoRef.current.srcObject = videoStream;
      videoRef.current.play().catch(e => logger.error('Video play failed:', e));
    }
  }, [videoStream, videoRef]);

  // Handle drag start
  const handleDragStart = (e: React.MouseEvent) => {
    if (viewMode === 'fullwidth') return; // Can't drag in fullwidth mode
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  // Handle resize start
  const handleResizeStart = (e: React.MouseEvent) => {
    if (viewMode === 'fullwidth') return; // Can't resize in fullwidth mode
    e.stopPropagation();
    setIsResizing(true);
    setResizeStart({ x: e.clientX, y: e.clientY, w: size.width, h: size.height });
  };

  // Handle mouse move (drag/resize)
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: Math.max(0, Math.min(window.innerWidth - size.width, e.clientX - dragStart.x)),
          y: Math.max(0, Math.min(window.innerHeight - 50, e.clientY - dragStart.y)),
        });
      } else if (isResizing) {
        const deltaX = e.clientX - resizeStart.x;
        const deltaY = e.clientY - resizeStart.y;
        const newWidth = Math.max(240, Math.min(window.innerWidth - position.x, resizeStart.w + deltaX));
        const newHeight = Math.max(135, Math.min(window.innerHeight - position.y, resizeStart.h + deltaY));
        setSize({ width: newWidth, height: newHeight });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, dragStart, resizeStart, position, size]);

  // Toggle view modes
  const toggleViewMode = () => {
    if (viewMode === 'compact') {
      setViewMode('fullwidth');
    } else if (viewMode === 'fullwidth') {
      setViewMode('compact');
    } else {
      setViewMode('compact');
    }
  };

  const minimize = () => {
    setViewMode('minimized');
  };

  if (viewMode === 'minimized') {
    return (
      <div
        ref={containerRef}
        className="fixed z-50 bg-clawd-surface border-2 border-clawd-border rounded-lg shadow-2xl cursor-pointer"
        style={{
          left: position.x,
          top: position.y,
        }}
        onClick={() => setViewMode('compact')}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setViewMode('compact'); } }}
        role="button"
        tabIndex={0}
        aria-label="Expand video window"
      >
        <div className="flex items-center gap-2 px-3 py-2">
          {videoMode === 'camera' ? <Video size={16} className="text-review" /> : <Monitor size={16} className="text-info" />}
          <span className="text-xs font-medium text-clawd-text">
            {videoMode === 'camera' ? 'Camera' : 'Screen'}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="p-1 rounded hover:bg-clawd-border text-clawd-text-dim hover:text-error transition-colors"
            aria-label="Close video window"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`fixed z-50 bg-black border-2 shadow-2xl ${
        viewMode === 'fullwidth'
          ? 'border-clawd-accent rounded-none'
          : 'border-clawd-border rounded-xl'
      }`}
      style={
        viewMode === 'fullwidth'
          ? { left: 0, top: 0, width: '100vw', height: '100vh' }
          : { left: position.x, top: position.y, width: size.width, height: size.height }
      }
    >
      {/* Header bar */}
      <div
        className={`absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-black/80 to-transparent backdrop-blur-sm flex items-center justify-between px-3 z-10 ${
          viewMode !== 'fullwidth' ? 'cursor-move' : ''
        }`}
        onMouseDown={handleDragStart}
        onKeyDown={(e) => { if (viewMode !== 'fullwidth' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); const rect = containerRef.current?.getBoundingClientRect(); if (rect) { setDragStart({ x: rect.width / 2, y: rect.height / 2 }); setIsDragging(true); } }}}
        role="button"
        tabIndex={viewMode !== 'fullwidth' ? 0 : -1}
        aria-label="Drag video window"
      >
        <div className="flex items-center gap-2">
          <Move size={12} className="text-clawd-text-dim" />
          <span className="text-xs font-medium text-white">
            {videoMode === 'camera' ? '📹 Camera' : '🖥️ Screen'}
          </span>
        </div>
        
        <div className="flex items-center gap-1">
          {videoMode === 'screen' && onSwitchSource && (
            <button
              onClick={onSwitchSource}
              className="px-2 py-1 rounded bg-black/60 text-white text-xs font-medium hover:bg-black/80 transition-colors"
            >
              Switch Source
            </button>
          )}
          <button
            onClick={minimize}
            className="p-1 rounded hover:bg-clawd-text/10 text-clawd-text transition-colors"
            title="Minimize"
          >
            <Minimize2 size={14} />
          </button>
          <button
            onClick={toggleViewMode}
            className="p-1 rounded hover:bg-clawd-text/10 text-clawd-text transition-colors"
            title={viewMode === 'fullwidth' ? 'Exit full width' : 'Full width'}
          >
            <Maximize2 size={14} />
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-error-subtle text-white transition-colors"
            title="Close"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Video */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="w-full h-full object-contain"
        style={videoMode === 'camera' ? { transform: 'scaleX(-1)' } : {}}
      />

      {/* Resize handle (bottom-right corner) */}
      {viewMode === 'compact' && (
        <div
          className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize"
          onMouseDown={handleResizeStart}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const rect = containerRef.current?.getBoundingClientRect(); if (rect) { setResizeStart({ x: rect.width, y: rect.height, w: rect.width, h: rect.height }); setIsResizing(true); } }}}
          role="button"
          tabIndex={0}
          aria-label="Resize video window"
        >
          <div className="absolute bottom-1 right-1 w-3 h-3 border-r-2 border-b-2 border-white/20 dark:border-white/40 rounded-br" />
        </div>
      )}
    </div>
  );
}
