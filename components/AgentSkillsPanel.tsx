'use client';

import { useState } from 'react';

interface AgentSkill {
  id: string;
  name: string;
  description: string;
  icon: string;
  enabled: boolean;
  level: number;
  maxLevel: number;
}

interface Delegation {
  agent: string;
  permissions: string[];
  expiresAt: Date;
  active: boolean;
}

export function AgentSkillsPanel() {
  const [skills, setSkills] = useState<AgentSkill[]>([
    {
      id: 'voice',
      name: 'Voice Synthesis',
      description: 'Natural voice responses via ElevenLabs',
      icon: '🎙️',
      enabled: true,
      level: 3,
      maxLevel: 5,
    },
    {
      id: 'context',
      name: 'Context Memory',
      description: 'Remember conversation history',
      icon: '🧠',
      enabled: true,
      level: 2,
      maxLevel: 5,
    },
    {
      id: 'translation',
      name: 'Translation',
      description: 'Multi-language support',
      icon: '🌍',
      enabled: true,
      level: 4,
      maxLevel: 5,
    },
    {
      id: 'sentiment',
      name: 'Sentiment Analysis',
      description: 'Understand user emotions',
      icon: '💭',
      enabled: false,
      level: 1,
      maxLevel: 5,
    },
    {
      id: 'scheduling',
      name: 'Smart Scheduling',
      description: 'Book appointments automatically',
      icon: '📅',
      enabled: false,
      level: 1,
      maxLevel: 5,
    },
  ]);

  const [delegations, setDelegations] = useState<Delegation[]>([
    {
      agent: 'Maria Garcia',
      permissions: ['voice_calls', 'message_response', 'calendar_access'],
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      active: true,
    },
    {
      agent: 'Alex Chen',
      permissions: ['code_review', 'message_response'],
      expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      active: true,
    },
  ]);

  const toggleSkill = (skillId: string) => {
    setSkills(prev =>
      prev.map(s => (s.id === skillId ? { ...s, enabled: !s.enabled } : s))
    );
  };

  return (
    <div className="skills-panel">
      <div className="panel-header">
        <span className="icon">⚡</span>
        <h3>Agent Skills</h3>
        <span className="badge">ERC-8004</span>
      </div>

      <p className="panel-desc">
        Customize agent capabilities and delegate permissions
      </p>

      {/* Skills Grid */}
      <div className="skills-grid">
        {skills.map((skill) => (
          <div
            key={skill.id}
            className={`skill-card ${skill.enabled ? 'enabled' : 'disabled'}`}
            onClick={() => toggleSkill(skill.id)}
          >
            <div className="skill-header">
              <span className="skill-icon">{skill.icon}</span>
              <span className={`skill-toggle ${skill.enabled ? 'on' : 'off'}`}>
                {skill.enabled ? '✓' : '○'}
              </span>
            </div>
            <h4>{skill.name}</h4>
            <p>{skill.description}</p>
            <div className="skill-level">
              <div className="level-bar">
                {[...Array(skill.maxLevel)].map((_, i) => (
                  <div
                    key={i}
                    className={`level-pip ${i < skill.level ? 'filled' : ''}`}
                  />
                ))}
              </div>
              <span className="level-text">Lv.{skill.level}/{skill.maxLevel}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Delegations */}
      <div className="delegations-section">
        <div className="section-header">
          <span className="icon">🔗</span>
          <h4>Active Delegations</h4>
        </div>

        {delegations.map((delegation, i) => (
          <div key={i} className="delegation-card">
            <div className="delegation-header">
              <span className="agent-name">{delegation.agent}</span>
              <span className={`status-badge ${delegation.active ? 'active' : 'expired'}`}>
                {delegation.active ? 'Active' : 'Expired'}
              </span>
            </div>
            <div className="permissions">
              {delegation.permissions.map((perm, j) => (
                <span key={j} className="permission-tag">
                  {perm.replace('_', ' ')}
                </span>
              ))}
            </div>
            <div className="expires">
              Expires: {delegation.expiresAt.toLocaleDateString()}
            </div>
          </div>
        ))}

        <button className="new-delegation-btn">
          + New Delegation
        </button>
      </div>

      {/* ERC-8004 Info */}
      <div className="erc8004-info">
        <div className="info-icon">🤖</div>
        <div className="info-content">
          <span className="info-title">ERC-8004 Trustless Agents</span>
          <span className="info-desc">
            Agents have verifiable identity and can be delegated with scoped permissions
          </span>
        </div>
      </div>

      <style jsx>{`
        .skills-panel {
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(6, 182, 212, 0.1));
          border: 1px solid rgba(139, 92, 246, 0.3);
          border-radius: 16px;
          padding: 24px;
          margin: 20px 0;
        }
        .panel-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 12px;
        }
        .panel-header .icon {
          font-size: 24px;
        }
        .panel-header h3 {
          margin: 0;
          font-size: 18px;
        }
        .panel-header .badge {
          margin-left: auto;
          padding: 4px 10px;
          background: rgba(139, 92, 246, 0.2);
          color: #a78bfa;
          border-radius: 20px;
          font-size: 11px;
        }
        .panel-desc {
          color: #888;
          font-size: 14px;
          margin: 0 0 20px 0;
        }
        .skills-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 12px;
          margin-bottom: 24px;
        }
        .skill-card {
          padding: 16px;
          background: rgba(0, 0, 0, 0.2);
          border-radius: 12px;
          border: 2px solid transparent;
          cursor: pointer;
          transition: all 0.2s;
        }
        .skill-card.enabled {
          border-color: rgba(139, 92, 246, 0.5);
          background: rgba(139, 92, 246, 0.05);
        }
        .skill-card.disabled {
          opacity: 0.5;
        }
        .skill-card:hover {
          transform: translateY(-2px);
        }
        .skill-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }
        .skill-icon {
          font-size: 28px;
        }
        .skill-toggle {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
        }
        .skill-toggle.on {
          background: #22c554;
          color: white;
        }
        .skill-toggle.off {
          background: rgba(255, 255, 255, 0.1);
          color: #666;
        }
        .skill-card h4 {
          margin: 0 0 6px 0;
          font-size: 14px;
        }
        .skill-card p {
          margin: 0 0 12px 0;
          font-size: 12px;
          color: #888;
          line-height: 1.4;
        }
        .skill-level {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .level-bar {
          display: flex;
          gap: 4px;
        }
        .level-pip {
          width: 8px;
          height: 8px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 2px;
        }
        .level-pip.filled {
          background: linear-gradient(90deg, #8b5cf6, #06b6d4);
        }
        .level-text {
          font-size: 11px;
          color: #888;
        }
        .delegations-section {
          padding: 20px;
          background: rgba(0, 0, 0, 0.2);
          border-radius: 12px;
          margin-bottom: 20px;
        }
        .section-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 16px;
        }
        .section-header .icon {
          font-size: 20px;
        }
        .section-header h4 {
          margin: 0;
          font-size: 15px;
        }
        .delegation-card {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
          padding: 14px;
          margin-bottom: 12px;
        }
        .delegation-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }
        .agent-name {
          font-weight: 600;
          font-size: 14px;
        }
        .status-badge {
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 11px;
        }
        .status-badge.active {
          background: rgba(34, 197, 94, 0.2);
          color: #4ade80;
        }
        .status-badge.expired {
          background: rgba(239, 68, 68, 0.2);
          color: #ef4444;
        }
        .permissions {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-bottom: 10px;
        }
        .permission-tag {
          padding: 4px 8px;
          background: rgba(139, 92, 246, 0.2);
          color: #a78bfa;
          border-radius: 4px;
          font-size: 11px;
          text-transform: capitalize;
        }
        .expires {
          font-size: 11px;
          color: #888;
        }
        .new-delegation-btn {
          width: 100%;
          padding: 12px;
          background: transparent;
          border: 2px dashed rgba(139, 92, 246, 0.3);
          border-radius: 10px;
          color: #a78bfa;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .new-delegation-btn:hover {
          background: rgba(139, 92, 246, 0.1);
          border-color: rgba(139, 92, 246, 0.5);
        }
        .erc8004-info {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 16px;
          background: rgba(139, 92, 246, 0.1);
          border-radius: 10px;
          border: 1px dashed rgba(139, 92, 246, 0.3);
        }
        .info-icon {
          font-size: 32px;
        }
        .info-content {
          flex: 1;
        }
        .info-title {
          display: block;
          font-weight: 600;
          font-size: 13px;
          color: #a78bfa;
          margin-bottom: 4px;
        }
        .info-desc {
          font-size: 12px;
          color: #888;
          line-height: 1.4;
        }
      `}</style>
    </div>
  );
}
