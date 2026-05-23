'use client';

// Force dynamic rendering to avoid SSR issues with client-only SDKs
export const revalidate = 0;

import { useReducer, useCallback, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { ToastProvider, showError, showInfo } from '@/components/ui';
import { useWallet } from '@/lib/WalletContextNew';
import { useLocalCallHistory } from '@/lib/useCallHistory';
import { useWebRTCSupport } from '@/lib/useWebRTCSupport';
import { useUserBalance, useAgents } from '@/lib/useSWR';
import { Search, Phone, User } from 'lucide-react';
import { generateCallId } from '@/lib/ids';
import type { Agent } from '@/lib/types';
import { Header } from '@/components/Header';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { OfflineBanner } from '@/components/OfflineBanner';
import { AgentPreviewSheet } from '@/components/AgentPreviewSheet';
import { Onboarding } from '@/components/Onboarding';
import { getRelatedAgentRecommendations } from '@/lib/agent-recommendations';
import { readCallLaunchParams } from '@/lib/product-launch';
import { useOnboarding } from '@/lib/useOnboarding';
import { usePersonalizedAgents, getPreferredConcierge } from '@/lib/usePersonalization';
import { useFreeCall } from '@/lib/useFreeCall';
import { useStreak } from '@/lib/useStreak';

// #17: Lazy-load all heavy components — only DiscoverTab is needed on first paint
const ActiveCall = dynamic(() => import('@/components/ActiveCall').then(m => ({ default: m.ActiveCall })), { ssr: false });
const CallsHistoryTab = dynamic(() => import('@/components/CallsHistoryTab').then(m => ({ default: m.CallsHistoryTab })));
const ProfileTab = dynamic(() => import('@/components/ProfileTab').then(m => ({ default: m.ProfileTab })));

// DiscoverTab is the landing view — keep it eager
import { DiscoverTab } from '@/components/DiscoverTab';

interface PageState {
  activeTab: 'discover' | 'calls' | 'profile';
  selectedAgent: Agent | null;
  previewAgent: Agent | null;
  inCall: boolean;
  callId: string | null;
  searchQuery: string;
  selectedCategory: string;
  pendingLaunch: { agentId: string; autoStart: boolean } | null;
}

type PageAction =
  | { type: 'SET_TAB'; tab: PageState['activeTab'] }
  | { type: 'SELECT_AGENT'; agent: Agent | null }
  | { type: 'PREVIEW_AGENT'; agent: Agent | null }
  | { type: 'START_CALL'; callId: string }
  | { type: 'END_CALL' }
  | { type: 'SET_SEARCH'; query: string }
  | { type: 'SET_CATEGORY'; category: string }
  | { type: 'SET_LAUNCH'; launch: { agentId: string; autoStart: boolean } | null }
  | { type: 'CONSUME_LAUNCH' };

const initialPageState: PageState = {
  activeTab: 'discover',
  selectedAgent: null,
  previewAgent: null,
  inCall: false,
  callId: null,
  searchQuery: '',
  selectedCategory: 'all',
  pendingLaunch: null,
};

function pageReducer(state: PageState, action: PageAction): PageState {
  switch (action.type) {
    case 'SET_TAB':
      return { ...state, activeTab: action.tab };
    case 'SELECT_AGENT':
      return { ...state, selectedAgent: action.agent };
    case 'PREVIEW_AGENT':
      return { ...state, previewAgent: action.agent };
    case 'START_CALL':
      return { ...state, inCall: true, previewAgent: null, callId: action.callId };
    case 'END_CALL':
      return { ...state, inCall: false, selectedAgent: null, previewAgent: null, callId: null };
    case 'SET_SEARCH':
      return { ...state, searchQuery: action.query };
    case 'SET_CATEGORY':
      return { ...state, selectedCategory: action.category };
    case 'SET_LAUNCH':
      return { ...state, pendingLaunch: action.launch };
    case 'CONSUME_LAUNCH':
      return { ...state, pendingLaunch: null };
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
    activeTab, selectedAgent, previewAgent, inCall, callId,
    searchQuery, selectedCategory, pendingLaunch,
  } = state;
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isStartingCall, setIsStartingCall] = useState(false);

  // #18 & #21: Debounce BOTH search and category together; reset page on change
  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery);
  const [debouncedCategory, setDebouncedCategory] = useState(selectedCategory);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setDebouncedCategory(selectedCategory);
      setPage(1); // #18: Reset pagination on filter change
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery, selectedCategory]);

  const { connected, address, isConnecting, connect, disconnect, formatAddress } = useWallet();
  const { balance: userBalance, isLoading: isLoadingBalance } = useUserBalance(address);
  const onboarding = useOnboarding(connected, userBalance || 0);
  const freeCall = useFreeCall();
  const streak = useStreak();

  const { agents, total, hasMore, isLoading: isLoadingAgents, error: agentsError, mutate: mutateAgents } = useAgents({
    search: debouncedQuery,
    category: debouncedCategory,
    page,
  });

  // Personalize agent order based on onboarding use-case selection
  const personalizedAgents = usePersonalizedAgents(agents, onboarding.selectedUseCase);
  const displayedAgents = personalizedAgents;
  const localCallHistory = useLocalCallHistory();
  const { isSupported: isWebRTCSupported, permissions: micPermissions, requestMicrophonePermission } = useWebRTCSupport();

  const clearLaunchState = useCallback(() => {
    dispatch({ type: 'CONSUME_LAUNCH' });
  }, []);

  // #19: Removed preflight — useWidgetConversation fetches a signed URL via
  // /api/webrtc/signal when starting. A separate availability check is a wasted round-trip.
  // The hook will surface an error if the agent is unavailable.
  const startCallWithAgentRef = useRef<(agent: Agent) => Promise<void>>();
  startCallWithAgentRef.current = async (agent: Agent) => {
    const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

    // Allow call if: demo mode, wallet connected, OR user has a free call available
    if (!isDemoMode && !freeCall.hasFreeCall && (!connected || !address)) {
      dispatch({ type: 'PREVIEW_AGENT', agent });
      showInfo('Wallet needed first. Connect your wallet, then the call can start.');
      return;
    }

    // If using free call (no wallet), activate it
    if (!isDemoMode && !connected && freeCall.hasFreeCall) {
      freeCall.startFreeCall();
    }

    setIsStartingCall(true);
    try {
      if (!isWebRTCSupported) {
        dispatch({ type: 'PREVIEW_AGENT', agent });
        showError('Your browser does not support voice calls. Try Chrome desktop for the demo.');
        return;
      }
      if (micPermissions.microphone === 'denied') {
        dispatch({ type: 'PREVIEW_AGENT', agent });
        showError('Microphone access is blocked. Please allow it in browser settings.');
        return;
      }
      if (micPermissions.microphone === 'prompt') {
        showInfo('Allow microphone access to open the voice line.');
        const granted = await requestMicrophonePermission();
        if (!granted) {
          dispatch({ type: 'PREVIEW_AGENT', agent });
          showError('Microphone permission is required for voice calls');
          return;
        }
      }

      dispatch({ type: 'SELECT_AGENT', agent });
      const newCallId = generateCallId();
      dispatch({ type: 'START_CALL', callId: newCallId });
    } finally {
      setIsStartingCall(false);
    }
  };

  // Stable reference that never changes — avoids effect re-triggers
  const startCallWithAgent = useCallback((agent: Agent) => {
    return startCallWithAgentRef.current!(agent);
  }, []);

  const endCall = useCallback(() => {
    clearLaunchState();
    // If this was a free call, mark it as used
    if (freeCall.isFreeCallActive) {
      freeCall.completeFreeCall();
    }
    // Record the call for streak tracking
    if (selectedAgent) {
      streak.recordCall(selectedAgent.id);
    }
    dispatch({ type: 'END_CALL' });
  }, [clearLaunchState, freeCall, selectedAgent, streak]);

  const handleSelectAgent = useCallback((agent: Agent | null) => {
    if (agent) {
      const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
      if (isDemoMode) {
        // In demo mode, skip the preview sheet and start the call directly
        startCallWithAgent(agent);
      } else {
        dispatch({ type: 'PREVIEW_AGENT', agent });
      }
    }
  }, [startCallWithAgent]);

  const handleSelectRelatedAgent = useCallback((agentId: string) => {
    const agent = agents.find((a) => a.id === agentId);
    clearLaunchState();
    dispatch({ type: 'END_CALL' });
    dispatch({ type: 'SET_TAB', tab: 'discover' });

    if (agent) {
      dispatch({ type: 'PREVIEW_AGENT', agent });
    }
  }, [agents, clearLaunchState]);

  const handleSearchChange = useCallback((query: string) => {
    dispatch({ type: 'SET_SEARCH', query });
  }, []);

  const handleCategoryChange = useCallback((category: string) => {
    dispatch({ type: 'SET_CATEGORY', category });
  }, []);

  const handleSelectRelatedAgentDispatch = useCallback((agent: Agent | null) => {
    if (agent) dispatch({ type: 'PREVIEW_AGENT', agent });
  }, []);

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
    if (!launchParams || pendingLaunch) {
      return;
    }

    dispatch({ type: 'SET_LAUNCH', launch: launchParams });
    dispatch({ type: 'SET_TAB', tab: 'discover' });
    router.replace('/', { scroll: false });
  }, [pendingLaunch, router, searchParams]);

  useEffect(() => {
    if (!pendingLaunch || selectedAgent || previewAgent || agents.length === 0) {
      return;
    }

    const agent = agents.find((candidate) => candidate.id === pendingLaunch.agentId);
    dispatch({ type: 'CONSUME_LAUNCH' });
    if (!agent) {
      return;
    }

    dispatch({ type: 'PREVIEW_AGENT', agent });
  }, [agents, pendingLaunch, previewAgent, selectedAgent]);

  return (
    <ErrorBoundary>
      <div className="switchboard-shell min-h-screen text-white font-sans">
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
        <Onboarding
          isOpen={onboarding.isOpen}
          currentStep={onboarding.currentStep}
          walletConnected={connected}
          walletBalance={userBalance || 0}
          selectedUseCase={onboarding.selectedUseCase}
          currentStepIndex={onboarding.currentStepIndex}
          totalSteps={onboarding.totalSteps}
          onClose={onboarding.closeOnboarding}
          onNext={onboarding.nextStep}
          onPrev={onboarding.prevStep}
          onSkip={onboarding.skipOnboarding}
          onSetUseCase={onboarding.setUseCase}
          onConnect={connect}
        />
        <main id="main-content" className="mx-auto max-w-6xl px-4 pb-28 sm:px-6 lg:px-8" role="main">
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
              walletConnected={connected}
              streakCount={streak.currentStreak}
              isFirstCall={streak.totalCalls <= 1}
              onConnectWallet={connect}
            />
          ) : (
            <>
              {activeTab === 'discover' && (
                <ErrorBoundary fallback={<TabError label="Discover" onRetry={() => dispatch({ type: 'SET_TAB', tab: 'discover' })} />}>
                  <DiscoverTab
                    agents={displayedAgents}
                    isLoading={isLoadingAgents && displayedAgents.length === 0}
                    error={agentsError}
                    onSelect={handleSelectAgent}
                    onVoiceCall={startCallWithAgent}
                    searchQuery={searchQuery}
                    onSearchChange={handleSearchChange}
                    selectedCategory={selectedCategory}
                    onCategoryChange={handleCategoryChange}
                    onRefresh={mutateAgents}
                    hasMore={hasMore}
                    onLoadMore={handleLoadMore}
                    preferredConciergeId={getPreferredConcierge(onboarding.selectedUseCase)}
                  />
                </ErrorBoundary>
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
        <AgentPreviewSheet
          agent={previewAgent}
          connected={connected}
          userBalance={userBalance || 0}
          isConnectingWallet={isConnecting}
          isStartingCall={isStartingCall}
          hasFreeCall={freeCall.hasFreeCall}
          onClose={() => dispatch({ type: 'PREVIEW_AGENT', agent: null })}
          onConnect={connect}
          onCallNow={startCallWithAgent}
        />
        <nav className="fixed bottom-0 left-0 right-0 border-t border-amber-100/15 bg-[#120d0a]/92 backdrop-blur-xl" role="navigation" aria-label="Main navigation">
          <div className="mx-auto flex max-w-2xl justify-around px-4 py-2">
            {[
              { id: 'discover', label: 'Discover', Icon: Search },
              { id: 'calls', label: 'Calls', Icon: Phone },
              { id: 'profile', label: 'Profile', Icon: User },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => dispatch({ type: 'SET_TAB', tab: tab.id as PageState['activeTab'] })}
                aria-current={activeTab === tab.id ? 'page' : undefined}
                className={`flex flex-col items-center gap-1 rounded-xl px-6 py-2 transition-all ${
                  activeTab === tab.id ? 'bg-red-500/15 text-amber-100' : 'text-amber-100/40 hover:text-amber-100/75'
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
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-200 border-t-transparent" />
      <p className="mt-4 text-sm text-amber-100/55">Loading switchboard...</p>
    </div>
  );
}

function TabError({ label, onRetry }: { label: string; onRetry: () => void }) {
  return (
    <div className="p-4 flex flex-col items-center justify-center min-h-[50vh]">
      <p className="mb-4 text-sm text-red-300">Something went wrong loading {label}.</p>
      <button
        onClick={onRetry}
        className="rounded-lg border border-amber-100/20 bg-amber-100/10 px-4 py-2 text-sm font-bold text-amber-100 transition-colors hover:bg-amber-100/15"
      >
        Try Again
      </button>
    </div>
  );
}
