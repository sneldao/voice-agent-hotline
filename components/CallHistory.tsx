'use client'

import { useState, useEffect } from 'react'

interface CallRecord {
  id: string
  agentId: string
  userAddress: string
  ratePerMinute: number
  maxAuthorized: number
  startTime: string
  secondsBilled: number
  totalCost: number
  status: 'pending' | 'active' | 'settled' | 'failed'
}

interface CallHistoryProps {
  agentId?: string
  userAddress?: string
}

export function CallHistory({ agentId, userAddress }: CallHistoryProps) {
  const [calls, setCalls] = useState<CallRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCalls()
  }, [agentId, userAddress])

  const fetchCalls = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (agentId) params.set('agentId', agentId)
      if (userAddress) params.set('userAddress', userAddress)

      const res = await fetch(`/api/calls?${params}`)
      const data = await res.json()
      setCalls(data.calls || [])
    } catch (error) {
      console.error('Failed to fetch call history:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}m ${secs}s`
  }

  const formatAddress = (addr: string): string => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'settled': return 'status-success'
      case 'active': return 'status-active'
      case 'pending': return 'status-pending'
      case 'failed': return 'status-failed'
      default: return ''
    }
  }

  if (loading) {
    return <div className="loading">Loading call history...</div>
  }

  return (
    <div className="call-history">
      <h3>📞 Call History</h3>
      
      {calls.length === 0 ? (
        <p className="no-calls">No calls yet</p>
      ) : (
        <div className="calls-list">
          {calls.map(call => (
            <div key={call.id} className="call-card">
              <div className="call-header">
                <span className={`status-badge ${getStatusColor(call.status)}`}>
                  {call.status}
                </span>
                <span className="call-date">
                  {new Date(call.startTime).toLocaleDateString()}
                </span>
              </div>
              
              <div className="call-details">
                <div className="detail-row">
                  <span className="label">Duration:</span>
                  <span className="value">{formatDuration(call.secondsBilled)}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Rate:</span>
                  <span className="value">${(call.ratePerMinute || 0).toFixed(2)}/min</span>
                </div>
                <div className="detail-row">
                  <span className="label">Cost:</span>
                  <span className="value cost">${(call.totalCost || 0).toFixed(4)}</span>
                </div>
                {agentId && (
                  <div className="detail-row">
                    <span className="label">User:</span>
                    <span className="value">{formatAddress(call.userAddress)}</span>
                  </div>
                )}
                {userAddress && (
                  <div className="detail-row">
                    <span className="label">Agent:</span>
                    <span className="value">{formatAddress(call.agentId)}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        .call-history {
          padding: 1rem;
        }
        .call-history h3 {
          margin-bottom: 1rem;
        }
        .calls-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .call-card {
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 1rem;
          background: #fff;
        }
        .call-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.5rem;
        }
        .status-badge {
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 600;
        }
        .status-success {
          background: #d4edda;
          color: #155724;
        }
        .status-active {
          background: #cce5ff;
          color: #004085;
        }
        .status-pending {
          background: #fff3cd;
          color: #856404;
        }
        .status-failed {
          background: #f8d7da;
          color: #721c24;
        }
        .call-details {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }
        .detail-row {
          display: flex;
          justify-content: space-between;
        }
        .label {
          color: #666;
          font-size: 0.875rem;
        }
        .value {
          font-weight: 500;
        }
        .cost {
          color: #28a745;
        }
        .no-calls {
          color: #666;
          font-style: italic;
        }
        .loading {
          text-align: center;
          padding: 2rem;
          color: #666;
        }
      `}</style>
    </div>
  )
}
