'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button, Card, Badge, Avatar, Modal, Tabs, EmptySearchState, PullToRefresh, RefreshButton, ToastProvider, showSuccess, showError, showWarning, Wallet, Search, Phone, User, Star, Clock, Settings, Bell, ChevronRight } from '@/components/ui';
import { announce } from '@/lib/accessibility';

// Demo data
const DEMO_AGENTS = [
  {
    id: 'maria_garcia',
    name: 'Maria Garcia',
    specialty: 'Spanish Tutor',
    bio: 'Native Spanish speaker with 5 years of teaching experience. I help students practice conversational Spanish.',
    rating: 4.9,
    totalRatings: 347,
    rate: 0.01,
    avatar: '👩‍🏫',
    color: 'from-rose-500 to-pink-500',
    online: true,
    tags: ['Spanish', 'Language', 'Conversation'],
  },
  {
    id: 'alex_chen',
    name: 'Alex Chen',
    specialty: 'Coding Help',
    bio: 'Full-stack developer and coding mentor. I help beginners understand programming concepts.',
    rating: 4.8,
    totalRatings: 523,
    rate: 0.03,
    avatar: '👨‍💻',
    color: 'from-cyan-500 to-blue-500',
    online: true,
    tags: ['JavaScript', 'Python', 'Debugging'],
  },
  {
    id: 'chef_mario',
    name: 'Chef Mario',
    specialty: 'Cooking',
    bio: 'Professional chef with 15 years experience in Italian cuisine. I\'ll help you cook perfect pasta.',
    rating: 4.7,
    totalRatings: 256,
    rate: 0.01,
    avatar: '👨‍🍳',
    color: 'from-amber-500 to-orange-500',
    online: false,
    tags: ['Italian', 'Recipes', 'Techniques'],
  },
  {
    id: 'sofia_travel',
    name: 'Sofia Williams',
    specialty: 'Travel Guide',
    bio: 'Travel expert visited 50+ countries. Local tips and recommendations.',
    rating: 4.6,
    totalRatings: 189,
    rate: 0.02,
    avatar: '✈️',
    color: 'from-violet-500 to-purple-500',
    online: true,
    tags: ['Travel', 'Culture', 'Recommendations'],
  },
];

const DEMO_CALL_HISTORY = [
  { id: 'call_1', agentName: 'Maria Garcia', duration: 125, cost: 0.01, date: 'Today', rating: 5 },
  { id: 'call_2', agentName: 'Alex Chen', duration: 340, cost: 0.07, date: 'Yesterday', rating: 5 },
  { id: 'call_3', agentName: 'Chef Mario', duration: 45, cost: 0, date: '2 days ago', rating: 4 },
];

const CATEGORIES = [
  { id: 'all', name: 'All', icon: '🌐' },
  { id: 'language', name: 'Language', icon: '🗣️' },
  { id: 'coding', name: 'Coding', icon: '💻' },
  { id: 'cooking', name: 'Cooking', icon: '🍳' },
  { id: 'travel', name: 'Travel', icon: '✈️' },
];

type Tab = 'discover' | 'calls' | 'profile';

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('discover');
  const [selectedAgent, setSelectedAgent] = useState<typeof DEMO_AGENTS[0] | null>(null);
  const [inCall, setInCall] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [callCost, setCallCost] = useState(0);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [userBalance, setUserBalance] = useState(2.50);
  const mainContentRef = useRef<HTMLElement>(null);

  // Keyboard navigation for accessibility
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape closes modals and call view
      if (e.key === 'Escape') {
        if (inCall) {
          endCall();
          announce('Call ended');
        } else if (showPaymentModal) {
          setShowPaymentModal(false);
          announce('Payment modal closed');
        } else if (selectedAgent) {
          setSelectedAgent(null);
          announce('Agent details closed');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inCall, showPaymentModal, selectedAgent]);

  // Focus management when modals open/close
  useEffect(() => {
    if (selectedAgent || showPaymentModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }, [selectedAgent, showPaymentModal]);

  const startCall = useCallback(() => {
    if (selectedAgent) {
      setInCall(true);
      setCallDuration(0);
      setCallCost(0);
    }
  }, [selectedAgent]);

  const endCall = useCallback(() => {
    setInCall(false);
    setSelectedAgent(null);
    setShowPaymentModal(true);
  }, []);

  const filteredAgents = DEMO_AGENTS.filter(agent => {
    const matchesSearch = agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.specialty.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === 'all' || 
      agent.tags.some(t => t.toLowerCase().includes(selectedCategory.toLowerCase()));
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans">
      <ToastProvider />
      {/* Skip to main content for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-cyan-500 focus:text-white focus:rounded-lg"
      >
        Skip to main content
      </a>

      {/* Header */}
      <header className="sticky top-0 z-50 bg-gray-950/80 backdrop-blur-xl border-b border-gray-800/50" role="banner">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/25" role="img" aria-label="Voice Hotline logo">
              <Phone className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg">Voice Hotline</h1>
              <p className="text-xs text-gray-500">AI-Powered Voice Agents</p>
            </div>
          </div>
          <div className="flex items-center gap-2" role="group" aria-label="User balance and notifications">
            <div className="px-3 py-1.5 rounded-full bg-gray-800/50 border border-gray-700/50 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-cyan-400" />
              <span className="text-sm font-medium text-cyan-400">${userBalance.toFixed(2)}</span>
            </div>
            <button
              className="w-10 h-10 rounded-xl bg-gray-800/50 border border-gray-700/50 flex items-center justify-center hover:bg-gray-800 transition-colors"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main id="main-content" className="max-w-md mx-auto pb-28" role="main" aria-label="Main content">
        {inCall ? (
          <CallView
            agent={selectedAgent!}
            duration={callDuration}
            cost={callCost}
            onEnd={endCall}
          />
        ) : (
          <>
            {activeTab === 'discover' && (
              <DiscoverTab
                agents={filteredAgents}
                onSelect={setSelectedAgent}
                selectedAgent={selectedAgent}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                selectedCategory={selectedCategory}
                onCategoryChange={setSelectedCategory}
                onCall={startCall}
              />
            )}
            {activeTab === 'calls' && (
              <CallsHistoryTab history={DEMO_CALL_HISTORY} />
            )}
            {activeTab === 'profile' && (
              <ProfileTab balance={userBalance} />
            )}
          </>
        )}
      </main>

      {/* Bottom Navigation */}
      {!inCall && (
        <Tabs
          tabs={[
            { id: 'discover', icon: <Search className="w-5 h-5" />, label: 'Discover' },
            { id: 'calls', icon: <Phone className="w-5 h-5" />, label: 'Calls' },
            { id: 'profile', icon: <User className="w-5 h-5" />, label: 'Profile' },
          ]}
          activeTab={activeTab}
          onTabChange={(t) => setActiveTab(t as Tab)}
        />
      )}

      {/* Payment Modal */}
      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        agent={selectedAgent}
        duration={callDuration}
        cost={callCost}
        onPay={() => {
          setUserBalance(prev => prev - callCost);
          setShowPaymentModal(false);
        }}
      />
    </div>
  );
}

/**
 * Discover Tab
 */
function DiscoverTab({
  agents,
  onSelect,
  selectedAgent,
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  onCall,
}: {
  agents: typeof DEMO_AGENTS;
  onSelect: (a: typeof DEMO_AGENTS[0]) => void;
  selectedAgent: typeof DEMO_AGENTS[0] | null;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedCategory: string;
  onCategoryChange: (c: string) => void;
  onCall: () => void;
}) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsRefreshing(false);
    showSuccess('Agents refreshed');
  }, []);

  const hasSearchQuery = searchQuery.trim().length > 0;
  const hasNoResults = agents.length === 0 && !hasSearchQuery;
  const hasNoSearchResults = agents.length === 0 && hasSearchQuery;

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="p-4 space-y-5">
        {/* Search with refresh */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search agents..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-gray-800/50 border border-gray-700/50 text-sm focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all"
            />
          </div>
          <RefreshButton onRefresh={handleRefresh} />
        </div>

        {/* Categories */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => onCategoryChange(cat.id)}
              className={`
                flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 border
                ${selectedCategory === cat.id
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white border-transparent shadow-lg shadow-cyan-500/25'
                  : 'bg-gray-800/50 text-gray-400 border-gray-700/50 hover:border-gray-600'
                }
              `}
            >
              <span className="mr-1.5">{cat.icon}</span>
              {cat.name}
            </button>
          ))}
        </div>

        {/* Empty states */}
        {hasNoSearchResults && (
          <EmptySearchState onClear={() => onSearchChange('')} />
        )}

        {hasNoResults && (
          <EmptySearchState onClear={() => onCategoryChange('all')} />
        )}

        {/* Content */}
        {!hasNoResults && !hasNoSearchResults && (
          <>
            {/* Featured Agents */}
            {agents.filter(a => a.online).length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
                  <Star className="w-4 h-4 text-yellow-400" /> Featured
                </h2>
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
                  {agents.filter(a => a.online).map(agent => (
                    <FeaturedCard
                      key={agent.id}
                      agent={agent}
                      onClick={() => onSelect(agent)}
                      selected={selectedAgent?.id === agent.id}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* All Agents */}
            <section>
              <h2 className="text-sm font-semibold text-gray-400 mb-3">
                {selectedCategory === 'all' ? 'All Agents' : CATEGORIES.find(c => c.id === selectedCategory)?.name}
              </h2>
              <div className="space-y-3">
                {agents.map(agent => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    onClick={() => onSelect(agent)}
                    selected={selectedAgent?.id === agent.id}
                  />
                ))}
              </div>
            </section>
          </>
        )}

        {/* Agent Detail Modal */}
        <AgentDetailModal
          agent={selectedAgent}
          onClose={() => onSelect(null as any)}
          onCall={onCall}
        />
      </div>
    </PullToRefresh>
  );
}

/**
 * Featured Card
 */
function FeaturedCard({
  agent,
  onClick,
  selected,
}: {
  agent: typeof DEMO_AGENTS[0];
  onClick: () => void;
  selected: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        flex-shrink-0
        w-36
        rounded-2xl
        p-4
        text-left
        transition-all
        duration-300
        border-2
        bg-gradient-to-br
        ${agent.color}
        ${selected ? 'border-cyan-400 scale-105' : 'border-transparent hover:scale-105 hover:border-white/20'}
      `}
    >
      <div className="text-3xl mb-3">{agent.avatar}</div>
      <div className="font-bold text-sm text-white truncate">{agent.name}</div>
      <div className="text-xs text-white/70 truncate mb-2">{agent.specialty}</div>
      <div className="flex items-center gap-1.5 text-xs text-white/80">
        <span>⭐ {agent.rating}</span>
        <span>•</span>
        <span>${agent.rate}/min</span>
      </div>
    </button>
  );
}

/**
 * Agent Card
 */
function AgentCard({
  agent,
  onClick,
  selected,
}: {
  agent: typeof DEMO_AGENTS[0];
  onClick: () => void;
  selected: boolean;
}) {
  return (
    <Card
      interactive
      variant={selected ? 'gradient' : 'default'}
      className={`
        flex items-center gap-4 p-4
        ${selected ? 'border-cyan-500/50' : ''}
      `}
      onClick={onClick}
    >
      <Avatar size="lg" online={agent.online}>
        {agent.avatar}
      </Avatar>
      
      <div className="flex-1 text-left min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold truncate">{agent.name}</span>
          {agent.online && (
            <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
          )}
        </div>
        <p className="text-sm text-gray-400 truncate">{agent.bio}</p>
        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="text-yellow-400">⭐</span> {agent.rating}
          </span>
          <span>{agent.totalRatings} reviews</span>
        </div>
      </div>

      <div className="text-right flex-shrink-0">
        <div className="text-lg font-bold text-cyan-400">${agent.rate}</div>
        <div className="text-xs text-gray-500">/min</div>
        <Badge variant={agent.online ? 'success' : 'default'} size="sm" className="mt-1">
          {agent.online ? 'Available' : 'Offline'}
        </Badge>
      </div>
    </Card>
  );
}

/**
 * Agent Detail Modal
 */
function AgentDetailModal({
  agent,
  onClose,
  onCall,
}: {
  agent: typeof DEMO_AGENTS[0] | null;
  onClose: () => void;
  onCall: () => void;
}) {
  const [calling, setCalling] = useState(false);

  if (!agent) return null;

  const handleCall = () => {
    setCalling(true);
    setTimeout(() => {
      onCall();
    }, 1500);
  };

  return (
    <Modal
      isOpen={!!agent}
      onClose={onClose}
      size="md"
    >
      {/* Header gradient */}
      <div className={`-mx-6 -mt-6 mb-6 p-6 rounded-t-2xl bg-gradient-to-br ${agent.color} text-center`}>
        <Avatar size="xl" online={agent.online} className="mx-auto mb-4 border-4 border-white/20">
          {agent.avatar}
        </Avatar>
        <h2 className="text-xl font-bold text-white">{agent.name}</h2>
        <p className="text-white/70 text-sm">{agent.specialty}</p>
        
        <div className="flex items-center justify-center gap-6 mt-4">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 font-bold text-white">
              <span>⭐</span> {agent.rating}
            </div>
            <div className="text-xs text-white/60">{agent.totalRatings} reviews</div>
          </div>
          <div className="text-center">
            <div className="font-bold text-white">${agent.rate}</div>
            <div className="text-xs text-white/60">/minute</div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-400 mb-2">About</h3>
          <p className="text-sm text-gray-300">{agent.bio}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {agent.tags.map(tag => (
            <Badge key={tag} variant="info">{tag}</Badge>
          ))}
        </div>

        <Button
          onClick={handleCall}
          disabled={!agent.online || calling}
          isLoading={calling}
          className="w-full"
          size="lg"
        >
          {calling ? 'Connecting...' : agent.online ? '🎙️ Call Now' : 'Offline'}
        </Button>

        <p className="text-xs text-center text-gray-500">
          First minute free • x402 micropayments on Celo
        </p>
      </div>
    </Modal>
  );
}

/**
 * Call View
 */
function CallView({
  agent,
  duration,
  cost,
  onEnd,
}: {
  agent: typeof DEMO_AGENTS[0];
  duration: number;
  cost: number;
  onEnd: () => void;
}) {
  const [muted, setMuted] = useState(false);
  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;
  const isFree = duration <= 60;

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-gray-900 via-gray-950 to-gray-900">
      {/* Header */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        {/* Avatar with pulse */}
        <div className="relative mb-8">
          <div className={`w-40 h-40 rounded-full bg-gradient-to-br ${agent.color} flex items-center justify-center text-7xl shadow-2xl shadow-black/50 animate-pulse-slow`}>
            {agent.avatar}
          </div>
          <span className="absolute bottom-2 right-2 w-5 h-5 bg-green-500 rounded-full border-4 border-gray-900 animate-pulse" />
        </div>

        <h2 className="text-2xl font-bold mb-2">{agent.name}</h2>
        <p className="text-gray-400 text-sm mb-4">{agent.specialty}</p>

        {/* Status */}
        <div className="flex items-center gap-2 text-green-400 mb-8">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-sm font-medium">Connected</span>
        </div>

        {/* Timer */}
        <div className="text-center mb-6">
          <div className="text-5xl font-mono font-bold text-cyan-400 tracking-wider">
            {minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
          </div>
          <div className="flex items-center justify-center gap-3 mt-3">
            <span className={isFree ? 'text-gray-400' : 'text-amber-400'}>
              ${cost.toFixed(3)} incurred
            </span>
            {isFree && (
              <Badge variant="success">Free</Badge>
            )}
          </div>
        </div>

        {/* Waveform */}
        <Waveform muted={muted} />
      </div>

      {/* Controls */}
      <div className="bg-gray-950/50 backdrop-blur-xl border-t border-gray-800 p-6">
        <div className="flex items-center justify-center gap-6">
          <button
            onClick={() => setMuted(!muted)}
            className={`
              w-14 h-14 rounded-2xl flex items-center justify-center text-xl transition-all
              ${muted 
                ? 'bg-red-500 text-white shadow-lg shadow-red-500/30' 
                : 'bg-gray-800 text-white hover:bg-gray-700'
              }
            `}
          >
            {muted ? '🔇' : '🎤'}
          </button>
          
          <button
            onClick={onEnd}
            className="w-16 h-16 rounded-2xl bg-gradient-to-r from-red-500 to-rose-500 flex items-center justify-center text-xl shadow-xl shadow-red-500/30 hover:scale-105 transition-transform"
          >
            📞
          </button>
          
          <button className="w-14 h-14 rounded-2xl bg-gray-800 flex items-center justify-center text-xl text-gray-400 hover:bg-gray-700 transition-colors">
            💬
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Animated Waveform
 */
function Waveform({ muted }: { muted: boolean }) {
  const [heights, setHeights] = useState<number[]>(Array(50).fill(20));

  useEffect(() => {
    if (muted) {
      setHeights(Array(50).fill(10));
      return;
    }

    const interval = setInterval(() => {
      setHeights(Array(50).fill(0).map(() => 15 + Math.random() * 60));
    }, 80);

    return () => clearInterval(interval);
  }, [muted]);

  return (
    <div className="flex items-center justify-center gap-0.5 h-20 px-12">
      {heights.map((height, i) => (
        <div
          key={i}
          className={`
            w-1.5
            rounded-full
            transition-all
            duration-75
            bg-gradient-to-t
            from-cyan-500 to-blue-500
            ${muted ? 'opacity-30' : 'opacity-80'}
          `}
          style={{ 
            height: `${height}%`,
            animationDelay: `${i * 0.02}s`
          }}
        />
      ))}
    </div>
  );
}

/**
 * Call History Tab
 */
function CallsHistoryTab({ history }: { history: typeof DEMO_CALL_HISTORY }) {
  return (
    <div className="p-4 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Call History</h2>
        <RefreshButton variant="full" onRefresh={async () => {}} />
      </div>
      
      {history.length > 0 ? (
        <div className="space-y-3">
          {history.map(call => (
            <Card key={call.id} variant="default" className="flex items-center gap-4 p-4">
              <Avatar size="md">
                {call.agentName.charAt(0)}
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{call.agentName}</div>
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Clock className="w-4 h-4" />
                  {Math.floor(call.duration / 60)}m {call.duration % 60}s • {call.date}
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-cyan-400">${call.cost.toFixed(2)}</div>
                <div className="flex items-center justify-end gap-0.5 mt-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className={`w-3 h-3 ${i < call.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'}`} />
                  ))}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptySearchState title="No calls yet" description="Your call history will appear here after you make your first call." />
      )}

      {/* Monthly Stats */}
      <Card variant="gradient" className="p-5">
        <div className="text-sm text-gray-400 mb-4">This Month</div>
        <div className="flex justify-between">
          <div>
            <div className="text-3xl font-bold text-white flex items-center gap-2">
              <Clock className="w-6 h-6 text-cyan-400" /> 2h 34m
            </div>
            <div className="text-xs text-gray-500">Total time</div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-cyan-400 flex items-center justify-end gap-2">
              $1.24 <Wallet className="w-6 h-6" />
            </div>
            <div className="text-xs text-gray-500">Total spent</div>
          </div>
        </div>
      </Card>
    </div>
  );
}

/**
 * Profile Tab
 */
function ProfileTab({ balance }: { balance: number }) {
  return (
    <div className="p-4 space-y-6">
      {/* Profile Header */}
      <div className="flex items-center gap-4">
        <Avatar size="xl" online className="bg-gradient-to-br from-cyan-500 to-blue-500">
          <User className="w-8 h-8" />
        </Avatar>
        <div>
          <h2 className="text-xl font-bold">Demo User</h2>
          <div className="text-sm text-gray-400 font-mono">0x1234...5678</div>
        </div>
      </div>

      {/* Balance Card */}
      <Card variant="gradient" className="overflow-hidden">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-blue-500/20" />
          <div className="relative p-6">
            <div className="flex items-center gap-2 text-sm text-white/70 mb-1">
              <Wallet className="w-4 h-4" /> Balance
            </div>
            <div className="text-4xl font-bold text-white mb-4">${balance.toFixed(2)}</div>
            <div className="flex gap-3">
              <Button variant="secondary" size="sm" className="flex-1 bg-white/10 border-white/20 hover:bg-white/20">
                Add Funds
              </Button>
              <Button variant="secondary" size="sm" className="flex-1 bg-white/10 border-white/20 hover:bg-white/20">
                Withdraw
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* ERC-8004 Reputation */}
      <Card variant="default" className="p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center">
            <Star className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-semibold">ERC-8004 Reputation</div>
            <div className="text-xs text-gray-400">Trustless Agent Identity</div>
          </div>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400">Reputation Score</span>
          <span className="font-bold text-violet-400">847</span>
        </div>
        <div className="mt-3 h-2 bg-gray-800 rounded-full overflow-hidden">
          <div className="h-full w-[84%] bg-gradient-to-r from-violet-500 to-purple-500 rounded-full" />
        </div>
      </Card>

      {/* Settings */}
      <div className="space-y-2">
        <h3 className="font-semibold text-gray-400 px-1">Settings</h3>
        {[
          { icon: <Bell className="w-5 h-5" />, label: 'Notifications', desc: 'Call & message alerts' },
          { icon: <Settings className="w-5 h-5" />, label: 'Voice Settings', desc: 'Default voice & language' },
          { icon: <Wallet className="w-5 h-5" />, label: 'Payment Methods', desc: 'Manage wallets & cards' },
          { icon: <Settings className="w-5 h-5" />, label: 'Privacy', desc: 'Data & security' },
          { icon: <Settings className="w-5 h-5" />, label: 'Help & Support', desc: 'FAQ & contact' },
        ].map(item => (
          <Card
            key={item.label}
            interactive
            variant="default"
            className="flex items-center gap-3 p-4"
          >
            <span className="text-gray-400">{item.icon}</span>
            <div className="flex-1 text-left">
              <div className="font-medium">{item.label}</div>
              <div className="text-xs text-gray-500">{item.desc}</div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-500" />
          </Card>
        ))}
      </div>
    </div>
  );
}

/**
 * Payment Modal
 */
function PaymentModal({
  isOpen,
  onClose,
  agent,
  duration,
  cost,
  onPay,
}: {
  isOpen: boolean;
  onClose: () => void;
  agent: typeof DEMO_AGENTS[0] | null;
  duration: number;
  cost: number;
  onPay: () => void;
}) {
  const [processing, setProcessing] = useState(false);

  const handlePay = () => {
    setProcessing(true);
    setTimeout(() => {
      onPay();
    }, 1500);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Payment Summary"
      size="sm"
    >
      {agent && (
        <div className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-xl mb-4">
          <Avatar size="md">{agent.avatar}</Avatar>
          <div className="flex-1">
            <div className="font-medium">{agent.name}</div>
            <div className="text-xs text-gray-400">
              {Math.floor(duration / 60)}m {duration % 60}s call
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2 text-sm">
        <div className="flex justify-between text-gray-400">
          <span>Duration</span>
          <span>{Math.floor(duration / 60)}m {duration % 60}s</span>
        </div>
        <div className="flex justify-between text-green-400">
          <span>First minute</span>
          <span>Free</span>
        </div>
        <div className="flex justify-between text-gray-400">
          <span>Additional time</span>
          <span>${(Math.max(0, duration - 60) * 0.01 / 60).toFixed(3)}</span>
        </div>
        <div className="flex justify-between font-bold text-lg pt-2 border-t border-gray-700">
          <span>Total</span>
          <span className="text-cyan-400">${cost.toFixed(3)}</span>
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <Button variant="secondary" onClick={onClose} className="flex-1">
          Cancel
        </Button>
        <Button 
          onClick={handlePay} 
          isLoading={processing} 
          disabled={cost === 0}
          className="flex-1"
        >
          {cost === 0 ? 'Free Call' : 'Pay Now'}
        </Button>
      </div>

      <p className="text-xs text-center text-gray-500 mt-4">
        Paid via x402 micropayments on Celo
      </p>
    </Modal>
  );
}
