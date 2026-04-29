'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { RefreshCw } from './Toast';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  threshold?: number;
}

// Check if device supports touch
const isTouchDevice = () => {
  if (typeof window === 'undefined') return false;
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
};

export function PullToRefresh({
  onRefresh,
  children,
  threshold = 120,
}: PullToRefreshProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isTouchEnabled, setIsTouchEnabled] = useState(false);
  const startY = useRef<number | null>(null);
  const pullDistanceRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const isRefreshingRef = useRef(false);

  // Only enable touch handlers on touch-capable devices (mobile)
  useEffect(() => {
    setIsTouchEnabled(isTouchDevice());
  }, []);

  // Keep ref in sync with state for touch handler access
  useEffect(() => {
    isRefreshingRef.current = isRefreshing;
  }, [isRefreshing]);

  const updatePullDOM = useCallback((distance: number) => {
    const indicator = indicatorRef.current;
    const content = contentRef.current;
    if (!indicator || !content) return;

    const clampedDistance = Math.min(distance, threshold * 2);
    const indicatorHeight = Math.min(clampedDistance, 80);
    const contentOffset = Math.min(clampedDistance / 2, 60);
    const rotation = Math.min(clampedDistance, 180);
    const isThresholdMet = clampedDistance >= threshold;

    indicator.style.height = `${indicatorHeight}px`;
    indicator.style.opacity = '1';
    content.style.transform = `translateY(${contentOffset}px)`;
    content.style.transition = 'none';

    const icon = indicator.querySelector('[data-ptr-icon]') as HTMLElement | null;
    const text = indicator.querySelector('[data-ptr-text]') as HTMLElement | null;
    if (icon) {
      icon.style.transform = `rotate(${rotation}deg)`;
      icon.style.color = isThresholdMet ? '#22d3ee' : '#9ca3af';
    }
    if (text) {
      text.textContent = isThresholdMet ? 'Release to refresh' : 'Pull to refresh';
    }
  }, [threshold]);

  const resetPullDOM = useCallback((animate: boolean) => {
    const indicator = indicatorRef.current;
    const content = contentRef.current;
    if (!indicator || !content) return;

    indicator.style.height = '0px';
    indicator.style.opacity = '0';
    content.style.transform = 'translateY(0)';
    content.style.transition = animate ? 'transform 0.3s ease-out' : 'none';
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isTouchEnabled) return;
    if (isRefreshingRef.current) return;
    if (window.scrollY > 0) return;
    startY.current = e.touches[0].clientY;
  }, [isTouchEnabled]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isTouchEnabled) return;
    if (startY.current === null || isRefreshingRef.current) return;

    const currentY = e.touches[0].clientY;
    const distance = currentY - startY.current;

    if (distance > 0 && distance < threshold * 2) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        pullDistanceRef.current = distance;
        updatePullDOM(distance);
      });
    }
  }, [isTouchEnabled, threshold, updatePullDOM]);

  const handleTouchEnd = useCallback(async () => {
    if (!isTouchEnabled) return;
    if (startY.current === null) return;

    const distance = pullDistanceRef.current;

    if (distance >= threshold && !isRefreshingRef.current) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    }

    resetPullDOM(true);
    pullDistanceRef.current = 0;
    startY.current = null;
  }, [isTouchEnabled, threshold, onRefresh, resetPullDOM]);

  // Cleanup RAF on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Only add touch handlers on touch devices
  const containerProps = isTouchEnabled ? {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
  } : {};

  return (
    <div
      {...containerProps}
      className="relative"
    >
      {/* Pull indicator — styles driven by DOM refs, not React state */}
      <div
        ref={indicatorRef}
        className="absolute top-0 left-0 right-0 flex items-center justify-center overflow-hidden"
        style={{ height: 0, opacity: 0 }}
      >
        <div className="flex flex-col items-center gap-2 pt-4">
          {isRefreshing ? (
            <RefreshCw className="w-6 h-6 text-cyan-400 animate-spin" />
          ) : (
            <RefreshCw
              data-ptr-icon
              className="w-6 h-6 text-gray-400"
              style={{ transform: 'rotate(0deg)' }}
            />
          )}
          <span data-ptr-text className="text-xs text-gray-400">
            Pull to refresh
          </span>
        </div>
      </div>

      {/* Content — transform driven by DOM ref */}
      <div ref={contentRef}>
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
