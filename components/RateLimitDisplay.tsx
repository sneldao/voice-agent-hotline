'use client';

import { useState, useEffect } from 'react';

interface RateLimitConfig {
  callsPerMinute: number;
  maxDuration: number;
  coolDown: number;
}

interface RateLimitDisplayProps {
  config: RateLimitConfig;
  currentUsage: {
    callsThisMinute: number;
    secondsUntilReset: number;
  };
}

export function RateLimitDisplay({ config, currentUsage }: RateLimitDisplayProps) {
  const [isAnimating, setIsAnimating] = useState(false);

  const usagePercent = (currentUsage.callsThisMinute / config.callsPerMinute) * 100;
  const isNearLimit = usagePercent >= 80;
  const isAtLimit = usagePercent >= 100;

  useEffect(() => {
    if (isNearLimit) {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [isNearLimit]);

  return (
    <div className={`rate-limit-container ${isNearLimit ? 'warning' : ''} ${isAtLimit ? 'error' : ''}`}>
      <div className="rate-limit-header">
        <span className="icon">🛡️</span>
        <h3>Rate Limiting</h3>
        <span className="badge">ERC-8004</span>
      </div>

      <div className="rate-limit-info">
        <div className="info-row">
          <span className="info-label">Calls/min</span>
          <span className="info-value">{config.callsPerMinute}</span>
        </div>
        <div className="info-row">
          <span className="info-label">Max duration</span>
          <span className="info-value">{config.maxDuration}s</span>
        </div>
        <div className="info-row">
          <span className="info-label">Cooldown</span>
          <span className="info-value">{config.coolDown}s</span>
        </div>
      </div>

      <div className="usage-display">
        <div className="usage-header">
          <span className="usage-label">Current Usage</span>
          <span className={`usage-value ${isAtLimit ? 'error' : ''}`}>
            {currentUsage.callsThisMinute} / {config.callsPerMinute}
          </span>
        </div>
        <div className="usage-bar">
          <div
            className={`usage-fill ${isNearLimit ? 'warning' : ''} ${isAtLimit ? 'error' : ''} ${isAnimating ? 'pulse' : ''}`}
            style={{ width: `${Math.min(usagePercent, 100)}%` }}
          />
        </div>
        {isNearLimit && (
          <div className={`limit-warning ${isAtLimit ? 'critical' : ''}`}>
            {isAtLimit ? (
              <>
                <span>🚫</span> Rate limit reached. Cool down in {currentUsage.secondsUntilReset}s
              </>
            ) : (
              <>
                <span>⚠️</span> Approaching limit ({Math.round(usagePercent)}%)
              </>
            )}
          </div>
        )}
      </div>

      <div className="redis-status">
        <span className="status-icon">✅</span>
        <span>Upstash Redis</span>
        <span className="status-badge">Active</span>
      </div>

      <style jsx>{`
        .rate-limit-container {
          background: rgba(2, 6, 23, 0.55);
          border: 1px solid rgba(148, 163, 184, 0.25);
          border-radius: 16px;
          padding: 24px;
          margin: 20px 0;
          transition: all 0.3s;
        }
        .rate-limit-container.warning {
          background: rgba(251, 191, 36, 0.12);
          border-color: rgba(234, 179, 8, 0.5);
        }
        .rate-limit-container.error {
          background: rgba(248, 113, 113, 0.12);
          border-color: rgba(239, 68, 68, 0.5);
        }
        .rate-limit-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 20px;
        }
        .rate-limit-header .icon {
          font-size: 24px;
        }
        .rate-limit-header h3 {
          margin: 0;
          font-size: 18px;
          color: #f8fafc;
        }
        .rate-limit-header .badge {
          margin-left: auto;
          padding: 4px 10px;
          background: rgba(34, 211, 238, 0.2);
          color: #7dd3fc;
          border-radius: 20px;
          font-size: 11px;
        }
        .rate-limit-info {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-bottom: 20px;
        }
        .info-row {
          text-align: center;
          padding: 12px;
          background: rgba(15, 23, 42, 0.65);
          border-radius: 10px;
        }
        .info-label {
          display: block;
          font-size: 11px;
          color: #94a3b8;
          margin-bottom: 4px;
        }
        .info-value {
          font-size: 18px;
          font-weight: 700;
          color: #7dd3fc;
        }
        .usage-display {
          background: rgba(15, 23, 42, 0.65);
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 16px;
        }
        .usage-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 10px;
        }
        .usage-label {
          font-size: 14px;
          color: #94a3b8;
        }
        .usage-value {
          font-weight: 600;
          color: #7dd3fc;
        }
        .usage-value.error {
          color: #ef4444;
        }
        .usage-bar {
          height: 8px;
          background: rgba(148, 163, 184, 0.2);
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: 10px;
        }
        .usage-fill {
          height: 100%;
          background: linear-gradient(90deg, #22d3ee, #0ea5e9);
          border-radius: 4px;
          transition: width 0.3s ease;
        }
        .usage-fill.warning {
          background: linear-gradient(90deg, #eab308, #f59e0b);
        }
        .usage-fill.error {
          background: linear-gradient(90deg, #ef4444, #f43f5e);
        }
        .usage-fill.pulse {
          animation: pulse-bar 0.5s ease;
        }
        @keyframes pulse-bar {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        .limit-warning {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: #eab308;
          animation: fade-in 0.3s ease;
        }
        .limit-warning.critical {
          color: #ef4444;
        }
        .redis-status {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px;
          background: rgba(34, 211, 238, 0.1);
          border-radius: 10px;
          font-size: 13px;
        }
        .status-icon {
          font-size: 16px;
        }
        .status-badge {
          margin-left: auto;
          padding: 4px 10px;
          background: #22d3ee;
          color: #0b1117;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}

// Interactive panel for showcasing rate limiting
export function RateLimitPanel() {
  const [usage, setUsage] = useState({ callsThisMinute: 3, secondsUntilReset: 45 });

  const config: RateLimitConfig = {
    callsPerMinute: 10,
    maxDuration: 300,
    coolDown: 60,
  };

  return (
    <div>
      <RateLimitDisplay config={config} currentUsage={usage} />
      
      <div className="control-bar">
        <button
          onClick={() => setUsage(u => ({ ...u, callsThisMinute: Math.min(u.callsThisMinute + 1, 10) }))}
          className="control-btn"
        >
          + Simulate Call
        </button>
        <button
          onClick={() => setUsage({ callsThisMinute: 0, secondsUntilReset: 60 })}
          className="control-btn reset"
        >
          ↺ Reset
        </button>
      </div>

      <style jsx>{`
        .control-bar {
          display: flex;
          gap: 12px;
          margin-top: 16px;
        }
        .control-btn {
          flex: 1;
          padding: 12px;
          background: linear-gradient(135deg, #06b6d4, #3b82f6);
          border: none;
          border-radius: 10px;
          color: white;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.2s;
        }
        .control-btn:hover {
          transform: translateY(-2px);
        }
        .control-btn.reset {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  );
}
