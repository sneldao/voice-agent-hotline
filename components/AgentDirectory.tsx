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

export function AgentDirectory() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [maxRate, setMaxRate] = useState('')
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)

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

  const capabilities = [...new Set(agents.flatMap(a => a.capabilities))]

  return (
    <div className="agent-directory">
      {/* Filters */}
      <div className="filters">
        <select 
          value={filter} 
          onChange={(e) => setFilter(e.target.value)}
          className="filter-select"
        >
          <option value="">All Capabilities</option>
          {capabilities.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        
        <input
          type="number"
          placeholder="Max $/min"
          value={maxRate}
          onChange={(e) => setMaxRate(e.target.value)}
          className="filter-input"
        />
      </div>

      {/* Agent Grid */}
      {loading ? (
        <div className="loading">Loading agents...</div>
      ) : (
        <div className="agent-grid">
          {agents.map(agent => (
            <div 
              key={agent.id} 
              className={`agent-card ${selectedAgent?.id === agent.id ? 'selected' : ''}`}
              onClick={() => setSelectedAgent(agent)}
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
                <span className="rating">
                  ⭐ {agent.rating.toFixed(1)} ({agent.ratingsCount})
                </span>
                <span className="calls">
                  📞 {agent.callsCompleted} calls
                </span>
              </div>
              
              <button 
                className="call-button"
                onClick={(e) => {
                  e.stopPropagation()
                  alert(`Starting call with ${agent.name}...`)
                }}
              >
                📞 Call Now
              </button>
            </div>
          ))}
        </div>
      )}

      {agents.length === 0 && !loading && (
        <div className="no-agents">
          No agents found matching your criteria
        </div>
      )}
    </div>
  )
}
