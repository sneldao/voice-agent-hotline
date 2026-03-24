'use client';

import React, { useState } from 'react';
import { Star, ChevronRight, Phone } from 'lucide-react';
import { Card, Badge, Avatar, Modal, Button } from '@/components/ui';

export const AgentCard = React.memo(function AgentCard({
  agent,
  onClick,
}: {
  agent: any;
  onClick: () => void;
}) {
  const rating = Number(agent.rating) || 0;
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;

  return (
    <Card
      interactive
      variant="default"
      className="group relative overflow-hidden p-4 hover:border-gray-700/50 transition-all duration-200"
      onClick={onClick}
    >
      <div className="flex items-start gap-4 relative">
        <div className="relative flex-shrink-0">
          <Avatar size="lg" online={agent.online}>{agent.avatar}</Avatar>
          {agent.online && <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-gray-900 rounded-full animate-pulse" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="font-bold text-white truncate max-w-[180px]">{agent.name}</span>
            {agent.verified && <Badge variant="info" size="sm" className="flex-shrink-0">✓ Verified</Badge>}
          </div>
          <p className="text-sm text-gray-300 line-clamp-2 leading-relaxed mb-2.5">{agent.bio || agent.specialty}</p>
          <div className="flex items-center gap-2 mb-2">
            <div className="flex items-center gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className={`w-4 h-4 ${i < fullStars ? 'text-yellow-400 fill-yellow-400' : i === fullStars && hasHalfStar ? 'text-yellow-400 fill-yellow-400/50' : 'text-gray-600'}`} />
              ))}
            </div>
            <span className="text-sm font-medium text-gray-300">{rating.toFixed(1)}</span>
            <span className="text-xs text-gray-500">({agent.totalRatings || 0})</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {agent.totalCalls && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-800/50 text-xs text-gray-400">
                <Phone className="w-3 h-3" />{agent.totalCalls} calls
              </span>
            )}
            {agent.category && <Badge variant="default" size="sm">{agent.category}</Badge>}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-xl font-bold text-cyan-400">${agent.rate}</div>
          <div className="text-xs text-gray-500 mb-2">/min</div>
          <div className={`px-2.5 py-1 rounded-full text-xs font-medium ${agent.online ? 'bg-green-500/10 text-green-400 border border-green-500/30' : 'bg-gray-800 text-gray-500 border border-gray-700'}`}>
            {agent.online ? '● Available' : '○ Offline'}
          </div>
        </div>
      </div>
      <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
        <ChevronRight className="w-5 h-5 text-cyan-400" />
      </div>
    </Card>
  );
});

export const FeaturedCard = React.memo(function FeaturedCard({
  agent,
  onClick,
}: {
  agent: any;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full sm:flex-shrink-0 sm:w-36 rounded-2xl p-4 text-left transition-all duration-300 border-2 border-gray-800 bg-gray-900/50 hover:border-gray-700"
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

export function AgentDetailModal({
  agent,
  onClose,
  onCall,
}: {
  agent: any | null;
  onClose: () => void;
  onCall: () => void;
}) {
  const [calling, setCalling] = useState(false);
  const [estimatedMins, setEstimatedMins] = useState(5);

  if (!agent) return null;

  const estimatedCost = (agent.rate * estimatedMins).toFixed(2);

  const handleCall = () => {
    setCalling(true);
    onCall();
  };

  return (
    <Modal isOpen={!!agent} onClose={onClose} size="md">
      <div className={`-mx-6 -mt-6 mb-6 p-6 rounded-t-2xl bg-gradient-to-br ${agent.color} text-center`}>
        <div className="relative inline-block">
          <Avatar size="xl" className="bg-white/20 text-4xl">{agent.avatar}</Avatar>
          {agent.online && <span className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 border-2 border-white rounded-full" />}
        </div>
        <h2 className="text-2xl font-bold text-white mt-3">{agent.name}</h2>
        <p className="text-white/80 text-sm mt-1">{agent.specialty}</p>
        <div className="flex items-center justify-center gap-6 mt-4">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 font-bold text-white">
              <span>⭐</span> {(Number(agent.rating) || 0).toFixed(1)}
            </div>
            <div className="text-xs text-white/60">{agent.totalRatings ?? 0} reviews</div>
          </div>
          <div className="text-center">
            <div className="font-bold text-white">${agent.rate}</div>
            <div className="text-xs text-white/60">/minute</div>
          </div>
          {agent.totalCalls && (
            <div className="text-center">
              <div className="font-bold text-white">{agent.totalCalls}</div>
              <div className="text-xs text-white/60">calls</div>
            </div>
          )}
        </div>
      </div>
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-300 mb-2 block">
            Call Duration
          </label>
          <div className="flex gap-2">
            {[1, 5, 10, 15].map(mins => (
              <button
                key={mins}
                onClick={() => setEstimatedMins(mins)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  estimatedMins === mins ? 'bg-cyan-500 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {mins}m
              </button>
            ))}
          </div>
        </div>
        <div className="bg-gray-800/50 rounded-xl p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-400">Rate</span>
            <span className="text-white font-medium">${agent.rate}/min</span>
          </div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-400">Duration</span>
            <span className="text-white">{estimatedMins} minutes</span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-gray-700">
            <span className="text-gray-400">Estimated Cost</span>
            <span className="text-cyan-400 font-bold text-lg">${estimatedCost}</span>
          </div>
        </div>
        <p className="text-xs text-gray-500">
          Payment is settled on-chain before the call connects. You only pay for the time you use.
        </p>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
          <Button
            onClick={handleCall}
            className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400"
          >
            <Phone className="w-4 h-4 mr-2" />
            {calling ? 'Connecting...' : 'Start Call'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
