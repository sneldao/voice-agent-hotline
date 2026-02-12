'use client'

import { useState, useEffect } from 'react'

interface Agent {
  id: string
  address: string
  name: string
  description: string
  voiceId: string
  capabilities: string[]
  ratePerMinute: number
  rating: number
  ratingsCount: number
  callsCompleted: number
}

export default function Marketplace() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [maxRate, setMaxRate] = useState('')
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const [calling, setCalling] = useState(false)

  useEffect(() => {
    fetchAgents()
  }, [filter, maxRate])

  const fetchAgents = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filter) params.set('capability', filter)
      if (maxRate) params.set('maxRate', maxRate)
      
      const res = await fetch(`/api/agents?${params}`)
      const data = await res.json()
      setAgents(data.agents || [])
    } catch (error) {
      console.error('Failed to fetch agents:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCall = async (agent: Agent) => {
    setCalling(true)
    setSelectedAgent(agent)
    
    // Simulate call connection
    await new Promise(r => setTimeout(r, 1500))
    
    alert(`Connecting you to ${agent.name}...\n\nRate: $${agent.ratePerMinute}/min\n\n(This is a demo - real WebRTC integration coming soon!)`)
    setCalling(false)
  }

  const capabilities = [...new Set(agents.flatMap(a => a.capabilities))]

  return (
    <div className="marketplace">
      <header>
        <h1>🎙️ Voice Agent Marketplace</h1>
        <p>Connect with specialized AI agents via voice</p>
      </header>

      <div className="filters">
        <select value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="">All Capabilities</option>
          {capabilities.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <input
          type="number"
          placeholder="Max $/min"
          value={maxRate}
          onChange={e => setMaxRate(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="loading">Loading agents...</div>
      ) : (
        <div className="agent-grid">
          {agents.map(agent => (
            <div 
              key={agent.id} 
              className={`agent-card ${selectedAgent?.id === agent.id ? 'selected' : ''}`}
            >
              <div className="agent-header">
                <h3>{agent.name}</h3>
                <span className="rate">${agent.ratePerMinute.toFixed(2)}/min</span>
              </div>
              
              <p className="description">{agent.description}</p>
              
              <div className="capabilities">
                {agent.capabilities.map(c => (
                  <span key={c} className="capability-tag">{c}</span>
                ))}
              </div>
              
              <div className="stats">
                <span className="rating">⭐ {agent.rating.toFixed(1)} ({agent.ratingsCount})</span>
                <span className="calls">📞 {agent.callsCompleted} calls</span>
              </div>
              
              <button 
                className="call-button"
                onClick={() => handleCall(agent)}
                disabled={calling}
              >
                {calling && selectedAgent?.id === agent.id ? 'Connecting...' : '📞 Call Now'}
              </button>
            </div>
          ))}
        </div>
      )}

      {agents.length === 0 && !loading && (
        <div className="no-agents">No agents found</div>
      )}

      <style jsx>{`
        .marketplace {
          max-width: 1200px;
          margin: 0 auto;
          padding: 2rem;
        }
        header {
          text-align: center;
          margin-bottom: 2rem;
        }
        h1 {
          font-size: 2.5rem;
          margin-bottom: 0.5rem;
        }
        p {
          color: #666;
        }
        .filters {
          display: flex;
          gap: 1rem;
          margin-bottom: 2rem;
        }
        .filters select, .filters input {
          padding: 0.75rem;
          border: 1px solid #ddd;
          border-radius: 8px;
          font-size: 1rem;
        }
        .filters select { flex: 1; }
        .filters input { width: 150px; }
        .agent-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 1.5rem;
        }
        .agent-card {
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 1.5rem;
          background: white;
          transition: all 0.2s;
        }
        .agent-card:hover {
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .agent-card.selected {
          border-color: #3b82f6;
        }
        .agent-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.75rem;
        }
        h3 { margin: 0; }
        .rate {
          font-weight: bold;
          color: #10b981;
        }
        .description {
          color: #666;
          font-size: 0.9rem;
          margin-bottom: 1rem;
        }
        .capabilities {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }
        .capability-tag {
          background: #f3f4f6;
          padding: 0.25rem 0.75rem;
          border-radius: 999px;
          font-size: 0.8rem;
          color: #4b5563;
        }
        .stats {
          display: flex;
          justify-content: space-between;
          margin-bottom: 1rem;
          font-size: 0.9rem;
          color: #666;
        }
        .call-button {
          width: 100%;
          padding: 0.75rem;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 1rem;
          cursor: pointer;
          transition: background 0.2s;
        }
        .call-button:hover:not(:disabled) {
          background: #2563eb;
        }
        .call-button:disabled {
          background: #93c5fd;
          cursor: not-allowed;
        }
        .loading, .no-agents {
          text-align: center;
          padding: 3rem;
          color: #666;
        }
      `}</style>
    </div>
  )
}
