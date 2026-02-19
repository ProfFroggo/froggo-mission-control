import { useState, useRef, useEffect, ReactElement } from 'react';
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from 'lucide-react';

interface ThreePaneLayoutProps {
  children: [ReactElement, ReactElement, ReactElement];
  hideRightPane?: boolean;
}

export default function ThreePaneLayout({ children, hideRightPane = false }: ThreePaneLayoutProps) {
  const [leftWidth, setLeftWidth] = useState(30); // % of viewport
  const [centerWidth, setCenterWidth] = useState(40);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<'left' | 'right' | null>(null);
  const [startX, setStartX] = useState(0);
  const [startWidths, setStartWidths] = useState<[number, number]>([30, 40]);

  const handleMouseDown = (divider: 'left' | 'right', e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(divider);
    setStartX(e.clientX);
    setStartWidths([leftWidth, centerWidth]);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragging || !containerRef.current) return;

      const containerWidth = containerRef.current.offsetWidth;
      const deltaX = e.clientX - startX;
      const deltaPercent = (deltaX / containerWidth) * 100;

      if (dragging === 'left') {
        const newLeftWidth = Math.max(15, Math.min(50, startWidths[0] + deltaPercent));
        const newCenterWidth = startWidths[1] - deltaPercent;

        if (newCenterWidth >= 20 && newCenterWidth <= 60) {
          setLeftWidth(newLeftWidth);
          setCenterWidth(newCenterWidth);
        }
      } else if (dragging === 'right') {
        const newCenterWidth = Math.max(20, Math.min(60, startWidths[1] + deltaPercent));
        setCenterWidth(newCenterWidth);
      }
    };

    const handleMouseUp = () => {
      setDragging(null);
    };

    if (dragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, startX, startWidths]);

  // Calculate effective widths based on collapsed state
  const showRight = !hideRightPane && !rightCollapsed;
  const effectiveLeftWidth = leftCollapsed ? 0 : leftWidth;
  const effectiveCenterWidth = leftCollapsed && !showRight
    ? 100
    : leftCollapsed && showRight
    ? (100 - (100 - leftWidth - centerWidth))
    : !showRight
    ? (100 - effectiveLeftWidth)
    : centerWidth;

  return (
    <div ref={containerRef} className="flex h-full relative">
      {/* Left Pane (Agent Chat) */}
      {!leftCollapsed && (
        <>
          <div style={{ width: `${leftWidth}%` }} className="flex-shrink-0 border-r border-clawd-border overflow-hidden relative">
            {children[0]}
            <button
              onClick={() => setLeftCollapsed(true)}
              className="absolute top-2 right-2 p-1 bg-clawd-bg-alt hover:bg-clawd-border rounded-md text-clawd-text-dim hover:text-clawd-text transition-colors z-10"
              title="Collapse agent chat"
            >
              <PanelLeftClose size={14} />
            </button>
          </div>

          {/* Left Divider */}
          <button
            onMouseDown={(e) => handleMouseDown('left', e)}
            onMouseDownCapture={(e) => e.preventDefault()}
            type="button"
            aria-label="Resize left pane"
            className={`w-1 flex-shrink-0 cursor-col-resize hover:bg-info/50 transition-colors border-0 bg-transparent p-0 ${dragging === 'left' ? 'bg-info' : 'bg-transparent'}`}
          />
        </>
      )}

      {/* Left Collapsed Indicator */}
      {leftCollapsed && (
        <div className="flex-shrink-0 border-r border-clawd-border flex items-start pt-2 px-1">
          <button
            onClick={() => setLeftCollapsed(false)}
            className="p-1 bg-clawd-bg-alt hover:bg-clawd-border rounded-md text-clawd-text-dim hover:text-clawd-text transition-colors"
            title="Expand agent chat"
          >
            <PanelLeftOpen size={14} />
          </button>
        </div>
      )}

      {/* Center Pane (Content Editor) */}
      <div style={{ width: `${effectiveCenterWidth}%` }} className="flex-shrink-0 border-r border-clawd-border overflow-hidden flex-1">
        {children[1]}
      </div>

      {/* Right Divider + Right Pane (Approval Queue) */}
      {!hideRightPane && !rightCollapsed && (
        <>
          <button
            onMouseDown={(e) => handleMouseDown('right', e)}
            onMouseDownCapture={(e) => e.preventDefault()}
            type="button"
            aria-label="Resize right pane"
            className={`w-1 flex-shrink-0 cursor-col-resize hover:bg-info/50 transition-colors border-0 bg-transparent p-0 ${dragging === 'right' ? 'bg-info' : 'bg-transparent'}`}
          />
          <div className="flex-1 overflow-hidden relative">
            {children[2]}
            <button
              onClick={() => setRightCollapsed(true)}
              className="absolute top-2 left-2 p-1 bg-clawd-bg-alt hover:bg-clawd-border rounded-md text-clawd-text-dim hover:text-clawd-text transition-colors z-10"
              title="Collapse approval queue"
            >
              <PanelRightClose size={14} />
            </button>
          </div>
        </>
      )}

      {/* Right Collapsed Indicator */}
      {!hideRightPane && rightCollapsed && (
        <div className="flex-shrink-0 border-l border-clawd-border flex items-start pt-2 px-1">
          <button
            onClick={() => setRightCollapsed(false)}
            className="p-1 bg-clawd-bg-alt hover:bg-clawd-border rounded-md text-clawd-text-dim hover:text-clawd-text transition-colors"
            title="Expand approval queue"
          >
            <PanelRightOpen size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
