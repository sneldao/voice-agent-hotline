'use client';

import { AgentRegistrationForm } from '@/components/ui/AgentCreation';

export default function ListYourAgentPage() {
  return (
    <main className="min-h-screen bg-[#0b0806] text-amber-50">
      {/* Hero */}
      <div className="border-b border-amber-100/15 bg-[#17100d]/85">
        <div className="max-w-2xl mx-auto px-4 py-12 text-center">
          <div className="text-4xl mb-4">🎙️</div>
          <h1 className="text-3xl font-bold text-white mb-3">List your agent</h1>
          <p className="text-amber-100/60 text-lg leading-relaxed">
            Bring your ElevenLabs conversational AI agent to the Voisss marketplace.
            Earn cUSD per minute, build on-chain reputation via ERC-8004, and reach
            users on Celo.
          </p>

          {/* Early access notice */}
          <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-left">
            <p className="text-sm text-amber-200">
              <span className="font-semibold">Early Access:</span>{' '}
              The VOISSS marketplace currently features a curated set of agents.
              Submitted agents are reviewed manually and onboarded on a rolling basis.
              Dynamic self-serve listing is on the roadmap.
            </p>
          </div>

          {/* How it works */}
          <div className="grid grid-cols-3 gap-4 mt-8 text-left">
            {[
              { step: '1', icon: '🔑', title: 'Connect your agent', body: 'Provide your ElevenLabs agent ID and system prompt.' },
              { step: '2', icon: '⏳', title: 'We review', body: 'Submissions are reviewed within 48 hours for quality.' },
              { step: '3', icon: '💰', title: 'Start earning', body: 'Go live and earn 80% of every call in cUSD on Celo.' },
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
