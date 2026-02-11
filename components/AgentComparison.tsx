// Agent Comparison Component
// Compares agents side-by-side

'use client';

import { useState } from 'react';

import { AgentPersonality } from '@/lib/agent-voice';

interface AgentComparisonProps {
  agents: AgentPersonality[];
}

export function AgentComparison({ agents }: AgentComparisonProps) {
  const [sortBy, setSortBy] = useState<'price' | 'rating'>('price');

  const sortedAgents = [...agents].sort((a, b) => {
    if (sortBy === 'price') return a.pricePerMinute - b.pricePerMinute;
    return b.rating - a.rating;
  });

  return (
    <div className="comparison-container">
      <div className="comparison-header">
        <h3>⚖️ Agent Comparison</h3>
        <div className="sort-controls">
          <button 
            className={sortBy === 'price' ? 'active' : ''}
            onClick={() => setSortBy('price')}
          >
            💰 Price
          </button>
          <button 
            className={sortBy === 'rating' ? 'active' : ''}
            onClick={() => setSortBy('rating')}
          >
            ⭐ Rating
          </button>
        </div>
      </div>

      <div className="comparison-grid">
        {sortedAgents.map((agent) => (
          <div key={agent.id} className="comparison-card">
            <div className="agent-avatar">
              {agent.avatar || '👤'}
            </div>
            <h4>{agent.name}</h4>
            <p className="specialty">{agent.specialty}</p>
            
            <div className="metrics">
              <div className="metric">
                <span className="value">⭐ {agent.rating.toFixed(2)}</span>
                <span className="label">Rating</span>
              </div>
              <div className="metric">
                <span className="value">${agent.pricePerMinute}</span>
                <span className="label">per min</span>
              </div>
            </div>

            <div className="style-tag">
              {agent.speakingStyle}
            </div>

            <button className="select-btn">Select</button>
          </div>
        ))}
      </div>

      <style jsx>{`
        .comparison-container {
          background: #f8f9fa;
          padding: 20px;
          border-radius: 12px;
          margin-bottom: 20px;
        }
        .comparison-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        .comparison-header h3 {
          margin: 0;
        }
        .sort-controls {
          display: flex;
          gap: 10px;
        }
        .sort-controls button {
          padding: 6px 12px;
          border: 1px solid #ddd;
          background: white;
          border-radius: 6px;
          cursor: pointer;
          font-size: 12px;
        }
        .sort-controls button.active {
          background: #00d9ff;
          border-color: #00d9ff;
          color: white;
        }
        .comparison-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 15px;
        }
        .comparison-card {
          background: white;
          padding: 15px;
          border-radius: 10px;
          text-align: center;
          border: 1px solid #eee;
        }
        .agent-avatar {
          width: 50px;
          height: 50px;
          background: linear-gradient(135deg, #00d9ff, #00ff88);
          border-radius: 50%;
          margin: 0 auto 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
        }
        .comparison-card h4 {
          margin: 0 0 5px 0;
          font-size: 14px;
        }
        .specialty {
          font-size: 12px;
          color: #666;
          margin: 0 0 15px 0;
        }
        .metrics {
          display: flex;
          justify-content: center;
          gap: 20px;
          margin-bottom: 15px;
        }
        .metric {
          text-align: center;
        }
        .metric .value {
          display: block;
          font-weight: 600;
          color: #00d9ff;
        }
        .metric .label {
          font-size: 10px;
          color: #888;
        }
        .style-tag {
          font-size: 11px;
          padding: 4px 8px;
          background: #f0f0f0;
          border-radius: 4px;
          margin-bottom: 15px;
          color: #555;
        }
        .select-btn {
          width: 100%;
          padding: 8px;
          background: linear-gradient(135deg, #00d9ff, #00ff88);
          border: none;
          border-radius: 6px;
          color: #000;
          font-weight: 500;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}
