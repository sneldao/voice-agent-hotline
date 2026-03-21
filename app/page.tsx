'use client';

import { useState, useCallback, Suspense, useEffect, useMemo, useRef } from 'react';
import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ToastProvider, showError } from '@/components/ui';
import { useWallet } from '@/lib/WalletContextNew';
import { useLocalCallHistory } from '@/lib/useCallHistory';
import { useWebRTCSupport } from '@/lib/useRealVoiceCall';
import { useOnboarding } from '@/lib/useOnboarding';
import { useUserBalance, useAgents } from '@/lib/useSWR';
import { ActiveCall } from '@/components/ActiveCall';
import { Onboarding } from '@/components/Onboarding';
import { WalletConnectGate } from '@/components/WalletConnectGate';
import { LowBalanceWarning } from '@/components/LowBalanceWarning';
import { Header } from '@/components/Header';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { getRelatedAgentRecommendations } from '@/lib/agent-recommendations';
import { readCallLaunchParams, type PaymentLaunchMode } from '@/lib/product-launch';
import { runStreamingPreflight, STREAMING_BALANCE_ESTIMATE_MINUTES } from '@/lib/streaming-preflight';
import { ACTIVE_CHAIN } from '@/lib/superfluid-streaming';

// Lazy load tabs for code splitting
const DiscoverTab = React.lazy(() => import('@/components/DiscoverTab').then(m => ({ default: m.DiscoverTab })));
const CallsHistoryTab = React.lazy(() => import('@/components/CallsHistoryTab').then(m => ({ default: m.CallsHistoryTab })));
const ProfileTab = React.lazy(() => import('@/components/ProfileTab').then(m => ({ default: m.ProfileTab })));

export default function Home() {
  const [activeTab, setActiveTab] = useState<'discover' | 'calls' | 'profile'>('discover');
  const [selectedAgent, setSelectedAgent] = useState<any>(null);
  const [selectedPaymentMode, setSelectedPaymentMode] = useState<PaymentLaunchMode>('x402');
  const [inCall, setInCall] = useState(false);
  const [callId, setCallId] = useState<string | null>(null);
  const [showSmartFinder, setShowSmartFinder] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showWalletGate, setShowWalletGate] = useState(false);
  const [showLowBalance, setShowLowBalance] = useState(false);
  const [requiredBalance, setRequiredBalance] = useState(0);
  const [streamingPreflightMeta, setStreamingPreflightMeta] = useState<{
    chainName: string;
    tokenSymbol: string;
    payoutAddress: string;
    availableBalance?: number;
    requiredBalance?: number;
  } | null>(null);
  const [lowBalanceContent, setLowBalanceContent] = useState({
    title: 'Insufficient Balance',
    description: 'Add funds to your wallet to continue with this call. Your balance is too low to cover the estimated cost.',
    balanceLabel: 'Current Balance',
    requiredLabel: 'Required',
    assetSymbol: undefined as string | undefined,
    currentBalance: 0,
  });
  const searchParams = useSearchParams();
  const router = useRouter();
  const launchParamsRef = useRef<{ agentId: string; paymentMode: PaymentLaunchMode; autoStart: boolean } | null>(null);
  const launchAttemptedRef = useRef(false);

  const { connected, address, chainId, isConnecting, connect, disconnect, formatAddress, switchChain } = useWallet();
  const { balance: userBalance, isLoading: isLoadingBalance, mutate: mutateBalance } = useUserBalance(address);
  const { agents, isLoading: isLoadingAgents, error: agentsError, mutate: mutateAgents } = useAgents();
  const localCallHistory = useLocalCallHistory();
  const { isSupported: isWebRTCSupported, permissions: micPermissions, requestMicrophonePermission } = useWebRTCSupport();
  const onboarding = useOnboarding(connected, userBalance);
  const clearLaunchState = useCallback(() => {
    launchParamsRef.current = null;
    launchAttemptedRef.current = false;
  }, []);
  const getWalletChainId = useCallback(async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      return chainId;
    }

    try {
      const ethereum = window.ethereum as { request: (args: { method: string }) => Promise<string> };
      const currentChainId = await ethereum.request({ method: 'eth_chainId' });
      return parseInt(currentChainId, 16);
    } catch {
      return chainId;
    }
  }, [chainId]);

  const startCall = useCallback(async () => {
    if (!selectedAgent) return;
    if (!isWebRTCSupported) { showError('WebRTC not supported'); return; }
    if (micPermissions.microphone === 'denied') { showError('Microphone access required'); return; }
    if (micPermissions.microphone === 'prompt') {
      const granted = await requestMicrophonePermission();
      if (!granted) { showError('Microphone permission required'); return; }
    }
    if (!connected) { setShowWalletGate(true); return; }

    const estimatedCost = Number(selectedAgent.rate) * 5;

    if (selectedPaymentMode === 'streaming') {
      const payoutAddress = selectedAgent.wallet_address || selectedAgent.walletAddress;
      let currentChainId = await getWalletChainId();

      if (currentChainId !== ACTIVE_CHAIN.id) {
        await switchChain(ACTIVE_CHAIN.id);
        currentChainId = await getWalletChainId();
      }

      const preflight = await runStreamingPreflight({
        walletAddress: address as `0x${string}`,
        currentChainId,
        agentAddress: payoutAddress,
        ratePerMinute: Number(selectedAgent.rate),
      });

      if (!preflight.ok) {
        setStreamingPreflightMeta(null);
        if (preflight.code === 'insufficient_balance') {
          setLowBalanceContent({
            title: 'Insufficient Streaming Balance',
            description: `Streaming calls use ${preflight.tokenSymbol}. Add enough balance to cover the first ${STREAMING_BALANCE_ESTIMATE_MINUTES} minutes before connecting.`,
            balanceLabel: `Available ${preflight.tokenSymbol}`,
            requiredLabel: `${STREAMING_BALANCE_ESTIMATE_MINUTES}-min reserve`,
            assetSymbol: preflight.tokenSymbol,
            currentBalance: preflight.availableBalance || 0,
          });
          setRequiredBalance(preflight.requiredBalance || 0);
          setShowLowBalance(true);
          return;
        }

        showError(preflight.message);
        return;
      }
      setStreamingPreflightMeta({
        chainName: preflight.requiredChainName,
        tokenSymbol: preflight.tokenSymbol,
        payoutAddress: payoutAddress || '',
        availableBalance: preflight.availableBalance,
        requiredBalance: preflight.requiredBalance,
      });
    } else if (userBalance < estimatedCost) {
      setStreamingPreflightMeta(null);
      setLowBalanceContent({
        title: 'Insufficient Balance',
        description: 'Add funds to your wallet to continue with this call. Your balance is too low to cover the estimated cost.',
        balanceLabel: 'Current Balance',
        requiredLabel: 'Required',
        assetSymbol: undefined,
        currentBalance: userBalance,
      });
      setRequiredBalance(estimatedCost);
      setShowLowBalance(true);
      return;
    }

    const newCallId = `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setCallId(newCallId);
    setInCall(true);
  }, [
    address,
    connected,
    getWalletChainId,
    isWebRTCSupported,
    micPermissions,
    requestMicrophonePermission,
    selectedAgent,
    selectedPaymentMode,
    switchChain,
    userBalance,
  ]);

  const endCall = useCallback(() => {
    clearLaunchState();
    setStreamingPreflightMeta(null);
    setInCall(false);
    setSelectedAgent(null);
    setSelectedPaymentMode('x402');
    setCallId(null);
  }, [clearLaunchState]);

  const handleSelectRelatedAgent = useCallback((agentId: string) => {
    const agent = agents.find((a: any) => a.id === agentId);
    clearLaunchState();
    setStreamingPreflightMeta(null);
    setInCall(false);
    setCallId(null);
    setSelectedPaymentMode('x402');
    setActiveTab('discover');
    setShowSmartFinder(false);

    if (agent) {
      setSelectedAgent(agent);
    }
  }, [agents, clearLaunchState]);

  const filteredAgents = agents.filter((agent: any) => {
    const matchesSearch = !searchQuery || agent.name.toLowerCase().includes(searchQuery.toLowerCase()) || (agent.specialty ?? '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || agent.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });
  const relatedAgents = useMemo(
    () => getRelatedAgentRecommendations(selectedAgent, agents, 3),
    [agents, selectedAgent]
  );

  useEffect(() => {
    const launchParams = readCallLaunchParams(searchParams);
    if (!launchParams || launchParamsRef.current) {
      return;
    }

    launchParamsRef.current = launchParams;

    setActiveTab('discover');
    setShowSmartFinder(false);
    setSelectedPaymentMode(launchParamsRef.current.paymentMode);
    router.replace('/', { scroll: false });
  }, [router, searchParams]);

  useEffect(() => {
    const launchParams = launchParamsRef.current;
    if (!launchParams || selectedAgent || agents.length === 0) {
      return;
    }

    const agent = agents.find((candidate: any) => candidate.id === launchParams.agentId);
    if (!agent) {
      showError('Selected agent is no longer available.');
      launchParamsRef.current = null;
      return;
    }

    setSelectedAgent(agent);
  }, [agents, selectedAgent]);

  useEffect(() => {
    const launchParams = launchParamsRef.current;
    if (!launchParams?.autoStart || !selectedAgent || launchAttemptedRef.current) {
      return;
    }

    void startCall().finally(() => {
      if (connected) {
        launchAttemptedRef.current = true;
      }
    });
  }, [connected, selectedAgent, startCall]);

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-950 text-white font-sans">
        <ToastProvider />
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
        <WalletConnectGate
          isOpen={showWalletGate}
          onConnect={() => { connect(); setShowWalletGate(false); }}
          onClose={() => setShowWalletGate(false)}
          isConnecting={isConnecting}
        />
        <LowBalanceWarning
          isOpen={showLowBalance}
          balance={lowBalanceContent.currentBalance}
          requiredAmount={requiredBalance}
          title={lowBalanceContent.title}
          description={lowBalanceContent.description}
          balanceLabel={lowBalanceContent.balanceLabel}
          requiredLabel={lowBalanceContent.requiredLabel}
          assetSymbol={lowBalanceContent.assetSymbol}
          onAddFunds={() => { setShowLowBalance(false); setActiveTab('profile'); }}
          onClose={() => setShowLowBalance(false)}
          onGoHome={() => { setShowLowBalance(false); setSelectedAgent(null); }}
        />
        <Header
          connected={connected}
          userBalance={userBalance}
          isConnecting={isConnecting}
          formatAddress={formatAddress}
          onConnect={connect}
          onDisconnect={disconnect}
        />
        <main id="main-content" className="max-w-md mx-auto pb-28" role="main">
          {inCall && selectedAgent && callId ? (
            <ActiveCall
              agent={{
                id: selectedAgent.id,
                name: selectedAgent.name,
                specialty: selectedAgent.specialty,
                avatar: selectedAgent.avatar,
                rate: Number(selectedAgent.rate),
                color: selectedAgent.color,
                walletAddress: selectedAgent.wallet_address || selectedAgent.walletAddress,
              }}
              callId={callId}
              userId={address || 'anonymous'}
              paymentMode={selectedPaymentMode}
              streamingPreflight={selectedPaymentMode === 'streaming' ? (streamingPreflightMeta || undefined) : undefined}
              relatedAgents={relatedAgents}
              onEnd={endCall}
              onSelectRelatedAgent={handleSelectRelatedAgent}
            />
          ) : (
            <>
              {activeTab === 'discover' && (
                <Suspense fallback={<TabLoading />}>
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
                    onRefresh={mutateAgents}
                    showSmartFinder={showSmartFinder}
                    onToggleSmartFinder={() => setShowSmartFinder(!showSmartFinder)}
                  />
                </Suspense>
              )}
              {activeTab === 'calls' && (
                <Suspense fallback={<TabLoading />}>
                  <CallsHistoryTab
                    localHistory={localCallHistory}
                    serverHistory={[]}
                    isLoading={false}
                    error={null}
                    onRefresh={async () => {}}
                    agents={agents}
                    onSelectAgent={setSelectedAgent}
                  />
                </Suspense>
              )}
              {activeTab === 'profile' && (
                <Suspense fallback={<TabLoading />}>
                  <ProfileTab
                    balance={userBalance}
                    address={address}
                    isLoading={isLoadingBalance}
                  />
                </Suspense>
              )}
            </>
          )}
        </main>
        <nav className="fixed bottom-0 left-0 right-0 bg-gray-900/95 backdrop-blur-xl border-t border-gray-800/50" role="navigation" aria-label="Main navigation">
          <div className="max-w-md mx-auto px-4 py-2 flex justify-around">
            {[
              { id: 'discover', label: 'Discover', icon: '🔍' },
              { id: 'calls', label: 'Calls', icon: '📞' },
              { id: 'profile', label: 'Profile', icon: '👤' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex flex-col items-center gap-1 px-6 py-2 rounded-xl transition-all ${
                  activeTab === tab.id ? 'text-cyan-400 bg-cyan-500/10' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <span className="text-xl">{tab.icon}</span>
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
