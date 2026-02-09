'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

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

// Categories for filtering
const CATEGORIES = [
  { id: 'all', name: 'All', icon: '🌐' },
  { id: 'language', name: 'Language', icon: '🗣️' },
  { id: 'coding', name: 'Coding', icon: '💻' },
  { id: 'cooking', name: 'Cooking', icon: '🍳' },
  { id: 'travel', name: 'Travel', icon: '✈️' },
  { id: 'general', name: 'General', icon: '💡' },
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

  // Call timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (inCall) {
      interval = setInterval(() => {
        setCallDuration(d => {
          const newDuration = d + 1;
          // Calculate cost after first 60 seconds
          const newCost = Math.max(0, newDuration - 60) * 0.01 / 60;
          setCallCost(newCost);
          return newDuration;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [inCall]);

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
      {/* Header */}
      <header className="sticky top-0 z-50 bg-gray-950/80 backdrop-blur-lg border-b border-gray-800">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🎙️</span>
            <h1 className="font-bold text-lg">Hotline</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs text-gray-400">
              <span className="text-cyan-400 font-semibold">${userBalance.toFixed(2)}</span>
            </div>
            <button className="p-2 hover:bg-gray-800 rounded-full">
              <span className="text-sm">🔔</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-md mx-auto pb-24">
        {inCall ? (
          <CallView
            agent={selectedAgent!}
            duration={callDuration}
            cost={callCost}
            onEnd={endCall}
          />
        ) : activeTab === 'discover' ? (
          <DiscoverTab
            agents={filteredAgents}
            onSelect={setSelectedAgent}
            selectedAgent={selectedAgent}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
          />
        ) : activeTab === 'calls' ? (
          <CallsHistoryTab history={DEMO_CALL_HISTORY} />
        ) : (
          <ProfileTab balance={userBalance} />
        )}
      </main>

      {/* Bottom Navigation */}
      {!inCall && (
        <nav className="fixed bottom-0 left-0 right-0 bg-gray-900/80 backdrop-blur-lg border-t border-gray-800">
          <div className="max-w-md mx-auto flex">
            {[
              { id: 'discover' as Tab, icon: '🔍', label: 'Discover' },
              { id: 'calls' as Tab, icon: '📞', label: 'Calls' },
              { id: 'profile' as Tab, icon: '👤', label: 'Profile' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-3 flex flex-col items-center gap-1 transition-colors ${
                  activeTab === tab.id 
                    ? 'text-cyan-400' 
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <span className="text-lg">{tab.icon}</span>
                <span className="text-xs">{tab.label}</span>
              </button>
            ))}
          </div>
        </nav>
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <PaymentModal
          agent={selectedAgent}
          duration={callDuration}
          cost={callCost}
          onClose={() => setShowPaymentModal(false)}
          onPay={() => {
            setUserBalance(prev => prev - callCost);
            setShowPaymentModal(false);
          }}
        />
      )}
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
}: {
  agents: typeof DEMO_AGENTS;
  onSelect: (a: typeof DEMO_AGENTS[0]) => void;
  selectedAgent: typeof DEMO_AGENTS[0] | null;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedCategory: string;
  onCategoryChange: (c: string) => void;
}) {
  return (
    <div className="p-4 space-y-4">
      {/* Search */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search agents..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="input-primary pl-10"
        />
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">🔍</span>
      </div>

      {/* Categories */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => onCategoryChange(cat.id)}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all ${
              selectedCategory === cat.id
                ? 'bg-cyan-500 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            {cat.icon} {cat.name}
          </button>
        ))}
      </div>

      {/* Featured Agents */}
      <div>
        <h2 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
          <span>⭐</span> Featured
        </h2>
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {agents.filter(a => a.online).map(agent => (
            <FeaturedCard
              key={agent.id}
              agent={agent}
              onClick={() => onSelect(agent)}
              selected={selectedAgent?.id === agent.id}
            />
          ))}
        </div>
      </div>

      {/* All Agents */}
      <div>
        <h2 className="text-sm font-semibold text-gray-400 mb-3">
          {selectedCategory === 'all' ? 'All Agents' : CATEGORIES.find(c => c.id === selectedCategory)?.name}
        </h2>
        <div className="space-y-2">
          {agents.map(agent => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onClick={() => onSelect(agent)}
              selected={selectedAgent?.id === agent.id}
            />
          ))}
        </div>
      </div>

      {/* Agent Detail Panel */}
      {selectedAgent && (
        <AgentDetailPanel
          agent={selectedAgent}
          onClose={() => onSelect(null as any)}
        />
      )}
    </div>
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
      className={`flex-shrink-0 w-36 bg-gradient-to-br ${agent.color} rounded-2xl p-4 text-left transition-transform hover:scale-105 ${
        selected ? 'ring-2 ring-cyan-400' : ''
      }`}
    >
      <div className="text-3xl mb-2">{agent.avatar}</div>
      <div className="font-bold text-sm truncate">{agent.name}</div>
      <div className="text-xs opacity-80 truncate">{agent.specialty}</div>
      <div className="flex items-center gap-2 mt-2 text-xs">
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
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 bg-gray-900/50 rounded-xl p-3 border transition-all ${
        selected
          ? 'border-cyan-500 bg-gray-900/80'
          : 'border-gray-800 hover:border-gray-700'
      }`}
    >
      <div className="relative">
        <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center text-xl">
          {agent.avatar}
        </div>
        <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-gray-900 ${
          agent.online ? 'bg-green-500' : 'bg-gray-500'
        }`} />
      </div>
      
      <div className="flex-1 text-left">
        <div className="font-semibold">{agent.name}</div>
        <div className="text-sm text-gray-400 truncate">{agent.bio}</div>
        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
          <span>⭐ {agent.rating}</span>
          <span>{agent.totalRatings} reviews</span>
        </div>
      </div>

      <div className="text-right">
        <div className="text-cyan-400 font-bold">${agent.rate}</div>
        <div className="text-xs text-gray-500">/min</div>
        <div className={`text-xs mt-1 ${agent.online ? 'text-green-500' : 'text-gray-500'}`}>
          {agent.online ? 'Available' : 'Offline'}
        </div>
      </div>
    </button>
  );
}

/**
 * Agent Detail Panel
 */
function AgentDetailPanel({
  agent,
  onClose,
}: {
  agent: typeof DEMO_AGENTS[0];
  onClose: () => void;
}) {
  const [calling, setCalling] = useState(false);

  const handleCall = () => {
    setCalling(true);
    setTimeout(() => {
      // Navigate to call
      window.location.href = `?agent=${agent.id}`;
    }, 1500);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-gray-900 rounded-3xl border border-gray-800 w-full max-w-md overflow-hidden">
        {/* Header gradient */}
        <div className={`bg-gradient-to-br ${agent.color} p-6 text-center`}>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/20 flex items-center justify-center text-white"
          >
            ✕
          </button>
          
          <div className="w-24 h-24 mx-auto rounded-full bg-white/20 flex items-center justify-center text-5xl mb-4">
            {agent.avatar}
          </div>
          <h2 className="text-xl font-bold">{agent.name}</h2>
          <p className="opacity-80">{agent.specialty}</p>
          
          <div className="flex items-center justify-center gap-4 mt-4">
            <div className="text-center">
              <div className="font-bold flex items-center justify-center gap-1">
                ⭐ {agent.rating}
              </div>
              <div className="text-xs opacity-70">{agent.totalRatings} reviews</div>
            </div>
            <div className="text-center">
              <div className="font-bold">${agent.rate}</div>
              <div className="text-xs opacity-70">/minute</div>
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="p-4 space-y-4">
          <div>
            <h3 className="font-semibold mb-2 text-sm text-gray-400">About</h3>
            <p className="text-sm text-gray-300">{agent.bio}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {agent.tags.map(tag => (
              <span key={tag} className="badge-info">
                {tag}
              </span>
            ))}
          </div>

          <button
            onClick={handleCall}
            disabled={!agent.online || calling}
            className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
              agent.online && !calling
                ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
          >
            {calling ? 'Connecting...' : agent.online ? '🎙️ Call Now' : 'Offline'}
          </button>

          <p className="text-xs text-center text-gray-500">
            First minute free • x402 micropayments on Celo
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Call View with waveform
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
  const waveformRef = useRef<HTMLDivElement>(null);

  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;
  const freeMinutesUsed = Math.min(duration, 60);

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800 p-6">
        {/* Agent Avatar with pulse */}
        <div className="relative mb-6">
          <div className={`w-32 h-32 rounded-full bg-gradient-to-br ${agent.color} flex items-center justify-center text-6xl animate-pulse`}>
            {agent.avatar}
          </div>
          <span className="absolute bottom-2 right-2 w-4 h-4 bg-green-500 rounded-full border-2 border-gray-800 animate-pulse" />
        </div>

        <h2 className="text-xl font-bold">{agent.name}</h2>
        <p className="text-gray-400 text-sm">{agent.specialty}</p>

        {/* Call Status */}
        <div className="mt-6 flex items-center gap-2 text-green-400">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-sm">Connected</span>
        </div>

        {/* Timer & Cost */}
        <div className="mt-8 text-center">
          <div className="text-4xl font-mono font-bold text-cyan-400">
            {minutes}:{seconds.toString().padStart(2, '0')}
          </div>
          <div className="flex items-center justify-center gap-4 mt-2 text-sm">
            <span className={duration > 60 ? 'text-amber-400' : 'text-gray-400'}>
              ${cost.toFixed(3)} incurred
            </span>
            {duration <= 60 && (
              <span className="text-green-400">Free</span>
            )}
          </div>
        </div>

        {/* Waveform visualization */}
        <Waveform muted={muted} />
      </div>

      {/* Controls */}
      <div className="bg-gray-950 p-6">
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => setMuted(!muted)}
            className={`w-14 h-14 rounded-full flex items-center justify-center text-xl transition-colors ${
              muted ? 'bg-red-500 text-white' : 'bg-gray-800 text-white hover:bg-gray-700'
            }`}
          >
            {muted ? '🔇' : '🎤'}
          </button>
          
          <button
            onClick={onEnd}
            className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center text-xl shadow-lg shadow-red-500/30 hover:bg-red-400 transition-colors"
          >
            📞
          </button>
          
          <button className="w-14 h-14 rounded-full bg-gray-800 flex items-center justify-center text-xl hover:bg-gray-700 transition-colors">
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
  const [heights, setHeights] = useState<number[]>(Array(40).fill(20));

  useEffect(() => {
    if (muted) {
      setHeights(Array(40).fill(10));
      return;
    }

    const interval = setInterval(() => {
      setHeights(Array(40).fill(0).map(() => 15 + Math.random() * 60));
    }, 100);

    return () => clearInterval(interval);
  }, [muted]);

  return (
    <div className="mt-8 flex items-center justify-center gap-0.5 h-16 px-8">
      {heights.map((height, i) => (
        <div
          key={i}
          className="w-1 bg-cyan-500 rounded-full transition-all duration-75"
          style={{ height: `${height}%`, opacity: muted ? 0.3 : 0.8 }}
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
    <div className="p-4">
      <h2 className="text-lg font-bold mb-4">Call History</h2>
      
      <div className="space-y-3">
        {history.map(call => (
          <div key={call.id} className="card flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center">
              📞
            </div>
            <div className="flex-1">
              <div className="font-semibold">{call.agentName}</div>
              <div className="text-sm text-gray-400">
                {call.duration}s • {call.date}
              </div>
            </div>
            <div className="text-right">
              <div className="font-bold text-cyan-400">${call.cost.toFixed(2)}</div>
              <div className="flex items-center gap-1 text-xs text-yellow-400">
                {'⭐'.repeat(call.rating)}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-gray-900/50 rounded-xl">
        <div className="text-sm text-gray-400 mb-2">This Month</div>
        <div className="flex justify-between">
          <div>
            <div className="text-2xl font-bold">2h 34m</div>
            <div className="text-xs text-gray-500">Total time</div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-cyan-400">$1.24</div>
            <div className="text-xs text-gray-500">Total spent</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Profile Tab
 */
function ProfileTab({ balance }: { balance: number }) {
  return (
    <div className="p-4">
      {/* Profile Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-2xl">
          👤
        </div>
        <div>
          <h2 className="text-xl font-bold">Demo User</h2>
          <div className="text-sm text-gray-400">0x1234...5678</div>
        </div>
      </div>

      {/* Balance Card */}
      <div className="bg-gradient-to-br from-cyan-500 to-blue-500 rounded-2xl p-6 mb-6">
        <div className="text-sm opacity-80 mb-1">Balance</div>
        <div className="text-4xl font-bold">${balance.toFixed(2)}</div>
        <div className="flex gap-2 mt-4">
          <button className="flex-1 py-2 bg-white/20 rounded-lg text-sm font-medium hover:bg-white/30 transition-colors">
            Add Funds
          </button>
          <button className="flex-1 py-2 bg-white/20 rounded-lg text-sm font-medium hover:bg-white/30 transition-colors">
            Withdraw
          </button>
        </div>
      </div>

      {/* Settings */}
      <div className="space-y-2">
        <h3 className="font-semibold text-gray-400 mb-3">Settings</h3>
        {[
          { icon: '🔔', label: 'Notifications', desc: 'Call & message alerts' },
          { icon: '🎤', label: 'Voice Settings', desc: 'Default voice & language' },
          { icon: '💳', label: 'Payment Methods', desc: 'Manage wallets & cards' },
          { icon: '🔒', label: 'Privacy', desc: 'Data & security' },
          { icon: '❓', label: 'Help & Support', desc: 'FAQ & contact' },
        ].map(item => (
          <button key={item.label} className="w-full flex items-center gap-3 p-3 bg-gray-900/50 rounded-xl hover:bg-gray-900 transition-colors">
            <span className="text-lg">{item.icon}</span>
            <div className="flex-1 text-left">
              <div className="font-medium">{item.label}</div>
              <div className="text-xs text-gray-500">{item.desc}</div>
            </div>
            <span className="text-gray-500">›</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Payment Modal
 */
function PaymentModal({
  agent,
  duration,
  cost,
  onClose,
  onPay,
}: {
  agent: typeof DEMO_AGENTS[0] | null;
  duration: number;
  cost: number;
  onClose: () => void;
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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">💰</div>
          <h2 className="text-xl font-bold">Payment Summary</h2>
        </div>

        {agent && (
          <div className="flex items-center gap-3 p-3 bg-gray-800 rounded-xl mb-4">
            <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
              {agent.avatar}
            </div>
            <div className="flex-1">
              <div className="font-medium">{agent.name}</div>
              <div className="text-xs text-gray-400">{duration}s call</div>
            </div>
          </div>
        )}

        <div className="space-y-2 mb-6">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Duration</span>
            <span>{Math.floor(duration / 60)}m {duration % 60}s</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">First minute</span>
            <span className="text-green-400">Free</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Additional time</span>
            <span>${(Math.max(0, duration - 60) * 0.01 / 60).toFixed(3)}</span>
          </div>
          <div className="border-t border-gray-700 pt-2 flex justify-between font-bold">
            <span>Total</span>
            <span className="text-cyan-400">${cost.toFixed(3)}</span>
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">
            Cancel
          </button>
          <button
            onClick={handlePay}
            disabled={processing || cost === 0}
            className={`btn-primary flex-1 ${processing ? 'opacity-50' : ''}`}
          >
            {processing ? 'Processing...' : cost === 0 ? 'Free Call' : 'Pay Now'}
          </button>
        </div>

        <p className="text-xs text-center text-gray-500 mt-4">
          Paid via x402 micropayments on Celo
        </p>
      </div>
    </div>
  );
}
