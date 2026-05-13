'use client';

import React from 'react';
import { Star, Phone, ShieldCheck } from 'lucide-react';
import { Card, Badge, Avatar } from '@/components/ui';
import type { Agent } from '@/lib/types';

const STAR_COLORS = [
  'text-yellow-400 fill-yellow-400',
  'text-yellow-400 fill-yellow-400/50',
  'text-gray-600',
];

function getStarClass(index: number, fullStars: number, hasHalfStar: boolean): string {
  if (index < fullStars) return STAR_COLORS[0];
  if (index === fullStars && hasHalfStar) return STAR_COLORS[1];
  return STAR_COLORS[2];
}

const Stars = React.memo(function Stars({ rating }: { rating: number }) {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  return (
    <div className="flex items-center gap-0.5">
      {[0, 1, 2, 3, 4].map(i => (
        <Star key={i} className={`w-4 h-4 ${getStarClass(i, fullStars, hasHalfStar)}`} />
      ))}
    </div>
  );
});

export const AgentCard = React.memo(function AgentCard({
  agent,
  onClick,
}: {
  agent: Agent;
  onClick: () => void;
}) {
  const rating = Number(agent.rating) || 0;

  return (
    <Card
      interactive
      variant="default"
      className="group relative h-full overflow-hidden p-4 transition-all duration-200 hover:border-cyan-500/30 hover:bg-gray-900/80"
      onClick={onClick}
    >
      <div className="flex items-start gap-4 relative">
        <div className="relative flex-shrink-0">
          <Avatar size="lg" online={agent.online}>{agent.avatar}</Avatar>
          {agent.online && <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-gray-900 rounded-full" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="mb-1 flex items-center gap-2">
            <span className="min-w-0 truncate font-bold text-white">{agent.name}</span>
            {agent.verified && (
              <span className="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-300" title="Verified agent">
                <ShieldCheck className="h-3.5 w-3.5" />
              </span>
            )}
          </div>
          <p className="text-sm text-gray-300 line-clamp-2 leading-relaxed mb-2">{agent.bio || agent.specialty}</p>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1">
              <Stars rating={rating} />
              <span className="text-xs text-gray-400">{rating.toFixed(1)}</span>
            </div>
            {agent.category && <Badge variant="default" size="sm">{agent.category}</Badge>}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <div className="text-right tabular-nums">
            <div className="text-lg font-bold text-cyan-400">${Number(agent.rate).toFixed(2)}</div>
            <div className="text-[10px] uppercase tracking-wide text-gray-500">/min</div>
          </div>
          {/* Tap to call indicator */}
          <div className="px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 group-hover:bg-cyan-500/20 transition-colors">
            <Phone className="w-3.5 h-3.5 text-cyan-400" />
          </div>
        </div>
      </div>
    </Card>
  );
});

export const FeaturedCard = React.memo(function FeaturedCard({
  agent,
  onClick,
}: {
  agent: Agent;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full sm:flex-shrink-0 sm:w-36 rounded-2xl p-4 text-left transition-all duration-300 border-2 border-gray-800 bg-gray-900/50 hover:border-gray-700 active:scale-[0.98]"
    >
      <Avatar size="md" online={agent.online}>{agent.avatar}</Avatar>
      <div className="mt-3">
        <div className="font-semibold text-white text-sm truncate">{agent.name}</div>
        <div className="text-xs text-gray-400 truncate mt-0.5">{agent.specialty}</div>
        <div className="flex items-center gap-1 mt-2">
          <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
          <span className="text-xs text-gray-300">{(Number(agent.rating) || 0).toFixed(1)}</span>
        </div>
      </div>
    </button>
  );
});
