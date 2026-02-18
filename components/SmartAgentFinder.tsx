'use client';

import { useState, useCallback, useEffect } from 'react';
import { Sparkles, Search, ArrowRight, Clock, DollarSign, Star, Zap } from 'lucide-react';
import { useAgentMatching } from '@/lib/agentMatching';
import type { AgentMatch } from '@/lib/agentMatching';

interface SmartAgentFinderProps {
  availableAgents: string[];
  onSelectAgent: (agentId: string) => void;
  onMinimize?: () => void;
}

export function SmartAgentFinder({ availableAgents, onSelectAgent, onMinimize }: SmartAgentFinderProps) {
  const [input, setInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [matches, setMatches] = useState<AgentMatch[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(true);

  const { parseIntent, findMatches, getQuickSuggestions } = useAgentMatching();

  // Debounced search
  useEffect(() => {
    if (!input.trim()) {
      setMatches([]);
      setShowSuggestions(true);
      return;
    }

    setShowSuggestions(false);
    setIsSearching(true);

    const timer = setTimeout(() => {
      const parsedIntent = parseIntent(input);
      const agentMatches = findMatches(parsedIntent, availableAgents);
      setMatches(agentMatches.slice(0, 3)); // Show top 3
      setIsSearching(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [input, availableAgents, parseIntent, findMatches]);

  const handleSuggestionClick = useCallback((suggestionIntent: string) => {
    setInput(suggestionIntent);
  }, []);

  const handleAgentSelect = useCallback((agentId: string) => {
    onSelectAgent(agentId);
    setInput('');
  }, [onSelectAgent]);

  const suggestions = getQuickSuggestions();

  return (
    <div className="relative">
      {/* Search Input */}
      <div className="relative group">
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <div className="relative bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/30 rounded-2xl p-4 hover:border-cyan-500/50 transition-all duration-300">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center shadow-lg shadow-cyan-500/25">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-white">Smart Agent Finder</h3>
              <p className="text-xs text-gray-400">Describe what you need, we'll find the perfect agent</p>
            </div>
            {onMinimize && (
              <button
                onClick={onMinimize}
                className="p-2 text-gray-400 hover:text-white transition-colors"
                aria-label="Minimize"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="e.g., 'Help me debug my Solana smart contract' or 'Need tax advice for crypto'"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-gray-800/80 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all"
            />
            {isSearching && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <div className="w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Suggestions */}
      {showSuggestions && (
        <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
            <Zap className="w-3 h-3" /> Try these:
          </p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion, i) => (
              <button
                key={i}
                onClick={() => handleSuggestionClick(suggestion.intent)}
                className="px-3 py-1.5 bg-gray-800/50 hover:bg-gray-700/80 text-gray-300 rounded-full text-xs font-medium transition-all hover:scale-105 border border-gray-700/50 hover:border-cyan-500/30"
              >
                {suggestion.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Matching Results */}
      {matches.length > 0 && (
        <div className="mt-4 space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">
              Found {matches.length} matching agent{matches.length !== 1 ? 's' : ''}
            </p>
            <div className="flex items-center gap-1 text-xs text-cyan-400">
              <Sparkles className="w-3 h-3" /> AI-powered
            </div>
          </div>

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
        <div className="mt-4 p-4 bg-gray-800/30 rounded-xl border border-gray-700/50 text-center">
          <p className="text-sm text-gray-400 mb-2">No specific matches found</p>
          <button
            onClick={() => handleAgentSelect('agent_2101khgsyd02fnvshvr7rzb50qj6')}
            className="px-4 py-2 bg-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/30 transition-colors text-sm font-medium"
          >
            Talk to General Helper
          </button>
        </div>
      )}
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

  const isTopMatch = rank === 1;

  return (
    <button
      onClick={onSelect}
      className={`w-full p-3 rounded-xl border transition-all duration-300 text-left group hover:scale-[1.02] ${
        isTopMatch
          ? 'bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border-cyan-500/40 hover:border-cyan-500/60'
          : 'bg-gray-800/30 border-gray-700/50 hover:border-cyan-500/30'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Rank Badge */}
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
          isTopMatch ? 'bg-gradient-to-br from-cyan-500 to-purple-500 text-white' : 'bg-gray-700 text-gray-400'
        }`}>
          {rank}
        </div>

        {/* Agent Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-bold text-white truncate">{profile.name}</h3>
            {isTopMatch && (
              <span className="px-2 py-0.5 bg-gradient-to-r from-cyan-500 to-purple-500 text-white text-[10px] rounded-full font-medium whitespace-nowrap">
                ⭐ Best Match
              </span>
            )}
          </div>

          <p className="text-sm text-cyan-400 mb-2 truncate">{match.reason}</p>

          {/* Stats */}
          <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
            <span className="flex items-center gap-1">
              <DollarSign className="w-3 h-3" />
              {match.estimatedCost} est.
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {match.estimatedDuration}
            </span>
            <span className="text-gray-500">
              ${profile.ratePerMinute}/min
            </span>
          </div>
        </div>

        {/* Arrow */}
        <ArrowRight className="w-4 h-4 text-gray-600 group-hover:text-cyan-400 transition-colors flex-shrink-0" />
      </div>

      {/* Match Score */}
      <div className="mt-2 flex items-center gap-2">
        <div className="flex-1 h-1 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${isTopMatch ? 'bg-gradient-to-r from-cyan-500 to-purple-500' : 'bg-gray-600'}`}
            style={{ width: `${match.score}%` }}
          />
        </div>
        <span className="text-[10px] text-gray-500 whitespace-nowrap">{match.score}% match</span>
      </div>
    </button>
  );
}
