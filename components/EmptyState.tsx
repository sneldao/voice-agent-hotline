'use client';

import { Phone, Search, Inbox } from 'lucide-react';
import { Button } from './ui/Button';

interface EmptyStateProps {
  type?: 'calls' | 'search' | 'agents' | 'notifications';
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyHistoryState({ onBrowseAgents }: { onBrowseAgents?: () => void }) {
  return (
    <EmptyState
      type="calls"
      title="No calls yet"
      description="Your call history will appear here after you make your first call."
      actionLabel={onBrowseAgents ? 'Browse Agents' : undefined}
      onAction={onBrowseAgents}
    />
  );
}

export function EmptyState({ 
  type = 'calls', 
  title, 
  description, 
  actionLabel, 
  onAction 
}: EmptyStateProps) {
  const config = {
    calls: {
      icon: Phone,
      title: 'No calls yet',
      description: 'Start your first voice call with an AI agent',
      action: 'Browse Agents',
    },
    search: {
      icon: Search,
      title: 'No agents found',
      description: 'Try adjusting your search or filters',
      action: 'Clear Filters',
    },
    agents: {
      icon: Inbox,
      title: 'No agents available',
      description: 'Check back later for new agents',
      action: undefined,
    },
    notifications: {
      icon: Inbox,
      title: 'No notifications',
      description: "You're all caught up!",
      action: undefined,
    },
  };

  const { icon: Icon, title: defaultTitle, description: defaultDesc, action: defaultAction } = config[type];

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gray-800/50 border border-gray-700/50 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-gray-500" />
      </div>
      
      <h3 className="text-lg font-semibold text-white mb-2">
        {title || defaultTitle}
      </h3>
      
      <p className="text-sm text-gray-400 mb-6 max-w-xs">
        {description || defaultDesc}
      </p>
      
      {(actionLabel || defaultAction) && onAction && (
        <Button
          onClick={onAction}
          className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white font-medium"
        >
          {actionLabel || defaultAction}
        </Button>
      )}
    </div>
  );
}
