// ============================================
// Voice Agent Hotline Experience
// ============================================

'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAgentVoice } from '@/lib/useAgentVoice';
import { createAgentPersonality, DEFAULT_AGENT_PERSONALITY } from '@/lib/agent-voice';
import { StreamingPaymentModal } from '@/components/StreamingPaymentModal';
import { AnimatedPaymentFlow } from '@/components/AnimatedPaymentFlow';
import { AgentComparison } from '@/components/AgentComparison';
import { CallEstimator } from '@/components/CallEstimator';
import { AgentToAgentChat } from '@/components/AgentToAgentChat';
import { RateLimitPanel } from '@/components/RateLimitDisplay';
import { useRealAgents } from '@/lib/useRealAgents';
import { getDirectPaymentReadiness, getStreamingReadiness } from '@/lib/product-readiness';
import { buildCallLaunchHref } from '@/lib/product-launch';

const HERO_MODES = [
  {
    id: 'golden',
    label: 'Golden Path',
    description: 'Start a paid call in minutes',
  },
  {
    id: 'comparison',
    label: 'Compare Agents',
    description: 'Side-by-side capabilities',
  },
  {
    id: 'agent_chat',
    label: 'Agent-to-Agent',
    description: 'Delegation in action',
  },
  {
    id: 'rate_limit',
    label: 'Rate Limits',
    description: 'Trust + abuse protection',
  },
] as const;

const PAYMENT_MODES = [
  {
    id: 'x402',
    label: 'x402 Direct',
    description: 'Pay per call segment',
    highlight: 'Recommended',
  },
  {
    id: 'streaming',
    label: 'Superfluid Streaming',
    description: 'Pay per second',
    highlight: 'Continuous',
  },
] as const;

export default function VoiceAgentExperiencePage() {
  const router = useRouter();
  const { agents, isLoading } = useRealAgents();
  const [apiKey, setApiKey] = useState('');
  const [agentId, setAgentId] = useState('');
  const [textInput, setTextInput] = useState('');
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [heroMode, setHeroMode] = useState<(typeof HERO_MODES)[number]['id']>('golden');
  const [paymentMode, setPaymentMode] = useState<(typeof PAYMENT_MODES)[number]['id']>('x402');
  const recordingInterval = useRef<NodeJS.Timeout | null>(null);
  const selectedAgent = agents.find((agent) => agent.id === agentId) || agents[0];
  const previewPersonality = selectedAgent ? createAgentPersonality(selectedAgent) : DEFAULT_AGENT_PERSONALITY;
  const comparisonAgents = (agents.length > 0 ? agents : [
    {
      id: DEFAULT_AGENT_PERSONALITY.id,
      name: DEFAULT_AGENT_PERSONALITY.name,
      specialty: DEFAULT_AGENT_PERSONALITY.specialty,
      rating: DEFAULT_AGENT_PERSONALITY.rating,
      rate: DEFAULT_AGENT_PERSONALITY.pricePerMinute,
      avatar: DEFAULT_AGENT_PERSONALITY.avatar,
      voiceId: DEFAULT_AGENT_PERSONALITY.voiceId,
      category: 'general',
    },
  ]).map(createAgentPersonality);
  const chatAgents = (agents.length > 0 ? agents : []).slice(0, 2).map((agent) => ({
    id: agent.id,
    name: agent.name,
    avatar: agent.avatar || 'A',
    specialty: agent.specialty,
  }));
  const directReadiness = getDirectPaymentReadiness(selectedAgent?.walletAddress);
  const streamingReadiness = getStreamingReadiness(selectedAgent?.walletAddress);

  const {
    isSpeaking,
    isGenerating,
    error,
    currentResponse,
    speak,
    setPersonality,
    generateGreeting,
  } = useAgentVoice(apiKey || 'preview-key', previewPersonality);

  useEffect(() => {
    if (!agentId && agents.length > 0) {
      setAgentId(agents[0].id);
    }
  }, [agentId, agents]);

  useEffect(() => {
    setPersonality(previewPersonality);
  }, [previewPersonality, setPersonality]);

  const handleSendMessage = async () => {
    if (!textInput.trim()) return;
    await speak(textInput);
    setTextInput('');
  };

  const startRecording = () => {
    setIsRecording(true);
    setRecordingDuration(0);
    setTranscription('🎤 Listening for your request…');
    recordingInterval.current = setInterval(() => {
      setRecordingDuration((d) => d + 1);
    }, 1000);
  };

  const stopRecording = () => {
    setIsRecording(false);
    if (recordingInterval.current) {
      clearInterval(recordingInterval.current);
    }
    setTranscription(`Captured ${recordingDuration}s of voice input. Ready to send.`);
  };

  const personality = previewPersonality;
  const streamingDisabled = !streamingReadiness.ready;
  const launchDisabled = !selectedAgent || (paymentMode === 'streaming' && streamingDisabled);
  const launchLabel = paymentMode === 'streaming'
    ? (streamingDisabled ? 'Streaming Not Ready' : 'Launch Real Streaming Call')
    : 'Launch Real x402 Call';

  const launchProductCall = () => {
    if (!selectedAgent || launchDisabled) {
      return;
    }

    router.push(buildCallLaunchHref({ agentId: selectedAgent.id, paymentMode }));
  };

  const renderHeroCanvas = () => {
    if (heroMode === 'comparison') {
      return (
        <div className="hero-panel">
          <div className="panel-header">
            <h3>Compare agents in seconds</h3>
            <p>Choose who gets the call based on price, rating, and specialty.</p>
          </div>
          <AgentComparison agents={comparisonAgents} />
        </div>
      );
    }

    if (heroMode === 'agent_chat') {
      return (
        <div className="hero-panel">
          <div className="panel-header">
            <h3>Delegated agents collaborating live</h3>
            <p>ERC-8004 delegation enables agents to coordinate tasks on your behalf.</p>
          </div>
          <AgentToAgentChat agents={chatAgents} />
        </div>
      );
    }

    if (heroMode === 'rate_limit') {
      return (
        <div className="hero-panel">
          <div className="panel-header">
            <h3>Built-in trust & abuse protection</h3>
            <p>Rate limiting, settlement checks, and reputation safeguards are always on.</p>
          </div>
          <RateLimitPanel />
        </div>
      );
    }

    return (
      <div className="golden-grid" id="golden-path">
        <div className="step-card">
          <div className="step-header">
            <span className="step-index">1</span>
            <div>
              <h3>Pick your agent</h3>
              <p>Every agent has a verified specialty and live pricing.</p>
            </div>
          </div>
          <div className="config-section">
            <div className="config-card">
              <div className="input-group">
                <label>ElevenLabs API Key (optional)</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Bring your own ElevenLabs key"
                />
                <span className="hint">Use the built-in preview voice if you skip this.</span>
              </div>
              <div className="input-group">
                <label>Select Agent</label>
                <select value={agentId} onChange={(e) => setAgentId(e.target.value)}>
                  {agents.length === 0 ? (
                    <option value="">Loading agents…</option>
                  ) : (
                    agents.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name} — {agent.specialty}
                      </option>
                    ))
                  )}
                </select>
                <span className="hint">{isLoading ? 'Loading live agents…' : 'This list matches the real product catalog.'}</span>
              </div>
            </div>

            <div className="config-card agent-card">
              <div className="agent-avatar">
                {personality.avatar || '👤'}
              </div>
              <div className="agent-details">
                <h3>{personality.name}</h3>
                <p className="specialty">{personality.specialty}</p>
                <div className="agent-meta">
                  <span className="rating">⭐ {(Number(personality.rating) || 0).toFixed(2)}</span>
                  <span className="price">${personality.pricePerMinute}/min</span>
                </div>
                <p className="style">{personality.speakingStyle} voice · {personality.pace} pace</p>
              </div>
            </div>
          </div>
        </div>

        <div className="step-card">
          <div className="step-header">
            <span className="step-index">2</span>
            <div>
              <h3>Select payment mode</h3>
              <p>Switch between x402 direct and Superfluid streaming.</p>
            </div>
          </div>

          <div className="payment-modes">
            {PAYMENT_MODES.map((mode) => (
              <button
                key={mode.id}
                onClick={() => setPaymentMode(mode.id)}
                className={`payment-option ${paymentMode === mode.id ? 'active' : ''}`}
                aria-pressed={paymentMode === mode.id}
              >
                <div>
                  <h4>{mode.label}</h4>
                  <p>{mode.description}</p>
                </div>
                <span className="mode-tag">{mode.highlight}</span>
              </button>
            ))}
          </div>

          <CallEstimator pricePerMinute={personality.pricePerMinute} />

          {paymentMode === 'x402' ? (
            <>
              <AnimatedPaymentFlow agentName={personality.name} pricePerMinute={personality.pricePerMinute} />
              <div className="readiness-card">
                <strong>{directReadiness.ready ? 'Direct payments ready' : 'Direct payment setup required'}</strong>
                <span>{directReadiness.issues[0] || 'Agent payout routing is available for real launches.'}</span>
              </div>
            </>
          ) : (
            <div className="streaming-wrapper">
              {streamingDisabled ? (
                <div className="notice">
                  <strong>Streaming is not launch-ready yet.</strong>
                  <span>{streamingReadiness.issues[0]}</span>
                </div>
              ) : (
                <StreamingPaymentModal
                  agentName={personality.name}
                  agentAddress={streamingReadiness.receiverAddress || ''}
                  ratePerMinute={personality.pricePerMinute}
                  onPaymentStart={() => console.log('Streaming started')}
                  onPaymentStop={() => console.log('Streaming stopped')}
                />
              )}
              <div className="readiness-card warning">
                <strong>Streaming readiness</strong>
                <span>{streamingReadiness.ready ? 'Ready for wallet-signed live launches.' : streamingReadiness.issues.join(' • ')}</span>
              </div>
            </div>
          )}
        </div>

        <div className="step-card full">
          <div className="step-header">
            <span className="step-index">3</span>
            <div>
              <h3>Speak & pay in real time</h3>
              <p>Preview the conversation before you connect a full call.</p>
            </div>
          </div>

          <div className="voice-section">
            <div className="recording-area">
              <div className="transcription-box">
                {transcription || 'Type or record a message to preview the agent response…'}
              </div>
              <div className="recording-controls">
                <button
                  className={`record-btn ${isRecording ? 'recording' : ''}`}
                  onClick={isRecording ? stopRecording : startRecording}
                >
                  {isRecording ? '⏹️ Stop' : '🎙️ Record'}
                </button>
                {isRecording && (
                  <div className="recording-indicator">
                    <span className="pulse"></span>
                    {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')}
                  </div>
                )}
              </div>
            </div>

            <div className="text-input-area">
              <textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Or type your message here…"
                rows={3}
              />
              <div className="button-group">
                <button
                  onClick={generateGreeting}
                  disabled={isGenerating}
                  className="secondary"
                >
                  {isGenerating ? '⏳…' : '👋 Generate Greeting'}
                </button>
                <button
                  onClick={handleSendMessage}
                  disabled={isGenerating || !textInput.trim()}
                  className="primary"
                >
                  {isGenerating ? '⏳ Generating…' : 'Send to Agent'}
                </button>
              </div>
            </div>

            {(currentResponse || error) && (
              <div className={`response-card ${error ? 'error' : 'success'}`}>
                <div className="waveform">
                  {[...Array(20)].map((_, i) => (
                    <div
                      key={i}
                      className={`bar ${isSpeaking ? 'animate' : ''}`}
                      style={{ animationDelay: `${i * 0.05}s` }}
                    ></div>
                  ))}
                </div>
                {error ? (
                  <p className="error-text">❌ {error}</p>
                ) : (
                  <div className="response-content">
                    <p><strong>Response:</strong> {currentResponse?.text}</p>
                    <div className="response-meta">
                      <span>⏱️ {(currentResponse?.duration || 0).toFixed(2)}s</span>
                      <span>🔊 {isSpeaking ? 'Playing' : 'Stopped'}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="experience-shell">
      <section className="hero">
        <div className="hero-intro">
          <div className="eyebrow">Celo-native voice agents</div>
          <h1>Voice Agent Hotline</h1>
          <p>
            Talk to verified AI agents. Pay per second with Celo stablecoins.
            Build real-world actions with on-chain trust.
          </p>
          <div className="hero-actions">
            <button className="primary" onClick={launchProductCall} disabled={launchDisabled}>
              {launchLabel}
            </button>
            <a href="#golden-path" className="secondary">See how it works</a>
          </div>
          <p className="hero-meta">
            {selectedAgent ? `Launching ${selectedAgent.name} on the real app with ${paymentMode === 'streaming' ? 'streaming' : 'x402 direct'}.` : 'Choose an agent to launch the real product path.'}
          </p>
          <div className="hero-chips">
            <span>x402 payments</span>
            <span>ERC-8004 delegation</span>
            <span>Agent Skills framework</span>
            <span>Superfluid streaming</span>
          </div>
        </div>

        <div className="hero-switcher">
          {HERO_MODES.map((mode) => (
            <button
              key={mode.id}
              onClick={() => setHeroMode(mode.id)}
              className={heroMode === mode.id ? 'active' : ''}
              aria-pressed={heroMode === mode.id}
            >
              <span className="mode-label">{mode.label}</span>
              <span className="mode-desc">{mode.description}</span>
            </button>
          ))}
        </div>

        <div className="hero-canvas">
          {renderHeroCanvas()}
        </div>
      </section>

      <style jsx>{`
        .experience-shell {
          position: relative;
          min-height: 100vh;
          padding: 48px 20px 80px;
          color: #e2e8f0;
          background:
            radial-gradient(60% 60% at 10% 10%, rgba(34, 211, 238, 0.18), transparent 60%),
            radial-gradient(60% 60% at 90% 0%, rgba(251, 191, 36, 0.12), transparent 55%),
            radial-gradient(50% 50% at 70% 80%, rgba(16, 185, 129, 0.12), transparent 60%),
            #0b1117;
          overflow-x: hidden;
        }
        .hero {
          max-width: 1100px;
          margin: 0 auto;
          display: grid;
          gap: 32px;
        }
        .hero-intro {
          display: grid;
          gap: 16px;
          text-align: left;
          animation: fade-up 0.8s ease both;
        }
        .eyebrow {
          text-transform: uppercase;
          font-size: 12px;
          letter-spacing: 0.3em;
          color: #7dd3fc;
          font-weight: 600;
        }
        .hero-intro h1 {
          font-size: clamp(2.6rem, 4vw, 3.6rem);
          line-height: 1.05;
          margin: 0;
          font-weight: 700;
          color: #f8fafc;
        }
        .hero-intro p {
          max-width: 680px;
          color: #cbd5f5;
          font-size: 1rem;
          line-height: 1.6;
        }
        .hero-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
        }
        .hero-actions button,
        .hero-actions a {
          padding: 12px 18px;
          border-radius: 999px;
          font-size: 14px;
          font-weight: 600;
          text-decoration: none;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .hero-actions .primary {
          background: linear-gradient(135deg, #22d3ee, #0ea5e9);
          color: #0b1117;
          box-shadow: 0 12px 30px rgba(14, 165, 233, 0.25);
          border: none;
        }
        .hero-actions .primary:disabled {
          cursor: not-allowed;
          opacity: 0.5;
          box-shadow: none;
          transform: none;
        }
        .hero-actions .secondary {
          border: 1px solid rgba(148, 163, 184, 0.4);
          color: #e2e8f0;
        }
        .hero-actions button:hover,
        .hero-actions a:hover {
          transform: translateY(-1px);
        }
        .hero-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .hero-chips span {
          padding: 6px 12px;
          border-radius: 999px;
          font-size: 12px;
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(148, 163, 184, 0.3);
          color: #cbd5f5;
        }
        .hero-meta {
          max-width: 680px;
          font-size: 13px;
          color: #94a3b8;
          margin: -6px 0 0;
        }
        .hero-switcher {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 12px;
        }
        .hero-switcher button {
          background: rgba(15, 23, 42, 0.7);
          border: 1px solid rgba(148, 163, 184, 0.2);
          border-radius: 16px;
          padding: 14px 16px;
          text-align: left;
          color: #cbd5f5;
          transition: border-color 0.2s ease, background 0.2s ease;
        }
        .hero-switcher button.active {
          border-color: rgba(34, 211, 238, 0.8);
          background: rgba(14, 165, 233, 0.15);
          color: #f8fafc;
        }
        .mode-label {
          display: block;
          font-weight: 600;
          font-size: 14px;
        }
        .mode-desc {
          display: block;
          font-size: 12px;
          color: #94a3b8;
          margin-top: 4px;
        }
        .hero-canvas {
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(148, 163, 184, 0.2);
          border-radius: 24px;
          padding: 24px;
          box-shadow: 0 30px 60px rgba(2, 8, 23, 0.6);
          animation: fade-up 1s ease both;
        }
        .hero-panel {
          display: grid;
          gap: 16px;
        }
        .panel-header h3 {
          margin: 0;
          font-size: 20px;
          color: #f8fafc;
        }
        .panel-header p {
          margin: 6px 0 0;
          font-size: 14px;
          color: #94a3b8;
        }
        .golden-grid {
          display: grid;
          gap: 24px;
        }
        .step-card {
          background: rgba(2, 8, 23, 0.55);
          border: 1px solid rgba(148, 163, 184, 0.2);
          border-radius: 18px;
          padding: 20px;
        }
        .step-card.full {
          background: rgba(2, 8, 23, 0.7);
        }
        .step-header {
          display: flex;
          gap: 12px;
          margin-bottom: 16px;
          align-items: center;
        }
        .step-index {
          width: 32px;
          height: 32px;
          border-radius: 999px;
          background: rgba(34, 211, 238, 0.2);
          color: #67e8f9;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .step-header h3 {
          margin: 0;
          font-size: 18px;
          color: #f8fafc;
        }
        .step-header p {
          margin: 4px 0 0;
          font-size: 13px;
          color: #94a3b8;
        }
        .config-section {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 16px;
        }
        .config-card {
          background: rgba(15, 23, 42, 0.6);
          border-radius: 16px;
          padding: 18px;
          border: 1px solid rgba(148, 163, 184, 0.15);
        }
        .input-group {
          margin-bottom: 16px;
        }
        .input-group label {
          display: block;
          margin-bottom: 6px;
          font-weight: 500;
          font-size: 12px;
          color: #cbd5f5;
        }
        .input-group input,
        .input-group select {
          width: 100%;
          padding: 12px;
          border-radius: 12px;
          border: 1px solid rgba(148, 163, 184, 0.25);
          background: rgba(2, 6, 23, 0.7);
          color: #f8fafc;
          font-size: 13px;
        }
        .input-group input:focus,
        .input-group select:focus {
          outline: none;
          border-color: rgba(34, 211, 238, 0.8);
          box-shadow: 0 0 0 3px rgba(34, 211, 238, 0.15);
        }
        .hint {
          font-size: 11px;
          color: #64748b;
          margin-top: 4px;
          display: block;
        }
        .agent-card {
          display: flex;
          gap: 16px;
          align-items: center;
        }
        .agent-avatar {
          width: 64px;
          height: 64px;
          border-radius: 18px;
          background: linear-gradient(135deg, #22d3ee, #0ea5e9);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
        }
        .agent-details h3 {
          margin: 0 0 6px 0;
        }
        .specialty {
          color: #7dd3fc;
          font-size: 12px;
          margin: 0 0 8px 0;
        }
        .agent-meta {
          display: flex;
          gap: 12px;
          margin-bottom: 6px;
        }
        .rating,
        .price {
          font-size: 13px;
          font-weight: 600;
          color: #e2e8f0;
        }
        .style {
          font-size: 11px;
          color: #94a3b8;
        }
        .payment-modes {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 12px;
          margin-bottom: 16px;
        }
        .payment-option {
          border: 1px solid rgba(148, 163, 184, 0.2);
          background: rgba(15, 23, 42, 0.7);
          border-radius: 14px;
          padding: 14px 16px;
          text-align: left;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          color: #e2e8f0;
        }
        .payment-option.active {
          border-color: rgba(34, 211, 238, 0.8);
          background: rgba(14, 165, 233, 0.12);
        }
        .payment-option h4 {
          margin: 0 0 4px 0;
          font-size: 14px;
        }
        .payment-option p {
          margin: 0;
          font-size: 12px;
          color: #94a3b8;
        }
        .mode-tag {
          font-size: 10px;
          background: rgba(251, 191, 36, 0.2);
          color: #facc15;
          padding: 4px 8px;
          border-radius: 999px;
          border: 1px solid rgba(251, 191, 36, 0.3);
        }
        .notice {
          background: rgba(251, 191, 36, 0.12);
          border: 1px solid rgba(251, 191, 36, 0.3);
          border-radius: 12px;
          padding: 12px 14px;
          font-size: 12px;
          color: #facc15;
          display: grid;
          gap: 4px;
          margin-bottom: 12px;
        }
        .readiness-card {
          display: grid;
          gap: 4px;
          padding: 12px 14px;
          border-radius: 12px;
          background: rgba(34, 211, 238, 0.1);
          border: 1px solid rgba(34, 211, 238, 0.25);
          color: #bae6fd;
          font-size: 12px;
        }
        .readiness-card.warning {
          background: rgba(248, 113, 113, 0.1);
          border-color: rgba(248, 113, 113, 0.25);
          color: #fecaca;
        }
        .voice-section {
          display: grid;
          gap: 16px;
        }
        .transcription-box {
          background: rgba(2, 6, 23, 0.7);
          border: 1px solid rgba(148, 163, 184, 0.2);
          padding: 16px;
          border-radius: 14px;
          min-height: 60px;
          font-size: 14px;
          color: #cbd5f5;
        }
        .recording-controls {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .record-btn {
          padding: 12px 24px;
          border: none;
          border-radius: 999px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          background: linear-gradient(135deg, #22d3ee, #0ea5e9);
          color: #0b1117;
        }
        .record-btn.recording {
          background: #ef4444;
          color: #fff;
        }
        .recording-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 600;
          color: #f87171;
        }
        .pulse {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: #f87171;
          animation: blink 1s infinite;
        }
        .text-input-area textarea {
          width: 100%;
          padding: 14px;
          border: 1px solid rgba(148, 163, 184, 0.2);
          border-radius: 14px;
          background: rgba(2, 6, 23, 0.7);
          color: #e2e8f0;
          font-size: 14px;
          resize: none;
        }
        .button-group {
          display: flex;
          gap: 10px;
        }
        .button-group button {
          flex: 1;
          padding: 12px;
          border-radius: 12px;
          border: none;
          font-weight: 600;
          cursor: pointer;
        }
        .button-group button.primary {
          background: linear-gradient(135deg, #22d3ee, #0ea5e9);
          color: #0b1117;
        }
        .button-group button.secondary {
          background: rgba(148, 163, 184, 0.2);
          color: #e2e8f0;
        }
        .button-group button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .response-card {
          padding: 16px;
          border-radius: 14px;
          border: 1px solid rgba(148, 163, 184, 0.2);
          background: rgba(15, 23, 42, 0.6);
        }
        .response-card.success {
          border-color: rgba(34, 211, 238, 0.4);
        }
        .response-card.error {
          border-color: rgba(248, 113, 113, 0.5);
        }
        .waveform {
          display: flex;
          gap: 4px;
          justify-content: center;
          margin-bottom: 12px;
        }
        .waveform .bar {
          width: 4px;
          height: 18px;
          border-radius: 2px;
          background: linear-gradient(180deg, #22d3ee, #0ea5e9);
          opacity: 0.35;
        }
        .waveform .bar.animate {
          animation: wave 0.5s ease-in-out infinite;
        }
        .response-meta {
          display: flex;
          gap: 16px;
          font-size: 12px;
          color: #94a3b8;
          margin-top: 8px;
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @keyframes wave {
          0%, 100% { height: 10px; opacity: 0.3; }
          50% { height: 32px; opacity: 1; }
        }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (max-width: 720px) {
          .experience-shell {
            padding: 32px 16px 64px;
          }
          .hero-actions {
            flex-direction: column;
          }
          .hero-actions button,
          .hero-actions a {
            width: 100%;
            text-align: center;
          }
        }
      `}</style>
    </div>
  );
}
