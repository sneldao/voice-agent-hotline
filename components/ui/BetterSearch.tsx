'use client';

import { useState, useCallback } from 'react';
import { Button } from './Button';
import { Badge } from './Badge';
import { Search, Settings, X, ChevronRight } from './Toast';

interface SearchFilters {
  query: string;
  type: 'all' | 'ai' | 'human';
  priceRange: 'all' | 'free' | 'cheap' | 'premium';
  rating: number;
  category: string;
}

interface BetterSearchProps {
  onSearch: (filters: SearchFilters) => void;
  placeholder?: string;
}

const CATEGORIES = [
  { id: 'all', name: 'All' },
  { id: 'language', name: '🗣️ Languages' },
  { id: 'coding', name: '💻 Coding' },
  { id: 'cooking', name: '🍳 Cooking' },
  { id: 'music', name: '🎵 Music' },
  { id: 'fitness', name: '💪 Fitness' },
  { id: 'business', name: '💼 Business' },
  { id: 'therapy', name: '🧠 Mental Health' },
];

export function BetterSearch({ onSearch, placeholder = "Search agents..." }: BetterSearchProps) {
  const [filters, setFilters] = useState<SearchFilters>({
    query: '',
    type: 'all',
    priceRange: 'all',
    rating: 0,
    category: 'all',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = useCallback(() => {
    setIsSearching(true);
    onSearch(filters);
    setTimeout(() => setIsSearching(false), 500);
  }, [filters, onSearch]);

  const clearFilters = () => {
    const cleared: SearchFilters = {
      query: '',
      type: 'all',
      priceRange: 'all',
      rating: 0,
      category: 'all',
    };
    setFilters(cleared);
    onSearch(cleared);
  };

  const hasActiveFilters = filters.type !== 'all' || 
    filters.priceRange !== 'all' || 
    filters.rating > 0 || 
    filters.category !== 'all';

  return (
    <div className="sticky top-0 z-20 bg-gray-900/95 backdrop-blur-xl border-b border-gray-800">
      {/* Main Search Bar */}
      <div className="flex items-center gap-3 p-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder={placeholder}
            value={filters.query}
            onChange={(e) => setFilters(prev => ({ ...prev, query: e.target.value }))}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="w-full bg-gray-800/80 border border-gray-700 rounded-xl pl-12 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 transition-colors"
          />
          {filters.query && (
            <button
              onClick={() => setFilters(prev => ({ ...prev, query: '' }))}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center hover:bg-gray-600 transition-colors"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>
        
        <Button 
          onClick={() => setShowFilters(!showFilters)}
          variant={showFilters ? 'default' : 'secondary'}
          className={showFilters ? 'bg-cyan-500/20 border-cyan-500/50' : ''}
        >
          <Settings className="w-5 h-5 mr-2" />
          Filters
          {hasActiveFilters && (
            <span className="ml-2 w-5 h-5 rounded-full bg-cyan-500 text-white text-xs flex items-center justify-center">
             !
            </span>
          )}
        </Button>
      </div>

      {/* Quick Filter Tabs */}
      <div className="flex items-center gap-2 px-4 pb-3 overflow-x-auto scrollbar-hide">
        <FilterChip
          active={filters.type === 'all'}
          onClick={() => { setFilters(prev => ({ ...prev, type: 'all' })); handleSearch(); }}
        >
          All
        </FilterChip>
        <FilterChip
          active={filters.type === 'ai'}
          onClick={() => { setFilters(prev => ({ ...prev, type: 'ai' })); handleSearch(); }}
        >
          🤖 AI
        </FilterChip>
        <FilterChip
          active={filters.type === 'human'}
          onClick={() => { setFilters(prev => ({ ...prev, type: 'human' })); handleSearch(); }}
        >
          👤 Human
        </FilterChip>
        <div className="w-px h-6 bg-gray-700 mx-2" />
        <FilterChip
          active={filters.priceRange === 'free'}
          onClick={() => { setFilters(prev => ({ ...prev, priceRange: filters.priceRange === 'free' ? 'all' : 'free' })); handleSearch(); }}
        >
          🆓 Free
        </FilterChip>
        <FilterChip
          active={filters.priceRange === 'cheap'}
          onClick={() => { setFilters(prev => ({ ...prev, priceRange: filters.priceRange === 'cheap' ? 'all' : 'cheap' })); handleSearch(); }}
        >
          💵 Under $0.05
        </FilterChip>
      </div>

      {/* Expanded Filters Panel */}
      {showFilters && (
        <div className="p-4 bg-gray-800/30 border-t border-gray-800 animate-slide-down">
          {/* Category Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-300">Category</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => { setFilters(prev => ({ ...prev, category: cat.id })); }}
                  className={`
                    px-4 py-2 rounded-xl text-sm font-medium transition-all
                    ${filters.category === cat.id
                      ? 'bg-cyan-500 text-white'
                      : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800'
                    }
                  `}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Rating Filter */}
          <div className="space-y-3 mt-4">
            <label className="text-sm font-medium text-gray-300">Minimum Rating</label>
            <div className="flex gap-2">
              {[0, 3, 4, 4.5].map((rating) => (
                <button
                  key={rating}
                  onClick={() => { setFilters(prev => ({ ...prev, rating: prev.rating === rating ? 0 : rating })); handleSearch(); }}
                  className={`
                    flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all
                    ${filters.rating === rating
                      ? 'bg-cyan-500 text-white'
                      : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800'
                    }
                  `}
                >
                  ⭐ {rating === 0 ? 'Any' : `${rating}+`}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 mt-6 pt-4 border-t border-gray-700">
            <Button 
              variant="secondary" 
              onClick={clearFilters}
              className="flex-1"
            >
              Clear All
            </Button>
            <Button 
              onClick={handleSearch}
              isLoading={isSearching}
              className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-500"
            >
              Apply Filters
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// Filter Chip Component
function FilterChip({ 
  children, 
  active, 
  onClick 
}: { 
  children: React.ReactNode; 
  active: boolean; 
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all
        ${active
          ? 'bg-cyan-500 text-white'
          : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800'
        }
      `}
    >
      {children}
    </button>
  );
}
