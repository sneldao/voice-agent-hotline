// Call Cost Estimator Component
// Shows estimated cost for different call durations

'use client';

import { useState, useEffect } from 'react';

interface CallEstimatorProps {
  pricePerMinute: number;
}

export function CallEstimator({ pricePerMinute }: CallEstimatorProps) {
  const [duration, setDuration] = useState(5);
  const [estimatedCost, setEstimatedCost] = useState(0);

  useEffect(() => {
    setEstimatedCost((pricePerMinute / 60) * duration);
  }, [pricePerMinute, duration]);

  const durations = [1, 5, 10, 15, 30, 60];

  return (
    <div className="estimator-container">
      <div className="estimator-header">
        <span className="icon">🧮</span>
        <h3>Cost Estimator</h3>
      </div>

      <div className="duration-selector">
        {durations.map((d) => (
          <button
            key={d}
            className={duration === d ? 'active' : ''}
            onClick={() => setDuration(d)}
          >
            {d < 60 ? `${d}m` : `${d / 60}h`}
          </button>
        ))}
      </div>

      <div className="cost-display">
        <div className="cost-main">
          <span className="cost-value">${(estimatedCost || 0).toFixed(3)}</span>
          <span className="cost-label">Estimated</span>
        </div>
        <div className="cost-breakdown">
          <div className="breakdown-item">
            <span>{duration} min call</span>
            <span>${((pricePerMinute || 0) * duration).toFixed(2)}</span>
          </div>
          <div className="breakdown-item">
            <span>Platform fee (1%)</span>
            <span>${((pricePerMinute || 0) * duration * 0.01).toFixed(4)}</span>
          </div>
        </div>
      </div>

      <style jsx>{`
        .estimator-container {
          background: rgba(2, 6, 23, 0.55);
          border: 1px solid rgba(148, 163, 184, 0.25);
          border-radius: 16px;
          padding: 20px;
          margin-bottom: 20px;
        }
        .estimator-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 15px;
        }
        .estimator-header .icon {
          font-size: 20px;
        }
        .estimator-header h3 {
          margin: 0;
          font-size: 16px;
          color: #e2e8f0;
        }
        .duration-selector {
          display: flex;
          gap: 8px;
          margin-bottom: 20px;
        }
        .duration-selector button {
          flex: 1;
          padding: 8px;
          border: 1px solid rgba(148, 163, 184, 0.25);
          background: rgba(15, 23, 42, 0.7);
          border-radius: 12px;
          cursor: pointer;
          font-size: 12px;
          transition: all 0.2s;
          color: #e2e8f0;
        }
        .duration-selector button:hover {
          border-color: rgba(34, 211, 238, 0.8);
        }
        .duration-selector button.active {
          background: linear-gradient(135deg, #22d3ee, #0ea5e9);
          border-color: transparent;
          color: #0b1117;
          font-weight: 600;
        }
        .cost-display {
          background: rgba(15, 23, 42, 0.7);
          border-radius: 14px;
          padding: 15px;
        }
        .cost-main {
          text-align: center;
          margin-bottom: 15px;
          padding-bottom: 15px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.2);
        }
        .cost-value {
          display: block;
          font-size: 32px;
          font-weight: 700;
          background: linear-gradient(135deg, #22d3ee, #0ea5e9);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .cost-label {
          font-size: 12px;
          color: #94a3b8;
        }
        .cost-breakdown {
          font-size: 12px;
        }
        .breakdown-item {
          display: flex;
          justify-content: space-between;
          padding: 5px 0;
          color: #cbd5f5;
        }
      `}</style>
    </div>
  );
}
