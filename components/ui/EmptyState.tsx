// Empty State Components - Voice Hotline
import * as React from 'react';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  variant?: 'default' | 'search' | 'history' | 'agents';
}

const iconVariants = {
  default: (
    <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mb-4">
      <span className="text-3xl">📭</span>
    </div>
  ),
  search: (
    <div className="w-16 h-16 rounded-full bg-cyan-500/10 flex items-center justify-center mb-4">
      <svg className="w-8 h-8 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    </div>
  ),
  history: (
    <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mb-4">
      <svg className="w-8 h-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </div>
  ),
  agents: (
    <div className="w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center mb-4">
      <svg className="w-8 h-8 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    </div>
  ),
};

export function EmptyState({
  icon,
  title,
  description,
  action,
  variant = 'default',
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {icon || iconVariants[variant]}
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-gray-400 mb-6 max-w-sm">{description}</p>
      )}
      {action && (
        <Button onClick={action.onClick} variant="secondary">
          {action.label}
        </Button>
      )}
    </div>
  );
}

// Specialized empty states
export function EmptySearchState({ onClear }: { onClear?: () => void }) {
  return (
    <EmptyState
      variant="search"
      title="No results found"
      description="Try adjusting your search or filters to find what you're looking for."
      action={onClear ? { label: 'Clear filters', onClick: onClear } : undefined}
    />
  );
}

export function EmptyHistoryState({ onBrowseAgents }: { onBrowseAgents?: () => void }) {
  return (
    <EmptyState
      variant="history"
      title="No calls yet"
      description="Your call history will appear here after you make your first call."
      action={onBrowseAgents ? { label: 'Browse Agents', onClick: onBrowseAgents } : undefined}
    />
  );
}

export function EmptyAgentsState({ onRefresh }: { onRefresh?: () => void }) {
  return (
    <EmptyState
      variant="agents"
      title="No agents available"
      description="We're still recruiting agents. Check back soon or try refreshing."
      action={onRefresh ? { label: 'Refresh', onClick: onRefresh } : undefined}
    />
  );
}
