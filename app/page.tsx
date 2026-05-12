'use client';

// Force dynamic rendering to avoid SSR issues with client-only SDKs
export const revalidate = 0;

import { useReducer, useCallback, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { ToastProvider, showError } from '@/components/ui';
import { useWallet } from '@/lib/WalletContextNew';
import { useLocalCallHistory } from '@/lib/useCallHistory';
import { useWebRTCSupport } from '@/lib/useElevenLabsConversation';
import { useUserBalance, useAgents } from '@/lib/useSWR';
import { Search, Phone, User } from 'lucide-react';
import { generateCallId } from '@/lib/ids';
import type { Agent } from '@/lib/types';
// Dynamic import for ActiveCall with SSR disabled to avoid ElevenLabs SDK issues
const ActiveCall = dynamic(() => import('@/components/ActiveCall').then(m => ({ default: m.ActiveCall })), { ssr: false });
import { Header } from '@/components/Header';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { OfflineBanner } from '@/components/OfflineBanner';
import { getRelatedAgentRecommendations } from '@/lib/agent-recommendations';
import { readCallLaunchParams } from '@/lib/product-launch';

// Eager load tabs
import { DiscoverTab } from '@/components/DiscoverTab';
import { CallsHistoryTab } from '@/components/CallsHistoryTab';
import { ProfileTab } from '@/components/ProfileTab';

interface PageState {
  activeTab: 'discover' | 'calls' | 'profile';
  selectedAgent: Agent | null;
  inCall: boolean;
  callId: string | null;
  searchQuery: string;
  selectedCategory: string;
}

type PageAction =
  | { type: 'SET_TAB'; tab: PageState['activeTab'] }
  | { type: 'SELECT_AGENT'; agent: Agent | null }
  | { type: 'START_CALL'; callId: string }
  | { type: 'END_CALL' }
  | { type: 'SET_SEARCH'; query: string }
  | { type: 'SET_CATEGORY'; category: string };

const initialPageState: PageState = {
  activeTab: 'discover',
  selectedAgent: null,
  inCall: false,
  callId: null,
  searchQuery: '',
  selectedCategory: 'all',
};

function pageReducer(state: PageState, action: PageAction): PageState {
  switch (action.type) {
    case 'SET_TAB':
      return { ...state, activeTab: action.tab };
    case 'SELECT_AGENT':
      return { ...state, selectedAgent: action.agent };
    case 'START_CALL':
      return { ...state, inCall: true, callId: action.callId };
    case 'END_CALL':
      return { ...state, inCall: false, selectedAgent: null, callId: null };
    case 'SET_SEARCH':
      return { ...state, searchQuery: action.query };
    case 'SET_CATEGORY':
      return { ...state, selectedCategory: action.category };
    default:
      return state;
  }
}

export default function Home() {
  return (
    <Suspense fallback={<TabLoading />}>
      <HomeInner />
    </Suspense>
  );
}

function HomeInner() {
  const [state, dispatch] = useReducer(pageReducer, initialPageState);
  const {
    activeTab, selectedAgent, inCall, callId,
    searchQuery, selectedCategory,
  } = state;
  const searchParams = useSearchParams();
  const router = useRouter();
  const launchParamsRef = useRef<{ agentId: string; autoStart: boolean } | null>(null);
  const launchAttemptedRef = useRef(false);

  // Debounce search query for API calls (300ms)
  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery]);

  const { connected, address, isConnecting, connect, disconnect, formatAddress } = useWallet();
  const { balance: userBalance, isLoading: isLoadingBalance } = useUserBalance(address);

  // Pagination state
  const [page, setPage] = useState(1);

  const { agents, total, hasMore, isLoading: isLoadingAgents, error: agentsError, mutate: mutateAgents } = useAgents({
    search: debouncedQuery,
    category: selectedCategory,
    page,
  });

  const displayedAgents = agents;
  const localCallHistory = useLocalCallHistory();
  const { isSupported: isWebRTCSupported, permissions: micPermissions, requestMicrophonePermission } = useWebRTCSupport();

  const clearLaunchState = useCallback(() => {
    launchParamsRef.current = null;
    launchAttemptedRef.current = false;
  }, []);

  // Tap agent → start call immediately (no modal, no wallet gate)
  const startCallWithAgent = useCallback(async (agent: Agent) => {
    if (!isWebRTCSupported) { showError('Your browser does not support voice calls'); return; }
    if (micPermissions.microphone === 'denied') { showError('Microphone access is blocked. Please allow it in browser settings.'); return; }
    if (micPermissions.microphone === 'prompt') {
      const granted = await requestMicrophonePermission();
      if (!granted) { showError('Microphone permission is required for voice calls'); return; }
    }

    // Set agent and start call in one go
    dispatch({ type: 'SELECT_AGENT', agent });

    // Pre-flight: verify the agent is configured
    try {
      const preflightRes = await fetch(`/api/webrtc/signal?agentId=${encodeURIComponent(agent.id)}`);
      if (!preflightRes.ok) {
        showError('This agent is unavailable right now');
        dispatch({ type: 'SELECT_AGENT', agent: null });
        return;
      }
    } catch {
      showError('Cannot reach voice service. Please try again.');
      dispatch({ type: 'SELECT_AGENT', agent: null });
      return;
    }

    const newCallId = generateCallId();
    dispatch({ type: 'START_CALL', callId: newCallId });
  }, [isWebRTCSupported, micPermissions, requestMicrophonePermission]);

  const endCall = useCallback(() => {
    clearLaunchState();
    dispatch({ type: 'END_CALL' });
  }, [clearLaunchState]);

  const handleSelectAgent = useCallback((agent: Agent | null) => {
    if (agent) {
      startCallWithAgent(agent);
    }
  }, [startCallWithAgent]);

  const handleSelectRelatedAgent = useCallback((agentId: string) => {
    const agent = agents.find((a) => a.id === agentId);
    clearLaunchState();
    dispatch({ type: 'END_CALL' });
    dispatch({ type: 'SET_TAB', tab: 'discover' });

    if (agent) {
      startCallWithAgent(agent);
    }
  }, [agents, clearLaunchState, startCallWithAgent]);

  const handleSearchChange = useCallback((query: string) => {
    dispatch({ type: 'SET_SEARCH', query });
  }, []);

  const handleCategoryChange = useCallback((category: string) => {
    dispatch({ type: 'SET_CATEGORY', category });
  }, []);

  const handleSelectRelatedAgentDispatch = useCallback((agent: Agent | null) => {
    if (agent) startCallWithAgent(agent);
  }, [startCallWithAgent]);

  const handleSwitchTab = useCallback((tab: string) => {
    dispatch({ type: 'SET_TAB', tab: tab as PageState['activeTab'] });
  }, []);

  const relatedAgents = useMemo(
    () => getRelatedAgentRecommendations(selectedAgent, agents, 3),
    [agents, selectedAgent]
  );

  const handleLoadMore = useCallback(() => {
    setPage(prev => prev + 1);
  }, []);

  useEffect(() => {
    const launchParams = readCallLaunchParams(searchParams);
    if (!launchParams || launchParamsRef.current) {
      return;
    }

    launchParamsRef.current = launchParams;
    dispatch({ type: 'SET_TAB', tab: 'discover' });
    router.replace('/', { scroll: false });
  }, [router, searchParams]);

  useEffect(() => {
    const launchParams = launchParamsRef.current;
    if (!launchParams || selectedAgent || agents.length === 0) {
      return;
    }

    const agent = agents.find((candidate) => candidate.id === launchParams.agentId);
    if (!agent) {
      launchParamsRef.current = null;
      return;
    }

    if (launchParams.autoStart) {
      startCallWithAgent(agent);
      launchAttemptedRef.current = true;
    }
  }, [agents, selectedAgent, startCallWithAgent]);

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-950 text-white font-sans">
        <OfflineBanner />
        <ToastProvider />
        <Header
          connected={connected}
          userBalance={userBalance}
          isConnecting={isConnecting}
          formatAddress={formatAddress}
          onConnect={connect}
          onDisconnect={disconnect}
        />
        <main id="main-content" className="max-w-2xl mx-auto pb-28 px-4 sm:px-6" role="main">
          {inCall && selectedAgent && callId ? (
            <ActiveCall
              agent={{
                id: selectedAgent.id,
                name: selectedAgent.name,
                specialty: selectedAgent.specialty,
                bio: selectedAgent.bio || '',
                avatar: selectedAgent.avatar,
                rate: Number(selectedAgent.rate),
                color: selectedAgent.color,
                online: selectedAgent.online,
                rating: selectedAgent.rating || 0,
                calls: selectedAgent.calls || 0,
                wallet_address: selectedAgent.wallet_address,
              }}
              callId={callId}
              userId={address || 'anonymous'}
              relatedAgents={relatedAgents}
              onEnd={endCall}
              onSelectRelatedAgent={handleSelectRelatedAgent}
            />
          ) : (
            <>
              {activeTab === 'discover' && (
                <Suspense fallback={<TabLoading />}>
                  <ErrorBoundary fallback={<TabError label="Discover" onRetry={() => dispatch({ type: 'SET_TAB', tab: 'discover' })} />}>
                    <DiscoverTab
                      agents={displayedAgents}
                      isLoading={isLoadingAgents && displayedAgents.length === 0}
                      error={agentsError}
                      onSelect={handleSelectAgent}
                      searchQuery={searchQuery}
                      onSearchChange={handleSearchChange}
                      selectedCategory={selectedCategory}
                      onCategoryChange={handleCategoryChange}
                      onRefresh={mutateAgents}
                      hasMore={hasMore}
                      onLoadMore={handleLoadMore}
                    />
                  </ErrorBoundary>
                </Suspense>
              )}
              {activeTab === 'calls' && (
                <Suspense fallback={<TabLoading />}>
                  <ErrorBoundary fallback={<TabError label="Calls History" onRetry={() => dispatch({ type: 'SET_TAB', tab: 'calls' })} />}>
                    <CallsHistoryTab
                      localHistory={localCallHistory}
                      address={address}
                      isLoading={false}
                      error={null}
                      onRefresh={async () => {}}
                      agents={agents}
                      onSelectAgent={handleSelectRelatedAgentDispatch}
                      onSwitchTab={handleSwitchTab}
                    />
                  </ErrorBoundary>
                </Suspense>
              )}
              {activeTab === 'profile' && (
                <Suspense fallback={<TabLoading />}>
                  <ErrorBoundary fallback={<TabError label="Profile" onRetry={() => dispatch({ type: 'SET_TAB', tab: 'profile' })} />}>
                    <ProfileTab
                      balance={userBalance}
                      address={address}
                      isLoading={isLoadingBalance}
                    />
                  </ErrorBoundary>
                </Suspense>
              )}
            </>
          )}
        </main>
        <nav className="fixed bottom-0 left-0 right-0 bg-gray-900/95 backdrop-blur-xl border-t border-gray-800/50" role="navigation" aria-label="Main navigation">
          <div className="max-w-2xl mx-auto px-4 py-2 flex justify-around">
            {[
              { id: 'discover', label: 'Discover', Icon: Search },
              { id: 'calls', label: 'Calls', Icon: Phone },
              { id: 'profile', label: 'Profile', Icon: User },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => dispatch({ type: 'SET_TAB', tab: tab.id as PageState['activeTab'] })}
                className={`flex flex-col items-center gap-1 px-6 py-2 rounded-xl transition-all ${
                  activeTab === tab.id ? 'text-cyan-400 bg-cyan-500/10' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <tab.Icon className="w-5 h-5" />
                <span className="text-xs font-medium">{tab.label}</span>
              </button>
            ))}
          </div>
        </nav>
      </div>
    </ErrorBoundary>
  );
}

function TabLoading() {
  return (
    <div className="p-4 flex flex-col items-center justify-center min-h-[50vh]">
      <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-gray-400 text-sm mt-4">Loading...</p>
    </div>
  );
}

function TabError({ label, onRetry }: { label: string; onRetry: () => void }) {
  return (
    <div className="p-4 flex flex-col items-center justify-center min-h-[50vh]">
      <p className="text-red-400 text-sm mb-4">Something went wrong loading {label}.</p>
      <button
        onClick={onRetry}
        className="px-4 py-2 text-sm font-medium text-cyan-400 bg-cyan-500/10 rounded-lg hover:bg-cyan-500/20 transition-colors"
      >
        Try Again
      </button>
    </div>
  );
}
