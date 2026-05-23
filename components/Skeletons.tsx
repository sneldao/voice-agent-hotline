'use client';

export function AgentCardSkeleton() {
  return (
    <div className="bg-gray-900/50 border border-gray-800/50 rounded-2xl p-4 skeleton-pulse">
      <div className="flex items-start gap-4">
        {/* Avatar skeleton */}
        <div className="w-12 h-12 rounded-xl bg-gray-800 flex-shrink-0" />
        
        {/* Content skeleton */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Name */}
          <div className="h-5 bg-gray-800 rounded w-3/4" />
          
          {/* Specialty */}
          <div className="h-4 bg-gray-800/50 rounded w-full" />
          <div className="h-4 bg-gray-800/50 rounded w-2/3" />
          
          {/* Stats row */}
          <div className="flex items-center gap-3 pt-2">
            <div className="h-4 bg-gray-800 rounded w-16" />
            <div className="h-4 bg-gray-800 rounded w-12" />
          </div>
        </div>
        
        {/* Rate skeleton */}
        <div className="text-right">
          <div className="h-6 bg-gray-800 rounded w-16 mb-1" />
          <div className="h-3 bg-gray-800/50 rounded w-12" />
        </div>
      </div>
    </div>
  );
}

export function CallHistorySkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-gray-900/50 border border-gray-800/50 rounded-xl p-4 skeleton-pulse">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 flex-1">
              <div className="w-10 h-10 rounded-full bg-gray-800" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-800 rounded w-32" />
                <div className="h-3 bg-gray-800/50 rounded w-24" />
              </div>
            </div>
            <div className="text-right">
              <div className="h-4 bg-gray-800 rounded w-16 mb-2" />
              <div className="h-3 bg-gray-800/50 rounded w-12" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="space-y-4">
      {/* Balance card */}
      <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-2xl p-6 skeleton-pulse">
        <div className="h-4 bg-gray-800 rounded w-32 mb-3" />
        <div className="h-10 bg-gray-800 rounded w-48" />
      </div>
      
      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-gray-900/50 border border-gray-800/50 rounded-xl p-4 skeleton-pulse">
            <div className="h-4 bg-gray-800 rounded w-16 mb-2" />
            <div className="h-8 bg-gray-800 rounded w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

// Fast initial skeleton for tab switching
export function TabLoading() {
  return (
    <div className="flex items-center justify-center min-h-[200px]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-gray-400">Loading...</span>
      </div>
    </div>
  );
}
