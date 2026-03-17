'use client';

import { useState, useEffect, useRef } from 'react';

interface AgentMessage {
  agent: string;
  avatar: string;
  text: string;
  timestamp: number;
}

interface AgentChatProps {
  agents: Array<{
    id: string;
    name: string;
    avatar: string;
    specialty: string;
  }>;
}

export function AgentToAgentChat({ agents }: AgentChatProps) {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeAgent, setActiveAgent] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const conversation = [
    {
      agent: 0,
      text: `Hey ${agents[1]?.name || 'Alex'}, got a minute?`,
    },
    {
      agent: 1,
      text: "Sure! What do you need?",
    },
    {
      agent: 0,
      text: "I'm helping a student learn Spanish. They want to know when to use 'por' vs 'para'. Can you explain?",
    },
    {
      agent: 1,
      text: "Ah good question! 'Por' is for reasons, durations, and exchanges. Like 'Gracias por tu ayuda' (Thanks for your help).",
    },
    {
      agent: 1,
      text: "'Para' is for destinations, deadlines, and purposes. Like 'Este libro es para ti' (This book is for you).",
    },
    {
      agent: 0,
      text: "Perfect! And what about payment? Should I charge per minute or per lesson?",
    },
    {
      agent: 1,
      text: "I'd recommend per minute - Voice Hotline makes it easy with x402 micropayments!",
    },
    {
      agent: 0,
      text: "Great idea! I'll update my rates. Thanks!",
    },
    {
      agent: 1,
      text: "Anytime! Happy teaching! 🎓",
    },
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const startConversation = () => {
    setMessages([]);
    setIsPlaying(true);
    setActiveAgent(0);
    let index = 0;

    const interval = setInterval(() => {
      if (index >= conversation.length) {
        clearInterval(interval);
        setIsPlaying(false);
        return;
      }

      const msg = conversation[index];
      setMessages((prev: AgentMessage[]) => [
        ...prev,
        {
          agent: String(msg.agent),
          avatar: agents[msg.agent]?.avatar || '👤',
          text: msg.text,
          timestamp: Date.now(),
        },
      ]);
      setActiveAgent(msg.agent);
      index++;
    }, 2000);
  };

  const resetConversation = () => {
    setMessages([]);
    setIsPlaying(false);
    setActiveAgent(0);
  };

  return (
    <div className="agent-chat-container">
      <div className="chat-header">
        <span className="icon">🤖</span>
        <h3>Agent-to-Agent Chat</h3>
        <span className="badge">ERC-8004 Delegation</span>
      </div>

      <p className="chat-description">
        Watch {agents[0]?.name || 'Maria'} and {agents[1]?.name || 'Alex'} autonomously
        collaborate using delegated permissions!
      </p>

      {/* Agents Status */}
      <div className="agents-status">
        {agents.slice(0, 2).map((agent, i) => (
          <div
            key={agent.id}
            className={`agent-status ${activeAgent === i && isPlaying ? 'active' : ''}`}
          >
            <div className="agent-avatar">{agent.avatar}</div>
            <div className="agent-info">
              <span className="agent-name">{agent.name}</span>
              <span className="agent-specialty">{agent.specialty}</span>
            </div>
            {activeAgent === i && isPlaying && (
              <span className="speaking-indicator">💬</span>
            )}
          </div>
        ))}
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="empty-state">
            <span className="empty-icon">💬</span>
            <p>Click "Start Conversation" to see agents chat autonomously</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.agent === '0' ? 'left' : 'right'}`}>
            <div className="message-avatar">{msg.avatar}</div>
            <div className="message-bubble">
              <p>{msg.text}</p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Controls */}
      <div className="chat-controls">
        {!isPlaying && messages.length === 0 && (
          <button className="control-btn primary" onClick={startConversation}>
            ▶️ Start Conversation
          </button>
        )}
        {isPlaying && (
          <button className="control-btn secondary" onClick={() => setIsPlaying(false)}>
            ⏸️ Pause
          </button>
        )}
        {!isPlaying && messages.length > 0 && messages.length < conversation.length && (
          <button className="control-btn primary" onClick={() => setIsPlaying(true)}>
            ▶️ Resume
          </button>
        )}
        {messages.length === conversation.length && (
          <button className="control-btn secondary" onClick={resetConversation}>
            🔄 Replay
          </button>
        )}
      </div>

      {/* ERC-8004 Info */}
      <div className="delegation-info">
        <div className="info-icon">🔗</div>
        <div className="info-content">
          <span className="info-title">ERC-8004 Delegation Active</span>
          <span className="info-desc">
            Agents use delegated permissions to communicate autonomously
          </span>
        </div>
      </div>

      <style jsx>{`
        .agent-chat-container {
          background: linear-gradient(135deg, rgba(14, 165, 233, 0.14), rgba(16, 185, 129, 0.12));
          border: 1px solid rgba(14, 165, 233, 0.35);
          border-radius: 16px;
          padding: 24px;
          margin: 20px 0;
        }
        .chat-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 12px;
        }
        .chat-header .icon {
          font-size: 24px;
        }
        .chat-header h3 {
          margin: 0;
          font-size: 18px;
        }
        .chat-header .badge {
          margin-left: auto;
          padding: 4px 10px;
          background: rgba(14, 165, 233, 0.2);
          color: #7dd3fc;
          border-radius: 20px;
          font-size: 11px;
        }
        .chat-description {
          color: #94a3b8;
          font-size: 14px;
          margin: 0 0 20px 0;
        }
        .agents-status {
          display: flex;
          gap: 16px;
          margin-bottom: 20px;
        }
        .agent-status {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          background: rgba(15, 23, 42, 0.65);
          border-radius: 12px;
          border: 2px solid transparent;
          transition: all 0.3s;
        }
        .agent-status.active {
          border-color: #22d3ee;
          background: rgba(14, 165, 233, 0.15);
        }
        .agent-avatar {
          width: 44px;
          height: 44px;
          background: linear-gradient(135deg, #22d3ee, #0ea5e9);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
        }
        .agent-info {
          flex: 1;
        }
        .agent-name {
          display: block;
          font-weight: 600;
          font-size: 14px;
        }
        .agent-specialty {
          font-size: 12px;
          color: #94a3b8;
        }
        .speaking-indicator {
          animation: pulse 1s infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .chat-messages {
          background: rgba(15, 23, 42, 0.65);
          border-radius: 12px;
          padding: 16px;
          min-height: 200px;
          max-height: 300px;
          overflow-y: auto;
          margin-bottom: 16px;
        }
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 200px;
          color: #64748b;
        }
        .empty-icon {
          font-size: 48px;
          margin-bottom: 12px;
        }
        .message {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin-bottom: 12px;
        }
        .message.left {
          flex-direction: row;
        }
        .message.right {
          flex-direction: row-reverse;
        }
        .message-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          background: rgba(148, 163, 184, 0.2);
        }
        .message.right .message-avatar {
          background: rgba(14, 165, 233, 0.3);
        }
        .message-bubble {
          max-width: 70%;
          padding: 10px 14px;
          background: rgba(15, 23, 42, 0.7);
          border-radius: 16px;
          border-top-left-radius: 4px;
          color: #e2e8f0;
        }
        .message.right .message-bubble {
          background: rgba(14, 165, 233, 0.2);
          border-radius: 16px;
          border-top-right-radius: 4px;
        }
        .message-bubble p {
          margin: 0;
          font-size: 14px;
          line-height: 1.4;
        }
        .chat-controls {
          display: flex;
          gap: 12px;
          margin-bottom: 16px;
        }
        .control-btn {
          flex: 1;
          padding: 12px;
          border: none;
          border-radius: 10px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .control-btn.primary {
          background: linear-gradient(135deg, #22d3ee, #0ea5e9);
          color: #0b1117;
        }
        .control-btn.primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(14, 165, 233, 0.4);
        }
        .control-btn.secondary {
          background: rgba(255, 255, 255, 0.1);
          color: white;
          border: 1px solid rgba(255, 255, 255, 0.2);
        }
        .control-btn.secondary:hover {
          background: rgba(255, 255, 255, 0.2);
        }
        .delegation-info {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          background: rgba(14, 165, 233, 0.1);
          border-radius: 10px;
          border: 1px dashed rgba(14, 165, 233, 0.3);
        }
        .info-icon {
          font-size: 24px;
        }
        .info-content {
          flex: 1;
        }
        .info-title {
          display: block;
          font-weight: 600;
          font-size: 13px;
          color: #7dd3fc;
        }
        .info-desc {
          font-size: 12px;
          color: #94a3b8;
        }
      `}</style>
    </div>
  );
}
