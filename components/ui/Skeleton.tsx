'use client';

import * as React from 'react';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  animation?: 'pulse' | 'wave' | 'none';
}

export function Skeleton({
  className = '',
  variant = 'text',
  width,
  height,
  animation = 'pulse',
  ...props
}: SkeletonProps) {
  const variants = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
  };

  const animations = {
    pulse: 'animate-pulse',
    wave: 'animate-pulse',
    none: '',
  };

  return (
    <div
      className={`
        bg-gray-700/50
        ${variants[variant]}
        ${animations[animation]}
        ${className}
      `}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
      }}
      {...props}
    />
  );
}

/**
 * Skeleton Card for agent lists
 */
export function AgentCardSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 bg-gray-900/30 rounded-xl border border-gray-800 animate-pulse">
      <Skeleton variant="circular" width={48} height={48} />
      <div className="flex-1 space-y-2">
        <Skeleton width="40%" height={16} />
        <Skeleton width="70%" height={12} />
        <Skeleton width="50%" height={12} />
      </div>
      <div className="space-y-2 text-right">
        <Skeleton width={50} height={20} />
        <Skeleton width={40} height={12} />
      </div>
    </div>
  );
}

/**
 * Featured Agent Skeleton
 */
export function FeaturedCardSkeleton() {
  return (
    <div className="flex-shrink-0 w-36 rounded-2xl p-4 bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700">
      <Skeleton variant="circular" width={48} height={48} className="mb-3" />
      <Skeleton width="80%" height={14} className="mb-1" />
      <Skeleton width="60%" height={12} className="mb-2" />
      <Skeleton width="70%" height={12} />
    </div>
  );
}

/**
 * Call View Skeleton
 */
export function CallViewSkeleton() {
  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-gray-900 to-gray-950">
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <Skeleton variant="circular" width={160} height={160} className="mb-8" />
        <Skeleton width="50%" height={24} className="mb-2" />
        <Skeleton width="30%" height={16} className="mb-8" />
        <Skeleton width="25%" height={20} className="mb-2" />
        <Skeleton width="35%" height={14} />
      </div>
      <div className="bg-gray-950/50 p-6">
        <div className="flex items-center justify-center gap-4">
          <Skeleton variant="circular" width={56} height={56} />
          <Skeleton variant="circular" width={64} height={64} className="rounded-full bg-red-500/20" />
          <Skeleton variant="circular" width={56} height={56} />
        </div>
      </div>
    </div>
  );
}

/**
 * Agent Detail Skeleton
 */
export function AgentDetailSkeleton() {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-gray-900 rounded-3xl border border-gray-800 w-full max-w-md overflow-hidden">
        <div className="p-6 rounded-t-3xl bg-gradient-to-br from-gray-800 to-gray-900 text-center">
          <Skeleton variant="circular" width={96} height={96} className="mx-auto mb-4" />
          <Skeleton width="50%" height={24} className="mx-auto mb-2" />
          <Skeleton width="30%" height={16} className="mx-auto" />
        </div>
        <div className="p-4 space-y-4">
          <Skeleton width="100%" height={60} />
          <div className="flex gap-2">
            <Skeleton width={60} height={24} />
            <Skeleton width={60} height={24} />
            <Skeleton width={60} height={24} />
          </div>
          <Skeleton width="100%" height={48} />
        </div>
      </div>
    </div>
  );
}

/**
 * Call History Skeleton
 */
export function CallHistorySkeleton() {
  return (
    <div className="p-4 space-y-4">
      <Skeleton width="30%" height={24} />
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex items-center gap-4 p-4 bg-gray-900/30 rounded-xl">
            <Skeleton variant="circular" width={40} height={40} />
            <div className="flex-1 space-y-2">
              <Skeleton width="40%" height={16} />
              <Skeleton width="60%" height={12} />
            </div>
            <div className="space-y-2 text-right">
              <Skeleton width={50} height={16} />
              <Skeleton width={30} height={12} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
