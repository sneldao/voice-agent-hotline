// ============================================
// TTSPanel Component
// ============================================
// Text-to-speech panel for AI agent voice responses

'use client';

import { useState, useEffect } from 'react';
import { useElevenLabs } from '@/lib/useElevenLabs';
import { AGENT_VOICES } from '@/lib/elevenlabs';

interface TTSPanelProps {
  agentId: string;
  apiKey?: string;
  onVoiceReady?: (voiceId: string) => void;
}

export function TTSPanel({ agentId, apiKey, onVoiceReady }: TTSPanelProps) {
  const [text, setText] = useState('');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [selectedVoice, setSelectedVoice] = useState<string>('general_advisor');
  
  const {
    isGenerating,
    isPlaying,
    error,
    generateSpeech,
    playAudio,
    stopAudio,
    getVoices,
    voices,
  } = useElevenLabs(apiKey || '');

  useEffect(() => {
    // Map agent ID to voice
    const voiceMap: Record<string, string> = {
      maria_garcia: 'maria_garcia',
      tech_support: 'tech_support',
      general: 'general_advisor',
    };
    setSelectedVoice(voiceMap[agentId] || 'general_advisor');
    onVoiceReady?.(voiceMap[agentId] || 'general_advisor');
  }, [agentId, onVoiceReady]);

  const handleGenerate = async () => {
    if (!text.trim()) return;

    const blob = await generateSpeech(text, selectedVoice as any);
    if (blob) {
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
    }
  };

  const handlePlay = () => {
    if (audioUrl) {
      playAudio(audioUrl);
    }
  };

  return (
    <div className="tts-panel">
      <div className="panel-header">
        <h3>🎙️ Voice Synthesis</h3>
        <select
          value={selectedVoice}
          onChange={(e) => setSelectedVoice(e.target.value)}
          className="voice-select"
        >
          <optgroup label="Agent Voices">
            {Object.entries(AGENT_VOICES).map(([key, config]) => (
              <option key={key} value={key}>
                {config.name} - {config.description}
              </option>
            ))}
          </optgroup>
          {voices.length > 0 && (
            <optgroup label="All Voices">
              {voices.map((voice) => (
                <option key={voice.id} value={voice.id}>
                  {voice.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </div>

      <div className="text-input">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Enter text for voice synthesis..."
          rows={4}
        />
      </div>

      <div className="controls">
        <button
          onClick={handleGenerate}
          disabled={isGenerating || !text.trim()}
          className="generate-btn"
        >
          {isGenerating ? '⏳ Generating...' : '🎵 Generate Voice'}
        </button>

        {audioUrl && (
          <button onClick={handlePlay} disabled={isPlaying} className="play-btn">
            {isPlaying ? '🔊 Playing...' : '▶️ Play'}
          </button>
        )}
      </div>

      {error && <div className="error">{error}</div>}

      <style jsx>{`
        .tts-panel {
          padding: 20px;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          border-radius: 12px;
          color: white;
        }
        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
        }
        .panel-header h3 {
          margin: 0;
          font-size: 18px;
        }
        .voice-select {
          padding: 8px 12px;
          border-radius: 6px;
          border: 1px solid #333;
          background: #2a2a3e;
          color: white;
          font-size: 14px;
        }
        .text-input textarea {
          width: 100%;
          padding: 12px;
          border-radius: 8px;
          border: 1px solid #333;
          background: #2a2a3e;
          color: white;
          resize: vertical;
          font-size: 14px;
        }
        .controls {
          display: flex;
          gap: 10px;
          margin-top: 15px;
        }
        .generate-btn, .play-btn {
          flex: 1;
          padding: 12px;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.2s;
        }
        .generate-btn {
          background: linear-gradient(135deg, #00d9ff 0%, #00ff88 100%);
          color: #000;
        }
        .generate-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .play-btn {
          background: #4a4a6e;
          color: white;
        }
        .error {
          margin-top: 10px;
          padding: 10px;
          background: rgba(255, 68, 68, 0.2);
          border-radius: 6px;
          color: #ff4444;
          font-size: 14px;
        }
      `}</style>
    </div>
  );
}
