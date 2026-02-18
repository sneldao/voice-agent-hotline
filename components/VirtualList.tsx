'use client';

import { useEffect, useRef, useState } from 'react';
import { ReactNode } from 'react';

interface VirtualListProps {
  items: any[];
  renderItem: (item: any, index: number) => ReactNode;
  itemHeight?: number;
  overscan?: number;
}

export function VirtualList({ items, renderItem, itemHeight = 120, overscan = 5 }: VirtualListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: Math.ceil(window.innerHeight / itemHeight) + overscan });

  const totalHeight = items.length * itemHeight;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
      const endIndex = Math.min(
        items.length,
        Math.ceil((scrollTop + container.clientHeight) / itemHeight) + overscan
      );
      setVisibleRange({ start: startIndex, end: endIndex });
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [items.length, itemHeight, overscan]);

  const visibleItems = items.slice(visibleRange.start, visibleRange.end);
  const offsetY = visibleRange.start * itemHeight;

  return (
    <div ref={containerRef} className="overflow-y-auto" style={{ height: '100%', maxHeight: '60vh' }}>
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ position: 'absolute', top: offsetY, width: '100%' }}>
          {visibleItems.map((item, index) => renderItem(item, visibleRange.start + index))}
        </div>
      </div>
    </div>
  );
}
