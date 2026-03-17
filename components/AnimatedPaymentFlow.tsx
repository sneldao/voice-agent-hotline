// Animated Payment Flow Component
// Visualizes x402 and Superfluid payment flows

'use client';

import { useState, useEffect } from 'react';

interface AnimatedPaymentFlowProps {
  agentName: string;
  pricePerMinute: number;
}

export function AnimatedPaymentFlow({ agentName, pricePerMinute }: AnimatedPaymentFlowProps) {
  const [step, setStep] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isAnimating) {
      const interval = setInterval(() => {
        setStep((s) => {
          if (s >= 4) {
            setIsAnimating(false);
            return 0;
          }
          return s + 1;
        });
      }, 800);
      return () => clearInterval(interval);
    }
  }, [isAnimating]);

  const steps = [
    { icon: '👤', label: 'User initiates call', description: 'Requesting agent connection' },
    { icon: '📡', label: 'Verifying payment', description: 'Checking x402 authorization' },
    { icon: '💰', label: 'Locking funds', description: `${((pricePerMinute || 0) / 60 * 5).toFixed(3)} for 1 min` },
    { icon: '🔓', label: 'Agent connected', description: 'Streaming payment active' },
    { icon: '✅', label: 'Call complete', description: 'Settling final amount' },
  ];

  return (
    <div className="payment-flow-container">
      <div className="payment-flow-header">
        <span className="icon">💸</span>
        <h3>Payment Flow</h3>
        <button 
          className="play-btn"
          onClick={() => setIsAnimating(!isAnimating)}
        >
          {isAnimating ? '⏸️ Pause' : '▶️ Replay'}
        </button>
      </div>

      <div className="flow-timeline">
        {steps.map((s, i) => (
          <div 
            key={i} 
            className={`flow-step ${step >= i ? 'active' : ''} ${step === i && isAnimating ? 'current' : ''}`}
          >
            <div className="step-icon">
              {step === i && isAnimating ? (
                <span className="spinner">⏳</span>
              ) : (
                <span>{step > i ? '✓' : s.icon}</span>
              )}
            </div>
            <div className="step-content">
              <span className="step-label">{s.label}</span>
              <span className="step-desc">{s.description}</span>
            </div>
            {i < steps.length - 1 && (
              <div className="step-connector">
                <div className={`connector-line ${step > i ? 'completed' : ''}`}></div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flow-summary">
        <div className="summary-item">
          <span className="summary-label">x402 Payment</span>
          <span className="summary-value">${((pricePerMinute || 0) / 60 * 5).toFixed(3)}/min</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Superfluid</span>
          <span className="summary-value">${((pricePerMinute || 0) / 3600).toFixed(4)}/sec</span>
        </div>
      </div>

      <style jsx>{`
        .payment-flow-container {
          background: rgba(2, 6, 23, 0.55);
          border: 1px solid rgba(148, 163, 184, 0.25);
          border-radius: 16px;
          padding: 20px;
          margin-bottom: 20px;
        }
        .payment-flow-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 20px;
        }
        .payment-flow-header .icon {
          font-size: 20px;
        }
        .payment-flow-header h3 {
          flex: 1;
          margin: 0;
          font-size: 16px;
          color: #e2e8f0;
        }
        .play-btn {
          padding: 6px 12px;
          background: linear-gradient(135deg, #22d3ee, #0ea5e9);
          border: none;
          border-radius: 6px;
          color: #0b1117;
          font-size: 12px;
          cursor: pointer;
        }
        .flow-timeline {
          display: flex;
          flex-direction: column;
          gap: 0;
          margin-bottom: 20px;
        }
        .flow-step {
          display: flex;
          align-items: flex-start;
          gap: 15px;
          padding: 10px 0;
          opacity: 0.4;
          transition: all 0.3s;
        }
        .flow-step.active {
          opacity: 1;
        }
        .flow-step.current {
          background: rgba(34, 211, 238, 0.12);
          margin: 0 -10px;
          padding: 10px;
          border-radius: 8px;
        }
        .step-icon {
          width: 36px;
          height: 36px;
          background: rgba(15, 23, 42, 0.8);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          flex-shrink: 0;
        }
        .flow-step.active .step-icon {
          background: linear-gradient(135deg, #22d3ee, #0ea5e9);
          color: #0b1117;
        }
        .spinner {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .step-content {
          flex: 1;
        }
        .step-label {
          display: block;
          font-weight: 600;
          font-size: 13px;
          margin-bottom: 2px;
          color: #e2e8f0;
        }
        .step-desc {
          font-size: 11px;
          color: #94a3b8;
        }
        .step-connector {
          position: absolute;
          left: 27px;
          margin-top: 46px;
        }
        .connector-line {
          width: 2px;
          height: 20px;
          background: rgba(148, 163, 184, 0.25);
        }
        .connector-line.completed {
          background: linear-gradient(180deg, #22d3ee, #0ea5e9);
        }
        .flow-summary {
          display: flex;
          justify-content: space-around;
          padding-top: 15px;
          border-top: 1px solid rgba(148, 163, 184, 0.2);
        }
        .summary-item {
          text-align: center;
        }
        .summary-label {
          display: block;
          font-size: 11px;
          color: #94a3b8;
          margin-bottom: 4px;
        }
        .summary-value {
          font-weight: 600;
          color: #7dd3fc;
          font-size: 14px;
        }
      `}</style>
    </div>
  );
}
