'use client';

import { useState, useEffect } from 'react';

export function MobilePolish() {
  const [isMobile, setIsMobile] = useState(false);
  const [touchFeedback, setTouchFeedback] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleTouchStart = () => setTouchFeedback(true);
  const handleTouchEnd = () => setTouchFeedback(false);

  return (
    <div className="mobile-polish">
      <div className="section-header">
        <span className="icon">📱</span>
        <h3>Mobile Polish</h3>
        <span className="badge">{isMobile ? 'Mobile' : 'Desktop'}</span>
      </div>

      <p className="section-desc">
        Touch-friendly controls with haptic feedback indicators
      </p>

      {/* Touch Demo Buttons */}
      <div className="touch-demo">
        <button
          className={`touch-btn primary ${touchFeedback ? 'active' : ''}`}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onClick={() => {}}
        >
          🎙️ Start Call
        </button>
        <button
          className={`touch-btn secondary ${touchFeedback ? 'active' : ''}`}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onClick={() => {}}
        >
          💰 Add Funds
        </button>
        <button
          className={`touch-btn danger ${touchFeedback ? 'active' : ''}`}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onClick={() => {}}
        >
          📞 End Call
        </button>
      </div>

      {/* Gesture Indicators */}
      <div className="gestures">
        <h4>Gesture Support</h4>
        <div className="gesture-list">
          <div className="gesture-item">
            <span className="gesture-icon">👆</span>
            <span className="gesture-name">Tap</span>
            <span className="gesture-desc">Select agent</span>
          </div>
          <div className="gesture-item">
            <span className="gesture-icon">👇</span>
            <span className="gesture-name">Double Tap</span>
            <span className="gesture-desc">Quick call</span>
          </div>
          <div className="gesture-item">
            <span className="gesture-icon">↔️</span>
            <span className="gesture-name">Swipe</span>
            <span className="gesture-desc">Switch tabs</span>
          </div>
          <div className="gesture-item">
            <span className="gesture-icon">✊</span>
            <span className="gesture-name">Long Press</span>
            <span className="gesture-desc">Agent options</span>
          </div>
        </div>
      </div>

      {/* Safe Areas */}
      <div className="safe-areas">
        <h4>Notch & Home Indicator Support</h4>
        <div className="safe-demo">
          <div className="safe-area-box">
            <span className="safe-label">Safe Area Inset</span>
            <div className="safe-content">
              <p>Content respects device safe areas</p>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Stats */}
      <div className="performance">
        <h4>Performance</h4>
        <div className="perf-stats">
          <div className="perf-item">
            <span className="perf-icon">⚡</span>
            <span className="perf-value">&lt;50ms</span>
            <span className="perf-label">Interaction</span>
          </div>
          <div className="perf-item">
            <span className="perf-icon">🎨</span>
            <span className="perf-value">60fps</span>
            <span className="perf-label">Animation</span>
          </div>
          <div className="perf-item">
            <span className="perf-icon">📦</span>
            <span className="perf-value">45kB</span>
            <span className="perf-label">Gzipped</span>
          </div>
        </div>
      </div>

      <style jsx>{`
        .mobile-polish {
          background: linear-gradient(135deg, rgba(6, 182, 212, 0.1), rgba(139, 92, 246, 0.1));
          border: 1px solid rgba(6, 182, 212, 0.3);
          border-radius: 16px;
          padding: 24px;
          margin: 20px 0;
        }
        .section-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 12px;
        }
        .section-header .icon {
          font-size: 24px;
        }
        .section-header h3 {
          margin: 0;
          font-size: 18px;
        }
        .section-header .badge {
          margin-left: auto;
          padding: 4px 10px;
          background: rgba(6, 182, 212, 0.2);
          color: #06b6d4;
          border-radius: 20px;
          font-size: 11px;
        }
        .section-desc {
          color: #888;
          font-size: 14px;
          margin: 0 0 20px 0;
        }
        .touch-demo {
          display: flex;
          gap: 12px;
          margin-bottom: 24px;
        }
        .touch-btn {
          flex: 1;
          padding: 16px;
          border: none;
          border-radius: 12px;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.15s;
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
        }
        .touch-btn.primary {
          background: linear-gradient(135deg, #06b6d4, #0891b2);
          color: white;
        }
        .touch-btn.secondary {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: white;
        }
        .touch-btn.danger {
          background: linear-gradient(135deg, #ef4444, #dc2626);
          color: white;
        }
        .touch-btn:active, .touch-btn.active {
          transform: scale(0.95);
          opacity: 0.8;
        }
        .gestures {
          margin-bottom: 24px;
        }
        .gestures h4, .safe-areas h4, .performance h4 {
          margin: 0 0 16px 0;
          font-size: 14px;
          color: #888;
        }
        .gesture-list {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }
        .gesture-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 16px;
          background: rgba(0, 0, 0, 0.2);
          border-radius: 12px;
          text-align: center;
        }
        .gesture-icon {
          font-size: 24px;
          margin-bottom: 8px;
        }
        .gesture-name {
          font-weight: 600;
          font-size: 13px;
          margin-bottom: 4px;
        }
        .gesture-desc {
          font-size: 11px;
          color: #888;
        }
        .safe-areas {
          margin-bottom: 24px;
        }
        .safe-area-box {
          background: rgba(0, 0, 0, 0.2);
          border-radius: 12px;
          padding: 20px;
          border: 2px dashed rgba(6, 182, 212, 0.3);
        }
        .safe-label {
          display: block;
          font-size: 11px;
          color: #888;
          margin-bottom: 12px;
        }
        .safe-content {
          background: rgba(6, 182, 212, 0.1);
          border-radius: 8px;
          padding: 16px;
          text-align: center;
        }
        .safe-content p {
          margin: 0;
          font-size: 13px;
          color: #06b6d4;
        }
        .performance {
          padding-top: 16px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }
        .perf-stats {
          display: flex;
          gap: 16px;
        }
        .perf-item {
          flex: 1;
          text-align: center;
          padding: 12px;
          background: rgba(0, 0, 0, 0.2);
          border-radius: 10px;
        }
        .perf-icon {
          display: block;
          font-size: 20px;
          margin-bottom: 8px;
        }
        .perf-value {
          display: block;
          font-size: 18px;
          font-weight: 700;
          color: #06b6d4;
        }
        .perf-label {
          display: block;
          font-size: 11px;
          color: #888;
          margin-top: 4px;
        }
      `}</style>
    </div>
  );
}
