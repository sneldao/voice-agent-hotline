'use client';

import { useState, useEffect } from 'react';

interface ReferralStats {
  code: string;
  referrals: number;
  earned: number;
}

export function ReferralSection() {
  const [referralCode, setReferralCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [showStats, setShowStats] = useState(false);

  // Generate or retrieve referral code
  useEffect(() => {
    const stored = localStorage.getItem('referralCode');
    if (stored) {
      setReferralCode(stored);
      // Simulated stats (would come from API)
      setStats({
        code: stored,
        referrals: Math.floor(Math.random() * 10),
        earned: parseFloat((Math.random() * 2).toFixed(3)),
      });
    } else {
      // Generate simple code
      const newCode = 'VH' + Math.random().toString(36).substring(2, 8).toUpperCase();
      localStorage.setItem('referralCode', newCode);
      setReferralCode(newCode);
      setStats({ code: newCode, referrals: 0, earned: 0 });
    }
  }, []);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(`https://voice-agent-hotline.vercel.app?ref=${referralCode}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareTwitter = () => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
      '🎙️ Check out Voice Agent Hotline! Talk to AI agents, pay per second. Use my referral code: ' + referralCode
    )}&url=${encodeURIComponent('https://voice-agent-hotline.vercel.app')}`;
    window.open(url, '_blank');
  };

  const shareTelegram = () => {
    const url = `https://t.me/share/url?url=${encodeURIComponent('https://voice-agent-hotline.vercel.app')}&text=${encodeURIComponent(
      '🎙️ Voice Agent Hotline - Talk to AI agents, pay per second! Referral: ' + referralCode
    )}`;
    window.open(url, '_blank');
  };

  return (
    <div className="referral-section">
      <div className="referral-header">
        <span className="icon">🎁</span>
        <h3>Invite Friends</h3>
      </div>

      <p className="referral-desc">
        Share with friends and earn $0.01 for each successful referral!
      </p>

      <div className="referral-code-box">
        <span className="code-label">Your Referral Code</span>
        <div className="code-display">
          <span className="code">{referralCode || 'Generating...'}</span>
          <button className="copy-btn" onClick={copyToClipboard}>
            {copied ? '✓ Copied!' : '📋 Copy'}
          </button>
        </div>
      </div>

      <div className="share-buttons">
        <button className="share-btn twitter" onClick={shareTwitter}>
          <span>𝕏</span> Share on X
        </button>
        <button className="share-btn telegram" onClick={shareTelegram}>
          <span>✈️</span> Share on Telegram
        </button>
      </div>

      {showStats && stats && (
        <div className="referral-stats">
          <div className="stat-card">
            <span className="stat-value">{stats.referrals}</span>
            <span className="stat-label">Referrals</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">${(stats.earned || 0).toFixed(3)}</span>
            <span className="stat-label">Earned</span>
          </div>
        </div>
      )}

      <button className="toggle-stats" onClick={() => setShowStats(!showStats)}>
        {showStats ? 'Hide stats' : 'Show stats'}
      </button>

      <style jsx>{`
        .referral-section {
          background: linear-gradient(135deg, rgba(6, 182, 212, 0.1), rgba(59, 130, 246, 0.1));
          border: 1px solid rgba(6, 182, 212, 0.3);
          border-radius: 16px;
          padding: 24px;
          margin: 20px 0;
        }
        .referral-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 12px;
        }
        .referral-header .icon {
          font-size: 24px;
        }
        .referral-header h3 {
          margin: 0;
          font-size: 18px;
        }
        .referral-desc {
          color: #888;
          font-size: 14px;
          margin: 0 0 20px 0;
        }
        .referral-code-box {
          background: rgba(0, 0, 0, 0.2);
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 16px;
        }
        .code-label {
          font-size: 12px;
          color: #888;
          display: block;
          margin-bottom: 8px;
        }
        .code-display {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .code {
          font-size: 20px;
          font-weight: 700;
          font-family: monospace;
          letter-spacing: 2px;
        }
        .copy-btn {
          padding: 8px 16px;
          background: linear-gradient(135deg, #06b6d4, #3b82f6);
          border: none;
          border-radius: 8px;
          color: white;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.2s;
        }
        .copy-btn:hover {
          transform: scale(1.05);
        }
        .share-buttons {
          display: flex;
          gap: 12px;
          margin-bottom: 16px;
        }
        .share-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.05);
          color: white;
          cursor: pointer;
          transition: all 0.2s;
        }
        .share-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          transform: translateY(-2px);
        }
        .share-btn.twitter {
          background: rgba(0, 0, 0, 0.3);
        }
        .share-btn.telegram {
          background: rgba(0, 136, 204, 0.2);
        }
        .referral-stats {
          display: flex;
          gap: 16px;
          margin-bottom: 16px;
        }
        .stat-card {
          flex: 1;
          background: rgba(0, 0, 0, 0.2);
          border-radius: 10px;
          padding: 16px;
          text-align: center;
        }
        .stat-value {
          display: block;
          font-size: 24px;
          font-weight: 700;
          color: #06b6d4;
        }
        .stat-label {
          font-size: 12px;
          color: #888;
        }
        .toggle-stats {
          width: 100%;
          padding: 10px;
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          color: #888;
          cursor: pointer;
          font-size: 13px;
        }
        .toggle-stats:hover {
          color: white;
        }
      `}</style>
    </div>
  );
}
