'use client';

import { AgentRegistrationForm } from '@/components/ui/AgentCreation';
import { Header } from '@/components/Header';
import { useWallet } from '@/lib/WalletContextNew';
import { useUserBalance } from '@/lib/useSWR';

export default function ListYourBrokerPage() {
  const { connected, address, isConnecting, connect, disconnect, formatAddress } = useWallet();
  const { balance: userBalance } = useUserBalance(address);

  return (
    <main className="min-h-screen bg-[#0b0806] text-amber-50">
      <Header
        connected={connected}
        userBalance={userBalance || 0}
        isConnecting={isConnecting}
        formatAddress={formatAddress}
        onConnect={connect}
        onDisconnect={disconnect}
      />
      {/* Hero */}
      <div className="border-b border-amber-100/15 bg-[#17100d]/85">
        <div className="max-w-2xl mx-auto px-4 py-12 text-center">
          <div className="text-4xl mb-4">🎙️</div>
          <h1 className="text-3xl font-bold text-white mb-3">List your broker</h1>
          <p className="text-amber-100/60 text-lg leading-relaxed">
            Bring a voice broker to the Claflin desk. Start with tokenized-stock
            quotes and paper trading; real-money execution will ride on regulated
            brokerage integrations once the experience is proven.
          </p>

          {/* Early access notice */}
          <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-left">
            <p className="text-sm text-amber-200">
              <span className="font-semibold">Early Access:</span>{' '}
              The Claflin desk currently features Hetty and a curated set of brokers.
              Submitted brokers are reviewed manually and onboarded on a rolling basis.
              Dynamic self-serve listing is on the roadmap.
            </p>
          </div>

          {/* How it works */}
          <div className="grid grid-cols-3 gap-4 mt-8 text-left">
            {[
              { step: '1', icon: '🔑', title: 'Connect your broker', body: 'Provide your ElevenLabs agent ID and a broker-focused system prompt.' },
              { step: '2', icon: '⏳', title: 'We review', body: 'Submissions are reviewed for safety, voice quality, and execution discipline.' },
              { step: '3', icon: '💰', title: 'Start earning', body: 'Go live. Call revenue is settled in USDC; your share is ledgered for payout.' },
            ].map(({ step, icon, title, body }) => (
              <div key={step} className="operator-panel rounded-xl p-4 border border-amber-100/15">
                <div className="text-2xl mb-2">{icon}</div>
                <div className="text-xs text-red-400 font-semibold mb-1">Step {step}</div>
                <div className="text-sm font-semibold text-amber-50 mb-1">{title}</div>
                <div className="text-xs text-amber-100/50">{body}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-2xl mx-auto px-4 py-12">
        <AgentRegistrationForm />
      </div>
    </main>
  );
}
