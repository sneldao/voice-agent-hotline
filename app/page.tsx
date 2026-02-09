'use client';

import { useState, useEffect } from 'react';

// Demo agents data
const DEMO_AGENTS = [
  {
    id: 'maria',
    name: 'Maria Garcia',
    specialty: 'Spanish Tutor',
    bio: 'Native speaker, 5 years teaching',
    rating: 4.9,
    calls: 2347,
    rate: 0.01,
    avatar: '👩‍🏫',
    color: 'from-rose-500 to-pink-500',
    online: true,
  },
  {
    id: 'alex',
    name: 'Alex Chen',
    specialty: 'Coding Help',
    bio: 'Full-stack developer, debugging expert',
    rating: 4.8,
    calls: 1823,
    rate: 0.03,
    avatar: '👨‍💻',
    color: 'from-cyan-500 to-blue-500',
    online: true,
  },
  {
    id: 'chef',
    name: 'Chef Mario',
    specialty: 'Cooking',
    bio: 'Italian cuisine expert',
    rating: 4.7,
    calls: 1456,
    rate: 0.01,
    avatar: '👨‍🍳',
    color: 'from-amber-500 to-orange-500',
    online: false,
  },
];

export default function Home() {
  const [activeTab, setActiveTab] = useState<'discover' | 'calls' | 'profile'>('discover');
  const [selectedAgent, setSelectedAgent] = useState<typeof DEMO_AGENTS[0] | null>(null);
  const [inCall, setInCall] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  // Simulate call timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (inCall) {
      interval = setInterval(() => {
        setCallDuration(d => d + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [inCall]);

  const startCall = () => {
    if (selectedAgent) {
      setInCall(true);
      setCallDuration(0);
    }
  };

  const endCall = () => {
    setInCall(false);
    setSelectedAgent(null);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-gray-950/80 backdrop-blur-lg border-b border-gray-800">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🎙️</span>
            <h1 className="font-bold text-lg">Hotline</h1>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span>First minute free</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-md mx-auto pb-20">
        {inCall ? (
          /* In-Call View */
          <CallView
            agent={selectedAgent!}
            duration={callDuration}
            onEnd={endCall}
          />
        ) : selectedAgent ? (
          /* Agent Detail */
          <AgentDetail
            agent={selectedAgent}
            onBack={() => setSelectedAgent(null)}
            onCall={startCall}
          />
        ) : (
          /* Agent List */
          <AgentList
            agents={DEMO_AGENTS}
            onSelect={setSelectedAgent}
          />
        )}
      </main>

      {/* Bottom Navigation */}
      {!selectedAgent && !inCall && (
        <nav className="fixed bottom-0 left-0 right-0 bg-gray-900/80 backdrop-blur-lg border-t border-gray-800">
          <div className="max-w-md mx-auto flex">
            {[
              { id: 'discover', icon: '🔍', label: 'Discover' },
              { id: 'calls', icon: '📞', label: 'Calls' },
              { id: 'profile', icon: '👤', label: 'Profile' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 py-3 flex flex-col items-center gap-1 ${
                  activeTab === tab.id ? 'text-cyan-400' : 'text-gray-500'
                }`}
              >
                <span className="text-lg">{tab.icon}</span>
                <span className="text-xs">{tab.label}</span>
              </button>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}

/**
 * Agent List Component
 */
function AgentList({ agents, onSelect }: {
  agents: typeof DEMO_AGENTS;
  onSelect: (a: typeof DEMO_AGENTS[0]) => void;
}) {
  return (
    <div className="p-4 space-y-3">
      {/* Search */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search for help..."
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 pl-10 text-sm focus:outline-none focus:border-cyan-500"
        />
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">🔍</span>
      </div>

      {/* Categories */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {['All', '🌐 Language', '💻 Code', '🍳 Cook', '✈️ Travel', '📚 Study'].map(cat => (
          <button
            key={cat}
            className={`px-4 py-2 rounded-full text-sm whitespace-nowrap ${
              cat === 'All' ? 'bg-cyan-500 text-white' : 'bg-gray-800 text-gray-300'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Featured */}
      <div className="pt-2">
        <h2 className="text-sm font-semibold text-gray-400 mb-3">Featured</h2>
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {agents.filter(a => a.online).map(agent => (
            <FeaturedCard key={agent.id} agent={agent} onClick={() => onSelect(agent)} />
          ))}
        </div>
      </div>

      {/* All Agents */}
      <div className="pt-4">
        <h2 className="text-sm font-semibold text-gray-400 mb-3">Available Now</h2>
        <div className="space-y-2">
          {agents.map(agent => (
            <AgentCard key={agent.id} agent={agent} onClick={() => onSelect(agent)} />
          ))}
        </div>
      </div>
    </div>
  );
}


/**
 * Featured Card
 */
function FeaturedCard({ agent, onClick }: {
  agent: typeof DEMO_AGENTS[0];
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 w-36 bg-gradient-to-br ${agent.color} rounded-2xl p-4 text-left`}
    >
      <div className="text-3xl mb-2">{agent.avatar}</div>
      <div className="font-bold text-sm">{agent.name}</div>
      <div className="text-xs opacity-80">{agent.specialty}</div>
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
function AgentCard({ agent, onClick }: {
  agent: typeof DEMO_AGENTS[0];
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 bg-gray-900/50 rounded-xl p-3 border border-gray-800 hover:border-gray-700 transition-colors"
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
        <div className="text-sm text-gray-400">{agent.bio}</div>
        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
          <span>⭐ {agent.rating}</span>
          <span>{agent.calls.toLocaleString()} calls</span>
        </div>
      </div>

      <div className="text-right">
        <div className="text-cyan-400 font-bold">${agent.rate}</div>
        <div className="text-xs text-gray-500">/min</div>
        {agent.online && (
          <div className="text-xs text-green-500 mt-1">Available</div>
        )}
      </div>
    </button>
  );
}


/**
 * Agent Detail
 */
function AgentDetail({ agent, onBack, onCall }: {
  agent: typeof DEMO_AGENTS[0];
  onBack: () => void;
  onCall: () => void;
}) {
  return (
    <div className="p-4">
      {/* Header */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-gray-400 mb-4"
      >
        ← Back
      </button>

      {/* Profile */}
      <div className={`bg-gradient-to-br ${agent.color} rounded-3xl p-6 text-center mb-6`}>
        <div className="w-24 h-24 mx-auto rounded-full bg-white/20 flex items-center justify-center text-5xl mb-4">
          {agent.avatar}
        </div>
        <h2 className="text-xl font-bold">{agent.name}</h2>
        <p className="opacity-80">{agent.specialty}</p>
        
        <div className="flex items-center justify-center gap-4 mt-4">
          <div className="text-center">
            <div className="font-bold">⭐ {agent.rating}</div>
            <div className="text-xs opacity-70">Rating</div>
          </div>
          <div className="text-center">
            <div className="font-bold">{agent.calls.toLocaleString()}</div>
            <div className="text-xs opacity-70">Calls</div>
          </div>
        </div>
      </div>

      {/* Bio */}
      <div className="bg-gray-900/50 rounded-xl p-4 mb-6">
        <h3 className="font-semibold mb-2">About</h3>
        <p className="text-sm text-gray-400">{agent.bio}</p>
      </div>

      {/* Pricing */}
      <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-cyan-400 font-bold text-lg">${agent.rate}/minute</div>
            <div className="text-xs text-gray-400">First minute free</div>
          </div>
          <button
            onClick={onCall}
            disabled={!agent.online}
            className={`px-6 py-3 rounded-xl font-bold ${
              agent.online
                ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white'
                : 'bg-gray-700 text-gray-500'
            }`}
          >
            {agent.online ? '🎙️ Call Now' : 'Offline'}
          </button>
        </div>
      </div>

      {/* Reviews */}
      <div>
        <h3 className="font-semibold mb-3">Recent Reviews</h3>
        <div className="space-y-2">
          {[
            { name: 'John D.', rating: 5, text: 'Amazing Spanish practice!' },
            { name: 'Sarah M.', rating: 5, text: 'Very patient teacher' },
            { name: 'Mike R.', rating: 4, text: 'Great conversation' },
          ].map((review, i) => (
            <div key={i} className="bg-gray-900/30 rounded-lg p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-sm">{review.name}</span>
                <span className="text-yellow-400">{'⭐'.repeat(review.rating)}</span>
              </div>
              <p className="text-xs text-gray-400">{review.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


/**
 * In-Call View
 */
function CallView({ agent, duration, onEnd }: {
  agent: typeof DEMO_AGENTS[0];
  duration: number;
  onEnd: () => void;
}) {
  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;
  const cost = Math.max(0, duration - 60) * agent.rate / 60;

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
        <div className="text-center">
          <div className="w-32 h-32 mx-auto rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-6xl mb-6 animate-pulse">
            {agent.avatar}
          </div>
          <h2 className="text-xl font-bold">{agent.name}</h2>
          <p className="text-gray-400 text-sm">{agent.specialty}</p>
          
          {/* Timer */}
          <div className="mt-8">
            <div className="text-4xl font-mono font-bold text-cyan-400">
              {minutes}:{seconds.toString().padStart(2, '0')}
            </div>
            <div className="text-sm text-gray-400 mt-2">
              ${cost.toFixed(2)} incurred
            </div>
          </div>
        </div>
      </div>

      {/* Waveform (visual) */}
      <div className="px-8 py-4 bg-gray-900">
        <div className="flex items-center justify-center gap-1 h-12">
          {Array.from({ length: 40 }).map((_, i) => (
            <div
              key={i}
              className="w-1 bg-cyan-500 rounded-full animate-pulse"
              style={{
                height: `${20 + Math.random() * 60}%`,
                animationDelay: `${i * 50}ms`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="bg-gray-950 p-6">
        <div className="flex items-center justify-center gap-4">
          <button className="w-14 h-14 rounded-full bg-gray-800 flex items-center justify-center text-xl">
            🔇
          </button>
          <button
            onClick={onEnd}
            className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center text-xl shadow-lg shadow-red-500/30"
          >
            📞
          </button>
          <button className="w-14 h-14 rounded-full bg-gray-800 flex items-center justify-center text-xl">
            💬
          </button>
        </div>
      </div>
    </div>
  );
}
