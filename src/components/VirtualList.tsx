/**
 * VirtualList - High-performance virtual scrolling component
 * 
 * Renders only visible items + buffer for optimal performance with large lists.
 * Supports variable item heights and maintains 60fps scrolling.
 * 
 * Usage:
 *   <VirtualList
 *     items={tasks}
 *     itemHeight={80}
 *     renderItem={(task, index) => <TaskCard task={task} />}
 *     overscan={5}
 *   />
 */

import { useState, useEffect, useRef, useCallback, memo, CSSProperties } from 'react';

interface VirtualListProps<T> {
  items: T[];
  itemHeight: number | ((item: T, index: number) => number);
  renderItem: (item: T, index: number) => React.ReactNode;
  className?: string;
  overscan?: number; // Number of items to render outside visible area
  onScroll?: (scrollTop: number) => void;
  emptyMessage?: React.ReactNode;
  loadingMessage?: React.ReactNode;
  isLoading?: boolean;
}

function VirtualListInner<T>({
  items,
  itemHeight,
  renderItem,
  className = '',
  overscan = 3,
  onScroll,
  emptyMessage = 'No items',
  loadingMessage = 'Loading...',
  isLoading = false,
}: VirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  // Memoize item heights
  const getItemHeight = useCallback(
    (index: number): number => {
      if (typeof itemHeight === 'number') return itemHeight;
      return itemHeight(items[index], index);
    },
    [itemHeight, items]
  );

  // Calculate total height
  const totalHeight = items.reduce((acc, item, index) => {
    return acc + getItemHeight(index);
  }, 0);

  // Calculate visible range with overscan
  const getVisibleRange = useCallback(() => {
    if (!containerHeight || items.length === 0) {
      return { start: 0, end: 0 };
    }

    let start = 0;
    let end = items.length - 1;
    let accumulatedHeight = 0;

    // Find start index
    for (let i = 0; i < items.length; i++) {
      const height = getItemHeight(i);
      if (accumulatedHeight + height > scrollTop) {
        start = Math.max(0, i - overscan);
        break;
      }
      accumulatedHeight += height;
    }

    // Find end index
    accumulatedHeight = 0;
    for (let i = 0; i < items.length; i++) {
      const height = getItemHeight(i);
      accumulatedHeight += height;
      if (accumulatedHeight > scrollTop + containerHeight) {
        end = Math.min(items.length - 1, i + overscan);
        break;
      }
    }

    return { start, end };
  }, [items, containerHeight, scrollTop, overscan, getItemHeight]);

  // Calculate offset for start item
  const getOffsetForIndex = useCallback(
    (index: number): number => {
      let offset = 0;
      for (let i = 0; i < index; i++) {
        offset += getItemHeight(i);
      }
      return offset;
    },
    [getItemHeight]
  );

  // Handle scroll
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const newScrollTop = containerRef.current.scrollTop;
    setScrollTop(newScrollTop);
    onScroll?.(newScrollTop);
  }, [onScroll]);

  // Measure container height
  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        setContainerHeight(containerRef.current.clientHeight);
      }
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  // Get visible items
  const { start, end } = getVisibleRange();
  const visibleItems = items.slice(start, end + 1);
  const offsetY = getOffsetForIndex(start);

  // Loading state
  if (isLoading) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-clawd-text-dim">{loadingMessage}</div>
      </div>
    );
  }

  // Empty state
  if (items.length === 0) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-clawd-text-dim">{emptyMessage}</div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`overflow-auto ${className}`}
      onScroll={handleScroll}
      style={{ height: '100%', position: 'relative' }}
    >
      {/* Spacer for total height */}
      <div style={{ height: totalHeight, position: 'relative' }}>
        {/* Visible items */}
        <div
          style={{
            position: 'absolute',
            top: offsetY,
            left: 0,
            right: 0,
          }}
        >
          {visibleItems.map((item, index) => {
            const actualIndex = start + index;
            const height = getItemHeight(actualIndex);
            return (
              <div key={actualIndex} style={{ height }}>
                {renderItem(item, actualIndex)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Memoize to prevent unnecessary re-renders
const VirtualList = memo(VirtualListInner) as typeof VirtualListInner;

export default VirtualList;

/**
 * VirtualGrid - Virtual scrolling for grid layouts
 * 
 * Similar to VirtualList but for 2D grid layouts
 */
interface VirtualGridProps<T> {
  items: T[];
  itemWidth: number;
  itemHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  className?: string;
  gap?: number;
  overscan?: number;
}

export function VirtualGrid<T>({
  items,
  itemWidth,
  itemHeight,
  renderItem,
  className = '',
  gap = 16,
  overscan = 2,
}: VirtualGridProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  // Calculate columns
  const columns = Math.max(1, Math.floor((containerWidth + gap) / (itemWidth + gap)));
  const rows = Math.ceil(items.length / columns);
  const totalHeight = rows * (itemHeight + gap) - gap;

  // Calculate visible range
  const startRow = Math.max(0, Math.floor(scrollTop / (itemHeight + gap)) - overscan);
  const endRow = Math.min(
    rows - 1,
    Math.ceil((scrollTop + containerHeight) / (itemHeight + gap)) + overscan
  );

  const visibleItems: Array<{ item: T; index: number; row: number; col: number }> = [];
  for (let row = startRow; row <= endRow; row++) {
    for (let col = 0; col < columns; col++) {
      const index = row * columns + col;
      if (index < items.length) {
        visibleItems.push({ item: items[index], index, row, col });
      }
    }
  }

  // Handle scroll
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    setScrollTop(containerRef.current.scrollTop);
  }, []);

  // Measure container
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
        setContainerHeight(containerRef.current.clientHeight);
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  if (items.length === 0) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-clawd-text-dim">No items</div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`overflow-auto ${className}`}
      onScroll={handleScroll}
      style={{ height: '100%', position: 'relative' }}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {visibleItems.map(({ item, index, row, col }) => (
          <div
            key={index}
            style={{
              position: 'absolute',
              top: row * (itemHeight + gap),
              left: col * (itemWidth + gap),
              width: itemWidth,
              height: itemHeight,
            }}
          >
            {renderItem(item, index)}
          </div>
        ))}
      </div>
    </div>
  );
}
