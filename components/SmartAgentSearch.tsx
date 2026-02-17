'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Search, Sparkles, ArrowRight, Clock, DollarSign, X } from 'lucide-react';
import { useAgentMatching } from '@/lib/agentMatching';
import type { AgentMatch, UserIntent } from '@/lib/agentMatching';

interface SmartAgentSearchProps {
  availableAgents: string[];
  onSelectAgent: (agentId: string) => void;
  onClose: () => void;
}

export function SmartAgentSearch({ availableAgents, onSelectAgent, onClose }: SmartAgentSearchProps) {
  const [input, setInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [intent, setIntent] = useState<UserIntent | null>(null);
  const [matches, setMatches] = useState<AgentMatch[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const { parseIntent, findMatches, getQuickSuggestions } = useAgentMatching();
  
  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  
  // Debounced search
  useEffect(() => {
    if (!input.trim()) {
      setIntent(null);
      setMatches([]);
      setShowSuggestions(true);
      return;
    }
    
    setShowSuggestions(false);
    setIsSearching(true);
    
    const timer = setTimeout(() => {
      const parsedIntent = parseIntent(input);
      setIntent(parsedIntent);
      
      const agentMatches = findMatches(parsedIntent, availableAgents);
      setMatches(agentMatches);
      setIsSearching(false);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [input, availableAgents, parseIntent, findMatches]);
  
  const handleSuggestionClick = useCallback((suggestionIntent: string) => {
    setInput(suggestionIntent);
  }, []);
  
  const handleAgentSelect = useCallback((agentId: string) => {
    onSelectAgent(agentId);
  }, [onSelectAgent]);
  
  const suggestions = getQuickSuggestions();
  
  return (
    <div className="fixed inset-0 z-50 bg-gray-950/95 backdrop-blur-sm flex items-start justify-center pt-20 p-4">
      <div className="w-full max-w-2xl bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-cyan-400" />
            <span className="font-semibold text-white">Smart Agent Finder</span>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Search Input */}
        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              placeholder="What do you need help with?"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-gray-800 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 text-lg"
            />
            {isSearching && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <div className="w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
          
          {/* Intent Detection */}
          {intent && (
            <div className="mt-3 flex flex-wrap gap-2">
              {intent.category && (
                <span className="px-3 py-1 bg-cyan-500/20 text-cyan-400 rounded-full text-sm">
                  {intent.category}
                </span>
              )}
              {intent.taskType && (
                <span className="px-3 py-1 bg-purple-500/20 text-purple-400 rounded-full text-sm">
                  {intent.taskType}
                </span>
              )}
              {intent.urgency && intent.urgency !== 'medium' && (
                <span className={`px-3 py-1 rounded-full text-sm ${
                  intent.urgency === 'high' 
                    ? 'bg-red-500/20 text-red-400' 
                    : 'bg-green-500/20 text-green-400'
                }`}>
                  {intent.urgency} urgency
                </span>
              )}
            </div>
          )}
        </div>
        
        {/* Content */}
        <div className="max-h-[60vh] overflow-y-auto">
          {/* Quick Suggestions */}
          {showSuggestions && (
            <div className="p-4 pt-0">
              <p className="text-sm text-gray-400 mb-3">Popular requests:</p>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => handleSuggestionClick(suggestion.intent)}
                    className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-full text-sm transition-colors"
                  >
                    {suggestion.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {/* Matching Results */}
          {matches.length > 0 && (
            <div className="p-4 pt-0 space-y-3">
              <p className="text-sm text-gray-400">
                Found {matches.length} matching agent{matches.length !== 1 ? 's' : ''}
              </p>
              
              {matches.map((match, index) => (
                <AgentMatchCard
                  key={match.agentId}
                  match={match}
                  rank={index + 1}
                  onSelect={() => handleAgentSelect(match.agentId)}
                />
              ))}
            </div>
          )}
          
          {/* No Results */}
          {input.trim() && !isSearching && matches.length === 0 && (
            <div className="p-8 text-center">
              <p className="text-gray-400 mb-2">No specific matches found</p>
              <p className="text-sm text-gray-500 mb-4">
                Try a different description or browse all agents
              </p>
              <button
                onClick={() => handleAgentSelect('agent_2101khgsyd02fnvshvr7rzb50qj6')}
                className="px-4 py-2 bg-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/30 transition-colors"
              >
                Talk to General Helper
              </button>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t border-gray-800 bg-gray-900/50">
          <p className="text-xs text-gray-500 text-center">
            Describe what you need help with, and we will match you with the best agent
          </p>
        </div>
      </div>
    </div>
  );
}

interface AgentMatchCardProps {
  match: AgentMatch;
  rank: number;
  onSelect: () => void;
}

function AgentMatchCard({ match, rank, onSelect }: AgentMatchCardProps) {
  const { matcher } = useAgentMatching();
  const profile = matcher.getAgentProfile(match.agentId);
  
  if (!profile) return null;
  
  // Rank styling
  const rankStyles = {
    1: 'border-cyan-500/50 bg-cyan-500/5',
    2: 'border-gray-600/50 bg-gray-800/30',
    3: 'border-gray-700/50 bg-gray-800/20',
  };
  
  const rankStyle = rankStyles[rank as keyof typeof rankStyles] || 'border-gray-800';
  const isTopMatch = rank === 1;
  
  return (
    <button
      onClick={onSelect}
      className={`w-full p-4 rounded-xl border ${rankStyle} hover:border-cyan-500/50 transition-all text-left group`}
    >
      <div className="flex items-start gap-4">
        {/* Rank Badge */}
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
          isTopMatch ? 'bg-cyan-500 text-white' : 'bg-gray-800 text-gray-400'
        }`}>
          {rank}
        </div>
        
        {/* Agent Info */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-bold text-white">{profile.name}</h3>
            {isTopMatch && (
              <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 text-xs rounded-full">
                Best Match
              </span>
            )}
          </div>
          
          <p className="text-sm text-cyan-400 mb-2">{match.reason}</p>
          
          {/* Stats */}
          <div className="flex items-center gap-4 text-sm text-gray-400">
            <span className="flex items-center gap-1">
              <DollarSign className="w-4 h-4" />
              {match.estimatedCost} est.
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {match.estimatedDuration}
            </span>
            <span className="text-gray-500">
              ${profile.ratePerMinute}/min
            </span>
          </div>
          
          {/* Specialties */}
          <div className="flex flex-wrap gap-1 mt-2">
            {profile.specialties.slice(0, 3).map((specialty, i) => (
              <span key={i} className="px-2 py-0.5 bg-gray-800 text-gray-400 text-xs rounded">
                {specialty}
              </span>
            ))}
          </div>
        </div>
        
        {/* Arrow */}
        <ArrowRight className="w-5 h-5 text-gray-600 group-hover:text-cyan-400 transition-colors" />
      </div>
      
      {/* Match Score */}
      <div className="mt-3 flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full ${isTopMatch ? 'bg-cyan-500' : 'bg-gray-600'}`}
            style={{ width: `${match.score}%` }}
          />
        </div>
        <span className="text-xs text-gray-500">{match.score}% match</span>
      </div>
    </button>
  );
}
