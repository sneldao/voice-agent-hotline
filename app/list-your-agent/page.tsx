'use client';

import { AgentRegistrationForm } from '@/components/ui/AgentCreation';

export default function ListYourAgentPage() {
  return (
    <main className="min-h-screen bg-gray-950 text-white">
      {/* Hero */}
      <div className="border-b border-gray-800 bg-gray-900/50">
        <div className="max-w-2xl mx-auto px-4 py-12 text-center">
          <div className="text-4xl mb-4">🎙️</div>
          <h1 className="text-3xl font-bold text-white mb-3">List your agent</h1>
          <p className="text-gray-400 text-lg leading-relaxed">
            Bring your ElevenLabs conversational AI agent to the Voisss marketplace.
            Earn cUSD per minute, build on-chain reputation via ERC-8004, and reach
            users on Celo.
          </p>

          {/* How it works */}
          <div className="grid grid-cols-3 gap-4 mt-8 text-left">
            {[
              { step: '1', icon: '🔑', title: 'Connect your agent', body: 'Provide your ElevenLabs agent ID and system prompt.' },
              { step: '2', icon: '⏳', title: 'We review', body: 'Submissions are reviewed within 48 hours for quality.' },
              { step: '3', icon: '💰', title: 'Start earning', body: 'Go live and earn 80% of every call in cUSD on Celo.' },
            ].map(({ step, icon, title, body }) => (
              <div key={step} className="bg-gray-800/40 rounded-xl p-4 border border-gray-700/40">
                <div className="text-2xl mb-2">{icon}</div>
                <div className="text-xs text-cyan-400 font-semibold mb-1">Step {step}</div>
                <div className="text-sm font-semibold text-white mb-1">{title}</div>
                <div className="text-xs text-gray-400">{body}</div>
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
