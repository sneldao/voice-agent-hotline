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
                <span className="value">⭐ {(Number(agent.rating) || 0).toFixed(2)}</span>
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
          background: rgba(2, 6, 23, 0.55);
          padding: 20px;
          border-radius: 18px;
          margin-bottom: 20px;
          border: 1px solid rgba(148, 163, 184, 0.2);
        }
        .comparison-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        .comparison-header h3 {
          margin: 0;
          color: #e2e8f0;
        }
        .sort-controls {
          display: flex;
          gap: 10px;
        }
        .sort-controls button {
          padding: 6px 12px;
          border: 1px solid rgba(148, 163, 184, 0.25);
          background: rgba(15, 23, 42, 0.7);
          border-radius: 6px;
          cursor: pointer;
          font-size: 12px;
          color: #e2e8f0;
        }
        .sort-controls button.active {
          background: linear-gradient(135deg, #22d3ee, #0ea5e9);
          border-color: transparent;
          color: #0b1117;
        }
        .comparison-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 15px;
        }
        .comparison-card {
          background: rgba(15, 23, 42, 0.7);
          padding: 15px;
          border-radius: 14px;
          text-align: center;
          border: 1px solid rgba(148, 163, 184, 0.15);
        }
        .agent-avatar {
          width: 50px;
          height: 50px;
          background: linear-gradient(135deg, #22d3ee, #0ea5e9);
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
          color: #f8fafc;
        }
        .specialty {
          font-size: 12px;
          color: #94a3b8;
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
          color: #7dd3fc;
        }
        .metric .label {
          font-size: 10px;
          color: #64748b;
        }
        .style-tag {
          font-size: 11px;
          padding: 4px 8px;
          background: rgba(148, 163, 184, 0.2);
          border-radius: 4px;
          margin-bottom: 15px;
          color: #cbd5f5;
        }
        .select-btn {
          width: 100%;
          padding: 8px;
          background: linear-gradient(135deg, #22d3ee, #0ea5e9);
          border: none;
          border-radius: 6px;
          color: #0b1117;
          font-weight: 500;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}
