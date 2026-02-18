'use client';

import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import React from 'react';
import { Button, Card, Badge, Avatar, Modal, Tabs, EmptySearchState, EmptyHistoryState, PullToRefresh, RefreshButton, ToastProvider, showSuccess, showError, showWarning, Wallet, Search, Phone, User, Star, Clock, Settings, Bell, ChevronRight, Loader2, AlertCircle, Sparkles, Bookmark, Download, Share2, X } from '@/components/ui';
import { ArrowRight } from 'lucide-react';
import { announce } from '@/lib/accessibility';
import { useWallet } from '@/lib/WalletContext';
import { ReferralSection } from '@/components/ReferralSection';
import { useRealAgents, useCallHistory as useServerCallHistory } from '@/lib/useRealAgents';
import { useLocalCallHistory, CallRecord } from '@/lib/useCallHistory';
import { useRealVoiceCall, useWebRTCSupport } from '@/lib/useRealVoiceCall';
import { useOnboarding } from '@/lib/useOnboarding';
import { ActiveCall } from '@/components/ActiveCall';
import { Onboarding } from '@/components/Onboarding';
import { SmartAgentFinder } from '@/components/SmartAgentFinder';
import { ShareModal } from '@/components/ShareModal';
import { ExportModal } from '@/components/ExportModal';

const CATEGORIES = [
  { id: 'all', name: 'All', icon: '🌐' },
  { id: 'blockchain', name: 'Blockchain', icon: '🪙' },
  { id: 'tech', name: 'Tech', icon: '💻' },
  { id: 'gaming', name: 'Gaming', icon: '🎮' },
  { id: 'general', name: 'General', icon: '🤖' },
];

type Tab = 'discover' | 'calls' | 'profile';

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('discover');
  const [selectedAgent, setSelectedAgent] = useState<any>(null);
  const [inCall, setInCall] = useState(false);
  const [callId, setCallId] = useState<string | null>(null);
  const [showSmartFinder, setShowSmartFinder] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [userBalance, setUserBalance] = useState(0);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const mainContentRef = useRef<HTMLElement>(null);

  // Get wallet connection state
  const { connected, address, isConnecting, connect, formatAddress } = useWallet();

  // Real data hooks
  const { agents, isLoading: isLoadingAgents, error: agentsError, refetch: refetchAgents } = useRealAgents();
  const { history: serverCallHistory, isLoading: isLoadingHistory, error: historyError, refetch: refetchHistory } = useServerCallHistory(address || undefined);
  const localCallHistory = useLocalCallHistory();
  const { startCall: startVoiceCall, endCall: endVoiceCall } = useRealVoiceCall(selectedAgent?.rate);
  const { isSupported: isWebRTCSupported, permissions: micPermissions, requestMicrophonePermission } = useWebRTCSupport();
  
  // Onboarding
  const onboarding = useOnboarding(connected, userBalance);

  // Load user balance when connected - with cleanup to prevent memory leaks
  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout | null = null;
    
    if (connected && address) {
      setIsLoadingBalance(true);
      
      // Debounce balance fetch to prevent rapid requests
      timeoutId = setTimeout(() => {
        fetch(`/api/users/${address}`)
          .then(res => res.json())
          .then(data => {
            if (isMounted) {
              setUserBalance(data.balance || 0);
            }
          })
          .catch(() => {
            if (isMounted) {
              setUserBalance(0);
            }
          })
          .finally(() => {
            if (isMounted) {
              setIsLoadingBalance(false);
            }
          });
      }, 300); // 300ms debounce
    } else {
      setUserBalance(0);
      setIsLoadingBalance(false);
    }
    
    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [connected, address]);

  // Keyboard navigation for accessibility
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape closes modals and call view
      if (e.key === 'Escape') {
        if (inCall) {
          endCall();
          announce('Call ended');
        } else if (selectedAgent) {
          setSelectedAgent(null);
          announce('Agent details closed');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inCall, selectedAgent]);

  // Focus management when modals open/close
  useEffect(() => {
    if (selectedAgent) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }, [selectedAgent]);

  const startCall = useCallback(async () => {
    if (!selectedAgent) return;
    
    // Check WebRTC support
    if (!isWebRTCSupported) {
      showError('WebRTC is not supported in your browser');
      return;
    }

    // Check microphone permission
    if (micPermissions.microphone === 'denied') {
      showError('Microphone access is required for voice calls');
      return;
    }

    if (micPermissions.microphone === 'prompt') {
      const granted = await requestMicrophonePermission();
      if (!granted) {
        showError('Microphone permission is required');
        return;
      }
    }

    // Check wallet connection
    if (!connected) {
      showError('Please connect your wallet first');
      return;
    }

    // Check balance
    if (userBalance < selectedAgent.rate * 5) { // At least 5 minutes
      showError('Insufficient balance. Please add funds.');
      return;
    }

    const newCallId = `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setCallId(newCallId);
    setInCall(true);
    
    // Start voice call
    const success = await startVoiceCall({
      agentId: selectedAgent.id,
      callId: newCallId,
      userId: address!,
    });

    if (!success) {
      showError('Failed to start call. Please try again.');
      setInCall(false);
      setCallId(null);
    }
  }, [selectedAgent, isWebRTCSupported, micPermissions, connected, userBalance, address, startVoiceCall]);

  const endCall = useCallback(async () => {
    endVoiceCall();
    setInCall(false);
    setSelectedAgent(null);
    setCallId(null);
    refetchHistory();
  }, [endVoiceCall, refetchHistory]);

  const handleSelectRelatedAgent = useCallback((agentId: string) => {
    const agent = agents.find(a => a.id === agentId);
    if (agent) {
      setSelectedAgent(agent);
    }
  }, [agents]);

  // Memoize filtered agents to prevent unnecessary recalculations
  const filteredAgents = useMemo(() => {
    return agents.filter(agent => {
      const matchesSearch = agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        agent.specialty.toLowerCase().includes(searchQuery.toLowerCase()) ||
        agent.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory = selectedCategory === 'all' ||
        agent.category === selectedCategory ||
        agent.tags.some(t => t.toLowerCase().includes(selectedCategory.toLowerCase()));
      return matchesSearch && matchesCategory;
    });
  }, [agents, searchQuery, selectedCategory]);

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans">
      <ToastProvider />
      
      {/* Onboarding — onConnect lets the WalletConnectStep trigger connect inline */}
      <Onboarding
        isOpen={onboarding.isOpen}
        currentStep={onboarding.currentStep}
        walletConnected={connected}
        walletBalance={userBalance}
        onClose={onboarding.closeOnboarding}
        onNext={onboarding.nextStep}
        onSkip={onboarding.skipOnboarding}
        onConnect={connect}
      />
      
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
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-lg">Voice Hotline</h1>
                <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 text-[10px] font-bold text-white">
                  💰 REAL-WORLD PAYMENTS
                </span>
              </div>
              <p className="text-xs text-gray-500">AI-Powered Voice Agents</p>
            </div>
          </div>
          <div className="flex items-center gap-2" role="group" aria-label="User wallet and notifications">
            {connected ? (
              <div className="px-3 py-1.5 rounded-full bg-gray-800/50 border border-gray-700/50 flex items-center gap-2">
                <Wallet className="w-4 h-4 text-cyan-400" />
                <span className="text-sm font-medium text-cyan-400">${userBalance.toFixed(2)}</span>
                <span className="text-xs text-gray-500">{formatAddress()}</span>
              </div>
            ) : (
              <button
                onClick={connect}
                disabled={isConnecting}
                className="px-4 py-1.5 rounded-full bg-cyan-500 text-white text-sm font-medium hover:bg-cyan-400 transition-colors disabled:opacity-50"
              >
                {isConnecting ? 'Connecting...' : 'Connect Wallet'}
              </button>
            )}
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
        {inCall && selectedAgent && callId ? (
          <ActiveCall
            agent={{
              id: selectedAgent.id,
              name: selectedAgent.name,
              specialty: selectedAgent.specialty,
              avatar: selectedAgent.avatar,
              rate: selectedAgent.rate,
              color: selectedAgent.color,
            }}
            callId={callId}
            userId={address || 'anonymous'}
            onEnd={endCall}
            onSelectRelatedAgent={handleSelectRelatedAgent}
          />
        ) : (
          <>
            {activeTab === 'discover' && (
              <DiscoverTab
                agents={filteredAgents}
                isLoading={isLoadingAgents}
                error={agentsError}
                onSelect={setSelectedAgent}
                selectedAgent={selectedAgent}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                selectedCategory={selectedCategory}
                onCategoryChange={setSelectedCategory}
                onCall={startCall}
                onRefresh={refetchAgents}
                showSmartFinder={showSmartFinder}
                onToggleSmartFinder={() => setShowSmartFinder(!showSmartFinder)}
              />
            )}
            {activeTab === 'calls' && (
              <CallsHistoryTab 
                localHistory={localCallHistory}
                serverHistory={serverCallHistory}
                isLoading={isLoadingHistory}
                error={historyError}
                onRefresh={refetchHistory}
                agents={agents}
                onSelectAgent={setSelectedAgent}
              />
            )}
            {activeTab === 'profile' && (
              <ProfileTab 
                balance={userBalance}
                address={address}
                isLoading={isLoadingBalance}
              />
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
    </div>
  );
}

/**
 * Discover Tab
 */
function DiscoverTab({
  agents,
  isLoading,
  error,
  onSelect,
  selectedAgent,
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  onCall,
  onRefresh,
  showSmartFinder,
  onToggleSmartFinder,
}: {
  agents: any[];
  isLoading: boolean;
  error: string | null;
  onSelect: (a: any) => void;
  selectedAgent: any | null;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedCategory: string;
  onCategoryChange: (c: string) => void;
  onCall: () => void;
  onRefresh: () => Promise<void>;
  showSmartFinder: boolean;
  onToggleSmartFinder: () => void;
}) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await onRefresh();
    setIsRefreshing(false);
    showSuccess('Agents refreshed');
  }, [onRefresh]);

  const hasSearchQuery = searchQuery.trim().length > 0;
  const hasNoResults = agents.length === 0 && !hasSearchQuery && !isLoading;
  const hasNoSearchResults = agents.length === 0 && hasSearchQuery && !isLoading;

  if (isLoading) {
    return (
      <div className="p-4 flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500 mb-4" />
        <p className="text-gray-400">Loading agents...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 flex flex-col items-center justify-center min-h-[50vh]">
        <AlertCircle className="w-8 h-8 text-red-500 mb-4" />
        <p className="text-red-400 text-center mb-4">{error}</p>
        <button
          onClick={handleRefresh}
          className="px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-400 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="p-4 space-y-5">
        {/* Smart Agent Finder - Inline */}
        {showSmartFinder ? (
          <SmartAgentFinder
            availableAgents={agents.map(a => a.id)}
            onSelectAgent={(agentId) => {
              const agent = agents.find(a => a.id === agentId);
              if (agent) {
                onSelect(agent);
              }
            }}
            onMinimize={onToggleSmartFinder}
          />
        ) : (
          <button
            onClick={onToggleSmartFinder}
            className="w-full p-4 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/30 rounded-xl text-left hover:border-cyan-500/50 transition-all group flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-white group-hover:text-cyan-400 transition-colors">
                Smart Agent Finder
              </p>
              <p className="text-sm text-gray-400">
                AI-powered agent matching
              </p>
            </div>
            <ArrowRight className="w-5 h-5 text-gray-600 group-hover:text-cyan-400 transition-colors" />
          </button>
        )}

        {/* Search with refresh */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Or search agents manually..."
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
 * Featured Card - Memoized for performance
 */
const FeaturedCard = React.memo(function FeaturedCard({
  agent,
  onClick,
  selected,
}: {
  agent: any;
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
});

/**
 * Agent Card - Enhanced with visual ratings, Memoized for performance
 */
const AgentCard = React.memo(function AgentCard({
  agent,
  onClick,
  selected,
}: {
  agent: any;
  onClick: () => void;
  selected: boolean;
}) {
  const rating = agent.rating || 0;
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;

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
          {agent.verified && (
            <Badge variant="info" size="sm">✓ Verified</Badge>
          )}
        </div>
        <p className="text-sm text-gray-400 truncate">{agent.bio || agent.specialty}</p>

        {/* Visual Star Rating */}
        <div className="flex items-center gap-2 mt-2">
          <div className="flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={`w-3 h-3 ${
                  i < fullStars
                    ? 'text-yellow-400 fill-yellow-400'
                    : i === fullStars && hasHalfStar
                    ? 'text-yellow-400 fill-yellow-400/50'
                    : 'text-gray-600'
                }`}
              />
            ))}
          </div>
          <span className="text-xs text-gray-400">
            {rating.toFixed(1)} ({agent.totalRatings || 0})
          </span>
        </div>

        {/* Additional Stats */}
        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
          {agent.totalCalls && (
            <span>{agent.totalCalls} calls</span>
          )}
          {agent.category && (
            <Badge variant="default" size="sm">{agent.category}</Badge>
          )}
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
});

/**
 * Agent Detail Modal — with live cost estimator
 */
function AgentDetailModal({
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
    setTimeout(() => {
      onCall();
    }, 1200);
  };

  return (
    <Modal isOpen={!!agent} onClose={onClose} size="md">
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
              <span>⭐</span> {agent.rating?.toFixed(1) ?? '—'}
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

      {/* Content */}
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-400 mb-2">About</h3>
          <p className="text-sm text-gray-300">{agent.bio}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {(agent.tags ?? []).map((tag: string) => (
            <Badge key={tag} variant="info">{tag}</Badge>
          ))}
        </div>

        {/* Cost Estimator */}
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-400">Estimated cost</span>
            <span className="text-lg font-bold text-cyan-400">${estimatedCost}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 w-6">{estimatedMins}m</span>
            <input
              type="range"
              min={1}
              max={30}
              value={estimatedMins}
              onChange={e => setEstimatedMins(Number(e.target.value))}
              className="flex-1 h-1.5 rounded-full accent-cyan-500 cursor-pointer"
            />
            <span className="text-xs text-gray-500 w-8">30m</span>
          </div>
          <p className="text-xs text-gray-600 mt-2 text-center">
            Drag to estimate • Pay only for actual seconds used
          </p>
        </div>

        <Button
          onClick={handleCall}
          disabled={!agent.online || calling}
          isLoading={calling}
          className="w-full"
          size="lg"
        >
          {calling ? 'Connecting…' : agent.online ? '🎙️ Start Call' : '⛔ Agent Offline'}
        </Button>

        <p className="text-xs text-center text-gray-500">
          Billed per second via x402 on Celo • Cancel anytime
        </p>
      </div>
    </Modal>
  );
}

/**
 * Call History Tab - Enhanced with local storage data
 */
function CallsHistoryTab({ 
  localHistory,
  serverHistory,
  isLoading, 
  error, 
  onRefresh,
  agents,
  onSelectAgent,
}: { 
  localHistory: ReturnType<typeof useLocalCallHistory>;
  serverHistory: any[];
  isLoading?: boolean;
  error?: string | null;
  onRefresh?: () => Promise<void>;
  agents: any[];
  onSelectAgent: (agent: any) => void;
}) {
  const [filter, setFilter] = useState<'all' | 'saved'>('all');
  const [selectedCall, setSelectedCall] = useState<CallRecord | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const [shareCall, setShareCall] = useState<CallRecord | null>(null);
  const [exportCall, setExportCall] = useState<CallRecord | null>(null);
  const [showBulkExport, setShowBulkExport] = useState(false);

  const displayCalls = filter === 'saved' ? localHistory.getSavedCalls() : localHistory.calls;
  
  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const handleDownload = (call: CallRecord) => {
    setExportCall(call);
  };

  const handleShare = (call: CallRecord) => {
    setShareCall(call);
  };

  const handleCallAgain = (call: CallRecord) => {
    const agent = agents.find(a => a.id === call.agentId);
    if (agent) {
      onSelectAgent(agent);
    } else {
      showError('Agent not available');
    }
  };

  return (
    <div className="p-4 space-y-5">
      {/* Header with Stats */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Call History</h2>
          <p className="text-sm text-gray-400">
            {localHistory.totalCalls} calls • {formatDuration(localHistory.totalDuration)} total
          </p>
        </div>
        <RefreshButton variant="full" onRefresh={onRefresh || (async () => {})} />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard 
          icon={<Phone className="w-4 h-4" />}
          value={localHistory.totalCalls.toString()}
          label="Calls"
        />
        <StatCard 
          icon={<Clock className="w-4 h-4" />}
          value={formatDuration(localHistory.totalDuration)}
          label="Duration"
        />
        <StatCard 
          icon={<Wallet className="w-4 h-4" />}
          value={`$${localHistory.totalSpent.toFixed(2)}`}
          label="Spent"
        />
      </div>

      {/* Filter Tabs & Export */}
      <div className="flex gap-2">
        <FilterButton active={filter === 'all'} onClick={() => setFilter('all')}>
          All Calls
        </FilterButton>
        <FilterButton active={filter === 'saved'} onClick={() => setFilter('saved')}>
          Saved ({localHistory.getSavedCalls().length})
        </FilterButton>
        {displayCalls.length > 0 && (
          <button
            onClick={() => setShowBulkExport(true)}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-800 text-gray-400 hover:bg-gray-700 transition-colors"
            title="Export all calls"
          >
            Export
          </button>
        )}
      </div>

      {/* Call List */}
      {displayCalls.length > 0 ? (
        <div className="space-y-3">
          {displayCalls.map(call => (
            <CallHistoryCard
              key={call.id}
              call={call}
              isSaved={call.isSaved}
              onToggleSave={() => localHistory.toggleSaveCall(call.id)}
              onViewTranscript={() => { setSelectedCall(call); setShowTranscript(true); }}
              onDownload={() => handleDownload(call)}
              onShare={() => handleShare(call)}
              onCallAgain={() => handleCallAgain(call)}
              onRate={(r) => localHistory.rateCall(call.id, r)}
              formatDate={formatDate}
              formatDuration={formatDuration}
            />
          ))}
        </div>
      ) : (
        <EmptyHistoryState />
      )}

      {/* Transcript Modal */}
      {selectedCall && (
        <TranscriptModal
          call={selectedCall}
          isOpen={showTranscript}
          onClose={() => setShowTranscript(false)}
          formatDate={formatDate}
          formatDuration={formatDuration}
        />
      )}

      {/* Share Modal */}
      {shareCall && (
        <ShareModal
          isOpen={!!shareCall}
          onClose={() => setShareCall(null)}
          title={`Call with ${shareCall.agentName}`}
          description={`I had a ${formatDuration(shareCall.duration)} voice call with ${shareCall.agentName} on Voice Agent Hotline! 🎙️`}
          url={typeof window !== 'undefined' ? window.location.href : ''}
          callData={{
            agentName: shareCall.agentName,
            duration: shareCall.duration,
            cost: shareCall.cost,
            rating: shareCall.rating,
          }}
        />
      )}

      {/* Export Modal */}
      <ExportModal
        isOpen={!!exportCall}
        onClose={() => setExportCall(null)}
        call={exportCall || undefined}
      />

      {/* Bulk Export Modal */}
      <ExportModal
        isOpen={showBulkExport}
        onClose={() => setShowBulkExport(false)}
        calls={displayCalls}
      />
    </div>
  );
}

function StatCard({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="bg-gray-900 rounded-xl p-3 text-center">
      <div className="text-gray-400 mb-1">{icon}</div>
      <div className="text-lg font-bold text-white">{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
        active 
          ? 'bg-cyan-500 text-white' 
          : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
      }`}
    >
      {children}
    </button>
  );
}

function CallHistoryCard({
  call,
  isSaved,
  onToggleSave,
  onViewTranscript,
  onDownload,
  onShare,
  onCallAgain,
  onRate,
  formatDate,
  formatDuration,
}: {
  call: CallRecord;
  isSaved: boolean;
  onToggleSave: () => void;
  onViewTranscript: () => void;
  onDownload: () => void;
  onShare: () => void;
  onCallAgain: () => void;
  onRate: (rating: number) => void;
  formatDate: (ts: number) => string;
  formatDuration: (s: number) => string;
}) {
  const [showActions, setShowActions] = useState(false);
  const [hoverRating, setHoverRating] = useState(0);
  const [pendingRating, setPendingRating] = useState<number | null>(null);

  const handleRate = (r: number) => {
    setPendingRating(r);
    onRate(r);
  };

  const displayRating = pendingRating ?? call.rating ?? 0;
  const isRated = displayRating > 0;

  return (
    <Card variant="default" className="p-4 animate-fadeIn">
      <div className="flex items-start gap-3">
        <Avatar size="md">
          {call.agentName.charAt(0)}
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div className="font-semibold truncate">{call.agentName}</div>
            <button
              onClick={onToggleSave}
              className={`p-1 rounded ${isSaved ? 'text-cyan-400' : 'text-gray-600 hover:text-gray-400'}`}
            >
              <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
            </button>
          </div>
          <div className="text-sm text-gray-400 mb-2">{call.agentSpecialty}</div>
          
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDuration(call.duration)}
            </span>
            <span>{formatDate(call.timestamp)}</span>
            <span className="text-cyan-400">${call.cost.toFixed(2)}</span>
          </div>

          {/* Rating row — interactive when unrated */}
          <div className="flex items-center gap-1 mt-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <button
                key={i}
                disabled={isRated}
                onMouseEnter={() => !isRated && setHoverRating(i + 1)}
                onMouseLeave={() => setHoverRating(0)}
                onClick={() => !isRated && handleRate(i + 1)}
                className={`transition-transform ${!isRated ? 'hover:scale-125 cursor-pointer' : 'cursor-default'}`}
                title={isRated ? `Rated ${displayRating}/5` : `Rate ${i + 1}/5`}
              >
                <Star
                  className={`w-3.5 h-3.5 transition-colors ${
                    i < (hoverRating || displayRating)
                      ? 'text-yellow-400 fill-yellow-400'
                      : 'text-gray-600'
                  }`}
                />
              </button>
            ))}
            {!isRated && (
              <span className="text-xs text-gray-600 ml-1">Tap to rate</span>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 mt-3 pt-3 border-t border-gray-800">
        <button
          onClick={onViewTranscript}
          className="flex-1 py-2 text-xs font-medium text-gray-400 hover:text-white bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
        >
          View Transcript
        </button>
        <button
          onClick={() => setShowActions(!showActions)}
          className="px-3 py-2 text-xs font-medium text-gray-400 hover:text-white bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
        >
          •••
        </button>
      </div>

      {showActions && (
        <div className="flex gap-2 mt-2">
          <ActionIconButton onClick={onDownload} icon={<Download className="w-4 h-4" />} label="Download" />
          <ActionIconButton onClick={onShare} icon={<Share2 className="w-4 h-4" />} label="Share" />
          <ActionIconButton onClick={onCallAgain} icon={<Phone className="w-4 h-4" />} label="Call Again" />
        </div>
      )}
    </Card>
  );
}

function ActionIconButton({ onClick, icon, label }: { onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 flex flex-col items-center gap-1 py-2 text-xs text-gray-400 hover:text-cyan-400 transition-colors"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function TranscriptModal({
  call,
  isOpen,
  onClose,
  formatDate,
  formatDuration,
}: {
  call: CallRecord;
  isOpen: boolean;
  onClose: () => void;
  formatDate: (ts: number) => string;
  formatDuration: (s: number) => string;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-gray-950/95 backdrop-blur-sm overflow-y-auto">
      <div className="min-h-screen p-4">
        <div className="max-w-lg mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-white">Call Transcript</h2>
              <p className="text-sm text-gray-400">with {call.agentName}</p>
            </div>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-white">
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Call Info */}
          <div className="bg-gray-900 rounded-xl p-4 mb-4">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Date</span>
              <span className="text-white">{formatDate(call.timestamp)}</span>
            </div>
            <div className="flex justify-between text-sm mt-2">
              <span className="text-gray-400">Duration</span>
              <span className="text-white">{formatDuration(call.duration)}</span>
            </div>
            <div className="flex justify-between text-sm mt-2">
              <span className="text-gray-400">Cost</span>
              <span className="text-cyan-400">${call.cost.toFixed(2)}</span>
            </div>
          </div>

          {/* Transcript */}
          <div className="bg-gray-900 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-400 mb-4">Conversation</h3>
            {call.transcripts.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No transcript available</p>
            ) : (
              <div className="space-y-4">
                {call.transcripts.map((msg, i) => (
                  <div 
                    key={i} 
                    className={`flex ${msg.speaker === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div 
                      className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm ${
                        msg.speaker === 'user'
                          ? 'bg-cyan-500 text-white rounded-br-md'
                          : 'bg-gray-800 text-gray-200 rounded-bl-md'
                      }`}
                    >
                      <p>{msg.text}</p>
                      <span className="text-xs opacity-60 mt-1 block">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Profile Tab
 */
function ProfileTab({ 
  balance, 
  address, 
  isLoading 
}: { 
  balance: number;
  address?: string | null;
  isLoading?: boolean;
}) {
  const displayAddress = address
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : 'Not connected';

  return (
    <div className="p-4 space-y-6">
      {/* Profile Header */}
      <div className="flex items-center gap-4">
        <Avatar size="xl" online={!!address} className="bg-gradient-to-br from-cyan-500 to-blue-500">
          <User className="w-8 h-8" />
        </Avatar>
        <div>
          <h2 className="text-xl font-bold font-mono">{displayAddress}</h2>
          {address && (
            <button
              onClick={() => navigator.clipboard?.writeText(address)}
              className="text-xs text-gray-400 hover:text-cyan-400 transition-colors"
              title="Copy address"
            >
              Copy full address
            </button>
          )}
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

      {/* Referral Section — rendered inside the component tree */}
      <ReferralSection />
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
  agent: any | null;
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

