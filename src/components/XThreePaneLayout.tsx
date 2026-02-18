import { useState, useRef, useEffect, ReactElement } from 'react';

interface ThreePaneLayoutProps {
  children: [ReactElement, ReactElement, ReactElement];
  hideRightPane?: boolean;
}

export default function ThreePaneLayout({ children, hideRightPane = false }: ThreePaneLayoutProps) {
  const [leftWidth, setLeftWidth] = useState(30); // % of viewport
  const [centerWidth, setCenterWidth] = useState(40);
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

  const effectiveCenterWidth = hideRightPane ? (100 - leftWidth) : centerWidth;

  return (
    <div ref={containerRef} className="flex h-full">
      {/* Left Pane (Agent Chat) */}
      <div style={{ width: `${leftWidth}%` }} className="flex-shrink-0 border-r border-clawd-border overflow-hidden">
        {children[0]}
      </div>

      {/* Left Divider */}
      <button
        onMouseDown={(e) => handleMouseDown('left', e)}
        onMouseDownCapture={(e) => e.preventDefault()}
        type="button"
        aria-label="Resize left pane"
        className={`w-1 flex-shrink-0 cursor-col-resize hover:bg-info/50 transition-colors border-0 bg-transparent p-0 ${dragging === 'left' ? 'bg-info' : 'bg-transparent'}`}
      />

      {/* Center Pane (Content Editor) */}
      <div style={{ width: `${effectiveCenterWidth}%` }} className="flex-shrink-0 border-r border-clawd-border overflow-hidden">
        {children[1]}
      </div>

      {/* Right Divider + Right Pane (Approval Queue) — hidden when hideRightPane */}
      {!hideRightPane && (
        <>
          <button
            onMouseDown={(e) => handleMouseDown('right', e)}
            onMouseDownCapture={(e) => e.preventDefault()}
            type="button"
            aria-label="Resize right pane"
            className={`w-1 flex-shrink-0 cursor-col-resize hover:bg-info/50 transition-colors border-0 bg-transparent p-0 ${dragging === 'right' ? 'bg-info' : 'bg-transparent'}`}
          />
          <div className="flex-1 overflow-hidden">
            {children[2]}
          </div>
        </>
      )}
    </div>
  );
}
