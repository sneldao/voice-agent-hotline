'use client';

import { useState, useCallback, Suspense } from 'react';
import React from 'react';
import { ToastProvider, showSuccess, showError } from '@/components/ui';
import { useWallet } from '@/lib/WalletContext';
import { useLocalCallHistory } from '@/lib/useCallHistory';
import { useRealVoiceCall, useWebRTCSupport } from '@/lib/useRealVoiceCall';
import { useOnboarding } from '@/lib/useOnboarding';
import { useUserBalance, useAgents } from '@/lib/useSWR';
import { ActiveCall } from '@/components/ActiveCall';
import { Onboarding } from '@/components/Onboarding';
import { WalletConnectGate } from '@/components/WalletConnectGate';
import { LowBalanceWarning } from '@/components/LowBalanceWarning';
import { Header } from '@/components/Header';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// Lazy load tabs for code splitting
const DiscoverTab = React.lazy(() => import('@/components/DiscoverTab').then(m => ({ default: m.DiscoverTab })));
const CallsHistoryTab = React.lazy(() => import('@/components/CallsHistoryTab').then(m => ({ default: m.CallsHistoryTab })));
const ProfileTab = React.lazy(() => import('@/components/ProfileTab').then(m => ({ default: m.ProfileTab })));

const MIN_BALANCE_FOR_CALL = 0.50;

export default function Home() {
  const [activeTab, setActiveTab] = useState<'discover' | 'calls' | 'profile'>('discover');
  const [selectedAgent, setSelectedAgent] = useState<any>(null);
  const [inCall, setInCall] = useState(false);
  const [callId, setCallId] = useState<string | null>(null);
  const [showSmartFinder, setShowSmartFinder] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showWalletGate, setShowWalletGate] = useState(false);
  const [showLowBalance, setShowLowBalance] = useState(false);
  const [requiredBalance, setRequiredBalance] = useState(0);
  const [isConnectingCall, setIsConnectingCall] = useState(false);

  const { connected, address, isConnecting, connect, formatAddress } = useWallet();
  const { balance: userBalance, isLoading: isLoadingBalance, mutate: mutateBalance } = useUserBalance(address);
  const { agents, isLoading: isLoadingAgents, error: agentsError, mutate: mutateAgents } = useAgents();
  const localCallHistory = useLocalCallHistory();
  const { startCall: startVoiceCall, endCall: endVoiceCall } = useRealVoiceCall(selectedAgent?.rate);
  const { isSupported: isWebRTCSupported, permissions: micPermissions, requestMicrophonePermission } = useWebRTCSupport();
  const onboarding = useOnboarding(connected, userBalance);

  const startCall = useCallback(async () => {
    if (!selectedAgent) return;
    if (!isWebRTCSupported) { showError('WebRTC not supported'); return; }
    if (micPermissions.microphone === 'denied') { showError('Microphone access required'); return; }
    if (micPermissions.microphone === 'prompt') {
      const granted = await requestMicrophonePermission();
      if (!granted) { showError('Microphone permission required'); return; }
    }
    if (!connected) { setShowWalletGate(true); return; }

    const estimatedCost = selectedAgent.rate * 5;
    if (userBalance < estimatedCost) {
      setRequiredBalance(estimatedCost);
      setShowLowBalance(true);
      return;
    }

    setIsConnectingCall(true);
    try {
      const newCallId = `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      setCallId(newCallId);
      const success = await startVoiceCall({ agentId: selectedAgent.id, callId: newCallId, userId: address! });
      if (!success) { showError('Failed to start call'); setIsConnectingCall(false); return; }
      setInCall(true);
      showSuccess(`Connected to ${selectedAgent.name}! First minute free.`);
    } catch {
      showError('Failed to connect');
      setIsConnectingCall(false);
    }
  }, [selectedAgent, isWebRTCSupported, micPermissions, requestMicrophonePermission, connected, userBalance, startVoiceCall, address]);

  const endCall = useCallback(() => {
    endVoiceCall();
    setInCall(false);
    setSelectedAgent(null);
    setCallId(null);
  }, [endVoiceCall]);

  const handleSelectRelatedAgent = useCallback((agentId: string) => {
    const agent = agents.find((a: any) => a.id === agentId);
    if (agent) setSelectedAgent(agent);
  }, [agents]);

  const filteredAgents = agents.filter((agent: any) => {
    const matchesSearch = !searchQuery || agent.name.toLowerCase().includes(searchQuery.toLowerCase()) || agent.specialty.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || agent.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

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
          balance={userBalance}
          requiredAmount={requiredBalance}
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
        />
        <main id="main-content" className="max-w-md mx-auto pb-28" role="main">
          {inCall && selectedAgent && callId ? (
            <ActiveCall
              agent={{ id: selectedAgent.id, name: selectedAgent.name, specialty: selectedAgent.specialty, avatar: selectedAgent.avatar, rate: selectedAgent.rate, color: selectedAgent.color }}
              callId={callId}
              userId={address || 'anonymous'}
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
