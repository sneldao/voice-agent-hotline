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
          background: linear-gradient(135deg, rgba(0, 217, 255, 0.1) 0%, rgba(0, 255, 136, 0.1) 100%);
          border: 1px solid rgba(0, 217, 255, 0.3);
          border-radius: 12px;
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
        }
        .duration-selector {
          display: flex;
          gap: 8px;
          margin-bottom: 20px;
        }
        .duration-selector button {
          flex: 1;
          padding: 8px;
          border: 1px solid #ddd;
          background: white;
          border-radius: 8px;
          cursor: pointer;
          font-size: 12px;
          transition: all 0.2s;
        }
        .duration-selector button:hover {
          border-color: #00d9ff;
        }
        .duration-selector button.active {
          background: linear-gradient(135deg, #00d9ff, #00ff88);
          border-color: transparent;
          color: #000;
          font-weight: 600;
        }
        .cost-display {
          background: white;
          border-radius: 10px;
          padding: 15px;
        }
        .cost-main {
          text-align: center;
          margin-bottom: 15px;
          padding-bottom: 15px;
          border-bottom: 1px solid #eee;
        }
        .cost-value {
          display: block;
          font-size: 32px;
          font-weight: 700;
          background: linear-gradient(135deg, #00d9ff, #00ff88);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .cost-label {
          font-size: 12px;
          color: #888;
        }
        .cost-breakdown {
          font-size: 12px;
        }
        .breakdown-item {
          display: flex;
          justify-content: space-between;
          padding: 5px 0;
          color: #666;
        }
      `}</style>
    </div>
  );
}
