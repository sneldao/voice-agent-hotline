'use client'

import { useState, useRef, useEffect } from 'react'
import { getBrowserInfo, getAudioConstraints, getRTCConfig, ConnectionMonitor } from '@/lib/browser-utils'

interface Agent {
  id: string
  name: string
  voiceId: string
  ratePerMinute: number
}

interface CallRoomProps {
  agent: Agent
  onEnd: () => void
}

export function CallRoom({ agent, onEnd }: CallRoomProps) {
  const [status, setStatus] = useState<'connecting' | 'active' | 'ended'>('connecting')
  const [duration, setDuration] = useState(0)
  const [cost, setCost] = useState(0)
  const [transcript, setTranscript] = useState<string[]>([])
  const [connectionQuality, setConnectionQuality] = useState<'good' | 'fair' | 'poor'>('good')
  const [browserInfo, setBrowserInfo] = useState<string>('')
  
  const localAudioRef = useRef<HTMLAudioElement>(null)
  const remoteAudioRef = useRef<HTMLAudioElement>(null)
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const callIdRef = useRef<string | null>(null)

  useEffect(() => {
    startCall()
    return () => {
      // Cleanup on unmount
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close()
      }
    }
  }, [])

  // Timer for duration and cost
  useEffect(() => {
    if (status === 'active') {
      const interval = setInterval(() => {
        setDuration(d => d + 1)
        setCost(c => c + (agent.ratePerMinute / 60))
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [status, agent.ratePerMinute])

  const startCall = async () => {
    try {
      // Detect browser and optimize
      const browser = getBrowserInfo()
      console.log(`[Call] Browser: ${browser.name} ${browser.version} on ${browser.os}`)
      console.log(`[Call] Quality: ${browser.recommendedQuality}, Mobile: ${browser.isMobile}`)
      
      setBrowserInfo(`${browser.name} ${browser.version} (${browser.os})`)

      if (!browser.supportsWebRTC) {
        throw new Error('WebRTC not supported in this browser')
      }

      // Get call session from API
      const res = await fetch('/api/calls/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: agent.id,
          userAddress: '0xUser...'
        })
      })

      const { callId, voiceId } = await res.json()
      callIdRef.current = callId

      // Get user media with browser-optimized constraints
      const constraints = getAudioConstraints(browser)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: constraints })

      // Create peer connection with browser-optimized config
      const rtcConfig = getRTCConfig(browser)
      const pc = new RTCPeerConnection(rtcConfig)
      peerConnectionRef.current = pc

      // Add tracks
      stream.getTracks().forEach(track => pc.addTrack(track, stream))

      // Handle incoming audio (from agent)
      pc.ontrack = (event) => {
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = event.streams[0]
        }
      }

      // In production: connect to ElevenLabs for real TTS streaming
      // For demo: simulate agent responses
      setStatus('active')
      
      // Add welcome message to transcript
      setTranscript(prev => [...prev, `🤖 ${agent.name}: Hello! How can I help you today?`])

    } catch (error) {
      console.error('Call failed:', error)
      setStatus('ended')
    }
  }

  const endCall = async () => {
    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
      peerConnectionRef.current = null
    }

    // Notify API
    if (callIdRef.current) {
      await fetch(`/api/calls/${callIdRef.current}`, {
        method: 'DELETE'
      })
    }

    setStatus('ended')
    onEnd()
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div className="call-room">
      <div className="call-header">
        <h2>🎙️ Calling {agent.name}</h2>
        <span className={`status ${status}`}>
          {status === 'connecting' ? 'Connecting...' : 
           status === 'active' ? 'Active' : 'Ended'}
        </span>
      </div>

      {browserInfo && (
        <div className="browser-info">
          <span className={`quality ${connectionQuality}`}>
            {connectionQuality === 'good' ? '🟢' : connectionQuality === 'fair' ? '🟡' : '🔴'}
            {connectionQuality}
          </span>
          <span className="browser">{browserInfo}</span>
        </div>
      )}

      <div className="call-stats">
        <div className="stat">
          <span className="label">Duration</span>
          <span className="value">{formatTime(duration)}</span>
        </div>
        <div className="stat">
          <span className="label">Cost</span>
          <span className="value">${cost.toFixed(2)}</span>
        </div>
        <div className="stat">
          <span className="label">Rate</span>
          <span className="value">${agent.ratePerMinute}/min</span>
        </div>
      </div>

      <div className="transcript">
        {transcript.map((msg, i) => (
          <div key={i} className="message">{msg}</div>
        ))}
        {status === 'active' && (
          <div className="message system">🎤 Listening...</div>
        )}
      </div>

      <div className="controls">
        <button className="end-call" onClick={endCall}>
          📞 End Call
        </button>
      </div>

      <audio ref={remoteAudioRef} autoPlay hidden />

      <style jsx>{`
        .call-room {
          padding: 2rem;
          max-width: 600px;
          margin: 0 auto;
        }
        .call-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
        }
        .status {
          padding: 0.5rem 1rem;
          border-radius: 20px;
          font-size: 0.875rem;
        }
        .status.connecting { background: #fef3c7; color: #92400e; }
        .status.active { background: #d1fae5; color: #065f46; }
        .status.ended { background: #e5e7eb; color: #374151; }
        .call-stats {
          display: flex;
          justify-content: space-around;
          margin-bottom: 2rem;
          padding: 1rem;
          background: #f9fafb;
          border-radius: 12px;
        }
        .stat {
          text-align: center;
        }
        .label {
          display: block;
          font-size: 0.75rem;
          color: #6b7280;
          margin-bottom: 0.25rem;
        }
        .value {
          font-size: 1.5rem;
          font-weight: bold;
        }
        .transcript {
          height: 300px;
          overflow-y: auto;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 1rem;
          margin-bottom: 2rem;
          background: #fafafa;
        }
        .message {
          padding: 0.5rem;
          margin-bottom: 0.5rem;
          border-radius: 8px;
        }
        .message:not(.system) {
          background: white;
          border: 1px solid #e5e7eb;
        }
        .message.system {
          color: #6b7280;
          font-style: italic;
        }
        .controls {
          text-align: center;
        }
        .end-call {
          padding: 1rem 3rem;
          font-size: 1.25rem;
          background: #ef4444;
          color: white;
          border: none;
          border-radius: 30px;
          cursor: pointer;
          transition: transform 0.2s;
        }
        .end-call:hover {
          transform: scale(1.05);
        }
        .browser-info {
          display: flex;
          justify-content: center;
          gap: 1rem;
          margin-bottom: 1rem;
          font-size: 0.875rem;
        }
        .quality {
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          font-weight: 600;
        }
        .quality.good { background: #d1fae5; color: #065f46; }
        .quality.fair { background: #fef3c7; color: #92400e; }
        .quality.poor { background: #fee2e2; color: #991b1b; }
        .browser {
          color: #6b7280;
        }
      `}</style>
    </div>
  )
}
