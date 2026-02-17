import { useState, useRef, useEffect, ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  content: string | ReactNode;
  children: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  maxWidth?: number;
  disabled?: boolean;
  showArrow?: boolean;
}

/**
 * Tooltip component for inline contextual help
 * Usage: <Tooltip content="Help text">Hover me</Tooltip>
 */
export default function Tooltip({
  content,
  children,
  position = 'top',
  delay = 500,
  maxWidth = 250,
  disabled = false,
  showArrow = true
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const timeoutRef = useRef<NodeJS.Timeout>();
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const updatePosition = () => {
    if (!triggerRef.current || !tooltipRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const gap = 8; // Space between trigger and tooltip
    const arrowSize = showArrow ? 6 : 0;

    let top = 0;
    let left = 0;

    switch (position) {
      case 'top':
        top = triggerRect.top - tooltipRect.height - gap - arrowSize;
        left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
        break;
      case 'bottom':
        top = triggerRect.bottom + gap + arrowSize;
        left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
        break;
      case 'left':
        top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
        left = triggerRect.left - tooltipRect.width - gap - arrowSize;
        break;
      case 'right':
        top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
        left = triggerRect.right + gap + arrowSize;
        break;
    }

    // Keep tooltip within viewport bounds
    const padding = 8;
    if (left < padding) left = padding;
    if (left + tooltipRect.width > window.innerWidth - padding) {
      left = window.innerWidth - tooltipRect.width - padding;
    }
    if (top < padding) top = padding;
    if (top + tooltipRect.height > window.innerHeight - padding) {
      top = window.innerHeight - tooltipRect.height - padding;
    }

    setCoords({ top, left });
  };

  const handleMouseEnter = () => {
    if (disabled) return;
    
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
      // Update position after render
      setTimeout(updatePosition, 0);
    }, delay);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  /* eslint-disable react-hooks/exhaustive-deps */
  // updatePosition uses stable refs, re-running on position changes is unnecessary overhead
  useEffect(() => {
    if (isVisible) {
      updatePosition();
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [isVisible]);
  /* eslint-enable react-hooks/exhaustive-deps */

  const arrowStyles = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: 'absolute',
      width: 0,
      height: 0,
      borderStyle: 'solid',
    };

    // Get computed tooltip background color (theme-aware)
    const tooltipBg = 'var(--clawd-surface)';

    switch (position) {
      case 'top':
        return {
          ...base,
          bottom: -6,
          left: '50%',
          transform: 'translateX(-50%)',
          borderWidth: '6px 6px 0 6px',
          borderColor: `${tooltipBg} transparent transparent transparent`,
        };
      case 'bottom':
        return {
          ...base,
          top: -6,
          left: '50%',
          transform: 'translateX(-50%)',
          borderWidth: '0 6px 6px 6px',
          borderColor: `transparent transparent ${tooltipBg} transparent`,
        };
      case 'left':
        return {
          ...base,
          right: -6,
          top: '50%',
          transform: 'translateY(-50%)',
          borderWidth: '6px 0 6px 6px',
          borderColor: `transparent transparent transparent ${tooltipBg}`,
        };
      case 'right':
        return {
          ...base,
          left: -6,
          top: '50%',
          transform: 'translateY(-50%)',
          borderWidth: '6px 6px 6px 0',
          borderColor: `transparent ${tooltipBg} transparent transparent`,
        };
    }
  };

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{ display: 'inline-block' }}
        role="presentation"
      >
        {children}
      </div>

      {isVisible && !disabled && createPortal(
        <div
          ref={tooltipRef}
          className="tooltip-portal"
          style={{
            position: 'fixed',
            top: coords.top,
            left: coords.left,
            zIndex: 9999,
            pointerEvents: 'none',
          }}
        >
          <div
            className="tooltip-content"
            style={{
              maxWidth: `${maxWidth}px`,
              padding: '8px 12px',
              backgroundColor: 'var(--clawd-surface)',
              color: 'var(--clawd-text)',
              border: '1px solid var(--clawd-border)',
              borderRadius: '8px',
              fontSize: '13px',
              lineHeight: '1.4',
              boxShadow: 'var(--shadow-lg)',
              position: 'relative',
            }}
          >
            {content}
            {showArrow && <div style={arrowStyles()} />}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

/**
 * Help tooltip with icon - shows help icon that reveals tooltip on hover
 */
export function HelpTooltip({ content, position = 'top' }: { content: string | ReactNode; position?: 'top' | 'bottom' | 'left' | 'right' }) {
  return (
    <Tooltip content={content} position={position}>
      <button className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-clawd-border hover:bg-clawd-accent/20 text-clawd-text-dim hover:text-clawd-accent transition-colors">
        <span className="text-xs">?</span>
      </button>
    </Tooltip>
  );
}
