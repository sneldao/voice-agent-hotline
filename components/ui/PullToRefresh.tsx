'use client';

import { useState, useRef, useCallback } from 'react';
import { RefreshCw } from './Toast';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  threshold?: number;
}

export function PullToRefresh({
  onRefresh,
  children,
  threshold = 120,
}: PullToRefreshProps) {
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // Only enable pull-to-refresh when at the top
    if (window.scrollY > 0) return;
    startY.current = e.touches[0].clientY;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (startY.current === null || isRefreshing) return;
    
    const currentY = e.touches[0].clientY;
    const distance = currentY - startY.current;
    
    if (distance > 0 && distance < threshold * 2) {
      setIsPulling(true);
      setPullDistance(distance);
    }
  }, [isRefreshing, threshold]);

  const handleTouchEnd = useCallback(async () => {
    if (startY.current === null) return;
    
    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    }
    
    setIsPulling(false);
    setPullDistance(0);
    startY.current = null;
  }, [pullDistance, threshold, isRefreshing, onRefresh]);

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative"
    >
      {/* Pull indicator */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-center overflow-hidden transition-all duration-200"
        style={{
          height: isPulling || isRefreshing ? Math.min(pullDistance, 80) : 0,
          opacity: isPulling || isRefreshing ? 1 : 0,
        }}
      >
        <div className="flex flex-col items-center gap-2 pt-4">
          {isRefreshing ? (
            <RefreshCw className="w-6 h-6 text-cyan-400 animate-spin" />
          ) : (
            <RefreshCw
              className={`w-6 h-6 text-gray-400 transition-transform ${
                pullDistance >= threshold ? 'text-cyan-400' : ''
              }`}
              style={{
                transform: `rotate(${Math.min(pullDistance, 180)}deg)`,
              }}
            />
          )}
          <span className="text-xs text-gray-400">
            {pullDistance >= threshold ? 'Release to refresh' : 'Pull to refresh'}
          </span>
        </div>
      </div>

      {/* Content */}
      <div
        style={{
          transform: isPulling ? `translateY(${Math.min(pullDistance / 2, 60)}px)` : 'translateY(0)',
          transition: isPulling ? 'none' : 'transform 0.3s ease-out',
        }}
      >
        {children}
      </div>
    </div>
  );
}

// Desktop version with button
interface RefreshButtonProps {
  onRefresh: () => Promise<void>;
  variant?: 'icon' | 'full';
}

export function RefreshButton({ onRefresh, variant = 'icon' }: RefreshButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleRefresh = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      await onRefresh();
    } finally {
      setIsLoading(false);
    }
  };

  if (variant === 'icon') {
    return (
      <button
        onClick={handleRefresh}
        disabled={isLoading}
        className="w-10 h-10 rounded-xl bg-gray-800/50 border border-gray-700/50 flex items-center justify-center hover:bg-gray-800 transition-colors disabled:opacity-50"
        aria-label="Refresh"
      >
        <RefreshCw className={`w-5 h-5 text-gray-400 ${isLoading ? 'animate-spin' : ''}`} />
      </button>
    );
  }

  return (
    <button
      onClick={handleRefresh}
      disabled={isLoading}
      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-800/50 border border-gray-700/50 hover:bg-gray-800 transition-colors disabled:opacity-50"
    >
      <RefreshCw className={`w-4 h-4 text-gray-400 ${isLoading ? 'animate-spin' : ''}`} />
      <span className="text-sm text-gray-400">{isLoading ? 'Refreshing...' : 'Refresh'}</span>
    </button>
  );
}
