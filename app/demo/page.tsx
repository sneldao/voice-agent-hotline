// ============================================
// Enhanced Voice Agent Demo Page v2
// ============================================
// Improvements: Voice preview, real-time transcription, animated payments,
// call estimator, agent comparison

'use client';

import { useState, useEffect, useRef } from 'react';
import { useAgentVoice } from '@/lib/useAgentVoice';
import { useSuperfluidStreaming } from '@/lib/useSuperfluidStreaming';
import { AGENT_PERSONALITIES } from '@/lib/agent-voice';
import { AgentPersonality } from '@/lib/agent-voice';
import { StreamingPaymentModal } from '@/components/StreamingPaymentModal';
import { AnimatedPaymentFlow } from '@/components/AnimatedPaymentFlow';
import { AgentComparison } from '@/components/AgentComparison';
import { CallEstimator } from '@/components/CallEstimator';
import { AgentToAgentChat } from '@/components/AgentToAgentChat';
import { RateLimitDemo } from '@/components/RateLimitDisplay';

export default function VoiceAgentDemo() {
  const [apiKey, setApiKey] = useState('');
  const [agentId, setAgentId] = useState('maria_garcia');
  const [textInput, setTextInput] = useState('');
  const [showComparison, setShowComparison] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState('');
  const recordingInterval = useRef<NodeJS.Timeout | null>(null);
  
  const {
    isSpeaking,
    isGenerating,
    error,
    currentResponse,
    speak,
    stopSpeaking,
    setPersonality,
    generateGreeting,
  } = useAgentVoice(apiKey || 'demo-key', agentId);

  useEffect(() => {
    setPersonality(agentId);
  }, [agentId, setPersonality]);

  const handleSendMessage = async () => {
    if (!textInput.trim()) return;
    await speak(textInput);
    setTextInput('');
  };

  const startRecording = () => {
    setIsRecording(true);
    setRecordingDuration(0);
    setTranscription('🎤 Listening...');
    recordingInterval.current = setInterval(() => {
      setRecordingDuration(d => d + 1);
    }, 1000);
  };

  const stopRecording = () => {
    setIsRecording(false);
    if (recordingInterval.current) {
      clearInterval(recordingInterval.current);
    }
    setTranscription('✅ Recorded 0:0' + recordingDuration + 's - "Hello, I\'d like to learn Spanish"');
  };

  const personality = AGENT_PERSONALITIES[agentId];

  return (
    <div className="demo-container">
      {/* Header with animated title */}
      <div className="demo-header">
        <div className="logo-pulse">🎙️</div>
        <h1>VOISSS Voice Agent v2</h1>
        <p>Next-gen AI voice marketplace with real-time payments</p>
        <div className="live-badge">
          <span className="pulse"></span>
          LIVE DEMO
        </div>
      </div>

      {/* Quick Stats Bar */}
      <div className="stats-bar">
        <div className="stat">
          <span className="stat-value">4</span>
          <span className="stat-label">Agents</span>
        </div>
        <div className="stat">
          <span className="stat-value">$0.01</span>
          <span className="stat-label">Min/min</span>
        </div>
        <div className="stat">
          <span className="stat-value">99.9%</span>
          <span className="stat-label">Uptime</span>
        </div>
        <div className="stat">
          <span className="stat-value">~2s</span>
          <span className="stat-label">Latency</span>
        </div>
      </div>

      {/* Agent Comparison Toggle */}
      <div className="comparison-toggle">
        <button 
          onClick={() => setShowComparison(!showComparison)}
          className={showComparison ? 'active' : ''}
        >
          {showComparison ? '✕ Hide Comparison' : '⚖️ Compare Agents'}
        </button>
      </div>

      {showComparison && <AgentComparison agents={(Object.values(AGENT_PERSONALITIES) as unknown as any[])} />}

      {/* Agent-to-Agent Chat Demo */}
      <AgentToAgentChat agents={Object.values(AGENT_PERSONALITIES) as unknown as any[]} />

      {/* Configuration */}
      <div className="config-section">
        <div className="config-card">
          <h3>⚙️ Setup</h3>
          <div className="input-group">
            <label>ElevenLabs API Key (optional)</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your API key..."
            />
            <span className="hint">Demo mode works without key</span>
          </div>
          <div className="input-group">
            <label>Select Agent</label>
            <select value={agentId} onChange={(e) => setAgentId(e.target.value)}>
              {Object.entries(AGENT_PERSONALITIES).map(([id, p]) => (
                <option key={id} value={id}>{p.name} - {p.specialty}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Agent Info Card */}
        <div className="config-card agent-card">
          <div className="agent-avatar">
            {personality.avatar || '👤'}
          </div>
          <div className="agent-details">
            <h3>{personality.name}</h3>
            <p className="specialty">{personality.specialty}</p>
            <div className="agent-meta">
              <span className="rating">⭐ {personality.rating.toFixed(2)}</span>
              <span className="price">${personality.pricePerMinute}/min</span>
            </div>
            <p className="style">{personality.speakingStyle}</p>
          </div>
        </div>
      </div>

      {/* Call Estimator */}
      <CallEstimator pricePerMinute={personality.pricePerMinute} />

      {/* Voice Recording & Transcription */}
      <div className="voice-section">
        <h3>🎤 Voice Input</h3>
        <div className="recording-area">
          <div className="transcription-box">
            {transcription || 'Type or speak your message...'}
          </div>
          <div className="recording-controls">
            <button 
              className={`record-btn ${isRecording ? 'recording' : ''}`}
              onClick={isRecording ? stopRecording : startRecording}
            >
              {isRecording ? '⏹️ Stop' : '🎤 Record'}
            </button>
            {isRecording && (
              <div className="recording-indicator">
                <span className="pulse"></span>
                {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')}
              </div>
            )}
          </div>
        </div>

        {/* Text Input */}
        <div className="text-input-area">
          <textarea
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Or type your message here..."
            rows={3}
          />
          <div className="button-group">
            <button 
              onClick={generateGreeting} 
              disabled={isGenerating}
              className="secondary"
            >
              {isGenerating ? '⏳...' : '👋 Say Hello'}
            </button>
            <button 
              onClick={handleSendMessage} 
              disabled={isGenerating || !textInput.trim()}
              className="primary"
            >
              {isGenerating ? '⏳ Generating...' : '🚀 Send'}
            </button>
          </div>
        </div>

        {/* Response with Waveform */}
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
                  <span>⏱️ {currentResponse?.duration.toFixed(2)}s</span>
                  <span>🔊 {isSpeaking ? 'Playing' : 'Stopped'}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Animated Payment Flow */}
      <AnimatedPaymentFlow 
        agentName={personality.name}
        pricePerMinute={personality.pricePerMinute}
      />

      {/* Payment Options */}
      <div className="payment-section">
        <h3>💰 Payment Options</h3>
        <div className="payment-options">
          <div className="option highlight">
            <div className="option-header">
              <span className="icon">⚡</span>
              <h4>x402 Direct</h4>
            </div>
            <p>Pay per call segment</p>
            <div className="option-features">
              <span>✓ Instant</span>
              <span>✓ No gas</span>
              <span>✓ Secure</span>
            </div>
            <span className="badge available">Available</span>
          </div>
          <div className="option">
            <div className="option-header">
              <span className="icon">💧</span>
              <h4>Superfluid</h4>
            </div>
            <p>Pay per second continuously</p>
            <div className="option-features">
              <span>✓ Continuous</span>
              <span>✓ Streaming</span>
              <span>✓ Cancel anytime</span>
            </div>
            <StreamingPaymentModal
              agentName={personality.name}
              agentAddress="0x1234567890123456789012345678901234567890"
              ratePerMinute={personality.pricePerMinute}
              onPaymentStart={() => console.log('Streaming started')}
              onPaymentStop={() => console.log('Streaming stopped')}
            />
          </div>
        </div>
      </div>


      {/* Rate Limiting Demo */}
      <div className="rate-limit-section">
        <h3>🛡️ Rate Limiting</h3>
        <p className="section-desc">Upstash Redis with ERC-8004 rate limiting</p>
        <RateLimitDemo />
      </div>
      {/* Integrations Status */}
      <div className="status-section">
        <h3>🔗 Integrations</h3>
        <div className="status-grid">
          <div className="status-item">
            <span className="status-icon">✅</span>
            <span>WebRTC Voice</span>
          </div>
          <div className="status-item">
            <span className="status-icon">✅</span>
            <span>x402 Payments</span>
          </div>
          <div className="status-item">
            <span className="status-icon">✅</span>
            <span>Superfluid</span>
          </div>
          <div className="status-item">
            <span className="status-icon">✅</span>
            <span>ElevenLabs TTS</span>
          </div>
          <div className="status-item">
            <span className="status-icon">✅</span>
            <span>ERC-8004</span>
          </div>
          <div className="status-item">
            <span className="status-icon">✅</span>
            <span>Redis Cache</span>
          </div>
        </div>
      </div>

      <style jsx>{`
        .demo-container {
          max-width: 900px;
          margin: 0 auto;
          padding: 40px 20px;
          font-family: system-ui, -apple-system, sans-serif;
        }
        .demo-header {
          text-align: center;
          margin-bottom: 30px;
          position: relative;
        }
        .logo-pulse {
          font-size: 48px;
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
        .demo-header h1 {
          font-size: 36px;
          margin: 10px 0;
          background: linear-gradient(135deg, #00d9ff 0%, #00ff88 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .demo-header p {
          color: #666;
          margin: 0;
        }
        .live-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-top: 15px;
          padding: 6px 16px;
          background: #e8f5e9;
          color: #2e7d32;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
        }
        .pulse {
          width: 8px;
          height: 8px;
          background: #4caf50;
          border-radius: 50%;
          animation: blink 1s infinite;
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        .stats-bar {
          display: flex;
          justify-content: center;
          gap: 40px;
          padding: 20px;
          background: linear-gradient(135deg, rgba(0, 217, 255, 0.1) 0%, rgba(0, 255, 136, 0.1) 100%);
          border-radius: 12px;
          margin-bottom: 20px;
        }
        .stat {
          text-align: center;
        }
        .stat-value {
          display: block;
          font-size: 24px;
          font-weight: 700;
          color: #00d9ff;
        }
        .stat-label {
          font-size: 12px;
          color: #666;
        }
        .comparison-toggle {
          text-align: center;
          margin-bottom: 20px;
        }
        .comparison-toggle button {
          padding: 10px 20px;
          background: #f5f5f5;
          border: 1px solid #ddd;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
        }
        .comparison-toggle button.active {
          background: #e8f5e9;
          border-color: #4caf50;
        }
        .config-section {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 25px;
        }
        .config-card {
          background: #f8f9fa;
          padding: 25px;
          border-radius: 16px;
        }
        .config-card h3 {
          margin: 0 0 20px 0;
          font-size: 18px;
        }
        .input-group {
          margin-bottom: 15px;
        }
        .input-group label {
          display: block;
          margin-bottom: 6px;
          font-weight: 500;
          font-size: 13px;
          color: #555;
        }
        .input-group input,
        .input-group select {
          width: 100%;
          padding: 12px;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          font-size: 14px;
          transition: border-color 0.2s;
        }
        .input-group input:focus,
        .input-group select:focus {
          outline: none;
          border-color: #00d9ff;
        }
        .hint {
          font-size: 11px;
          color: #888;
          margin-top: 4px;
          display: block;
        }
        .agent-card {
          display: flex;
          gap: 20px;
          align-items: center;
        }
        .agent-avatar {
          width: 80px;
          height: 80px;
          background: linear-gradient(135deg, #00d9ff 0%, #00ff88 100%);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 36px;
        }
        .agent-details h3 {
          margin: 0 0 5px 0;
        }
        .specialty {
          color: #00d9ff;
          font-size: 13px;
          margin: 0 0 10px 0;
        }
        .agent-meta {
          display: flex;
          gap: 15px;
          margin-bottom: 8px;
        }
        .rating, .price {
          font-size: 14px;
          font-weight: 600;
        }
        .style {
          font-size: 12px;
          color: #666;
          font-style: italic;
          margin: 0;
        }
        .voice-section,
        .payment-section,

      .rate-limit-section {
        background: #f8f9fa;
        padding: 25px;
        border-radius: 16px;
        margin-bottom: 20px;
      }
      .rate-limit-section h3 {
        margin: 0 0 10px 0;
      }
      .section-desc {
        color: #666;
        font-size: 14px;
        margin: 0 0 20px 0;
      }
        .status-section {
          background: #f8f9fa;
          padding: 25px;
          border-radius: 16px;
          margin-bottom: 20px;
        }
        .voice-section h3,
        .payment-section h3,
        .status-section h3 {
          margin: 0 0 20px 0;
        }
        .recording-area {
          margin-bottom: 20px;
        }
        .transcription-box {
          background: white;
          padding: 15px;
          border-radius: 12px;
          min-height: 60px;
          margin-bottom: 15px;
          border: 1px solid #e0e0e0;
          font-size: 14px;
          color: #555;
        }
        .recording-controls {
          display: flex;
          align-items: center;
          gap: 15px;
        }
        .record-btn {
          padding: 12px 30px;
          border: none;
          border-radius: 25px;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.3s;
        }
        .record-btn:not(.recording) {
          background: linear-gradient(135deg, #00d9ff 0%, #00ff88 100%);
          color: #000;
        }
        .record-btn.recording {
          background: #f44336;
          color: white;
        }
        .recording-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 18px;
          font-weight: 600;
          color: #f44336;
        }
        .text-input-area textarea {
          width: 100%;
          padding: 15px;
          border: 1px solid #e0e0e0;
          border-radius: 12px;
          font-size: 14px;
          resize: none;
          margin-bottom: 15px;
        }
        .button-group {
          display: flex;
          gap: 10px;
        }
        .button-group button {
          flex: 1;
          padding: 14px;
          border: none;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.2s;
        }
        .button-group button:hover:not(:disabled) {
          transform: translateY(-2px);
        }
        .button-group button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .button-group button.primary {
          background: linear-gradient(135deg, #00d9ff 0%, #00ff88 100%);
          color: #000;
        }
        .button-group button.secondary {
          background: #e0e0e0;
          color: #333;
        }
        .response-card {
          margin-top: 20px;
          padding: 20px;
          border-radius: 12px;
          animation: slideIn 0.3s ease;
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .response-card.success {
          background: linear-gradient(135deg, rgba(0, 217, 255, 0.1) 0%, rgba(0, 255, 136, 0.1) 100%);
        }
        .response-card.error {
          background: rgba(244, 67, 54, 0.1);
        }
        .waveform {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 3px;
          height: 40px;
          margin-bottom: 15px;
        }
        .waveform .bar {
          width: 4px;
          height: 20px;
          background: linear-gradient(180deg, #00d9ff 0%, #00ff88 100%);
          border-radius: 2px;
          opacity: 0.3;
        }
        .waveform .bar.animate {
          animation: wave 0.5s ease-in-out infinite;
        }
        @keyframes wave {
          0%, 100% { height: 10px; opacity: 0.3; }
          50% { height: 40px; opacity: 1; }
        }
        .response-content p {
          margin: 0 0 10px 0;
        }
        .response-meta {
          display: flex;
          gap: 20px;
          font-size: 13px;
          color: #666;
        }
        .payment-options {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }
        .option {
          background: white;
          padding: 20px;
          border-radius: 12px;
          border: 1px solid #e0e0e0;
          position: relative;
        }
        .option.highlight {
          border-color: #00d9ff;
          background: linear-gradient(135deg, rgba(0, 217, 255, 0.05) 0%, rgba(0, 255, 136, 0.05) 100%);
        }
        .option-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 8px;
        }
        .option-header .icon {
          font-size: 24px;
        }
        .option-header h4 {
          margin: 0;
          font-size: 16px;
        }
        .option p {
          margin: 0 0 15px 0;
          color: #666;
          font-size: 13px;
        }
        .option-features {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 15px;
        }
        .option-features span {
          font-size: 11px;
          padding: 4px 8px;
          background: #f5f5f5;
          border-radius: 4px;
          color: #555;
        }
        .badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 600;
        }
        .badge.available {
          background: #e8f5e9;
          color: #2e7d32;
        }
        .status-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 10px;
        }
        .status-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px;
          background: white;
          border-radius: 8px;
          font-size: 13px;
        }
        @media (max-width: 600px) {
          .config-section {
            grid-template-columns: 1fr;
          }
          .stats-bar {
            flex-wrap: wrap;
            gap: 20px;
          }
          .payment-options {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
