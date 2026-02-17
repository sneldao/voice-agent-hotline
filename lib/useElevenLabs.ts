// ============================================
// useElevenLabs Hook
// ============================================

'use client';

import { useState, useCallback, useRef } from 'react';
import { ElevenLabsService, TTSRequest, AGENT_VOICES } from './elevenlabs';

interface UseElevenLabsReturn {
  isGenerating: boolean;
  isPlaying: boolean;
  error: string | null;
  generateSpeech: (text: string, voiceKey?: keyof typeof AGENT_VOICES) => Promise<Blob | null>;
  playAudio: (audioUrl: string) => void;
  stopAudio: () => void;
  getVoices: () => Promise<void>;
  voices: Array<{ id: string; name: string; description: string }>;
}

export function useElevenLabs(apiKey: string): UseElevenLabsReturn {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voices, setVoices] = useState<Array<{ id: string; name: string; description: string }>>([]);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const serviceRef = useRef<ElevenLabsService | null>(null);

  if (!serviceRef.current && apiKey) {
    serviceRef.current = new ElevenLabsService(apiKey);
  }

  const generateSpeech = useCallback(
    async (text: string, voiceKey: keyof typeof AGENT_VOICES = 'general_advisor'): Promise<Blob | null> => {
      if (!serviceRef.current) {
        setError('ElevenLabs not initialized');
        return null;
      }

      setIsGenerating(true);
      setError(null);

      try {
        const voiceConfig = AGENT_VOICES[voiceKey];
        
        const response = await serviceRef.current.textToSpeech({
          text,
          voiceId: voiceConfig.voice_id,
          stability: 0.5,
          similarityBoost: 0.75,
          style: 0.5,
        });

        // Convert stream to blob
        const chunks: Uint8Array[] = [];
        for await (const chunk of response.audio) {
          chunks.push(new Uint8Array(chunk));
        }
        const blob = new Blob(chunks as BlobPart[], { type: 'audio/mpeg' });

        // Create URL for playback
        const url = URL.createObjectURL(blob);
        if (audioRef.current) {
          audioRef.current.src = url;
        }

        setIsGenerating(false);
        return blob;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'TTS generation failed';
        setError(message);
        setIsGenerating(false);
        return null;
      }
    },
    []
  );

  const playAudio = useCallback((audioUrl: string) => {
    if (audioRef.current) {
      audioRef.current.src = audioUrl;
      audioRef.current.play();
      setIsPlaying(true);
    }
  }, []);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    }
  }, []);

  const getVoices = useCallback(async () => {
    if (!serviceRef.current) return;

    try {
      const voiceList = await serviceRef.current.getVoices();
      setVoices(
        voiceList.map((v) => ({
          id: v.voice_id,
          name: v.name,
          description: v.description || v.labels?.accent || '',
        }))
      );
    } catch (err) {
      console.error('Failed to get voices:', err);
    }
  }, []);

  return {
    isGenerating,
    isPlaying,
    error,
    generateSpeech,
    playAudio,
    stopAudio,
    getVoices,
    voices,
  };
}

// ============================================
// Agent Voice Selector Component Helper
// ============================================

export function getAgentVoice(agentId: string): keyof typeof AGENT_VOICES {
  const voiceMap: Record<string, keyof typeof AGENT_VOICES> = {
    maria_garcia: 'maria_garcia',
    tech_support: 'tech_support',
    general: 'general_advisor',
  };
  return voiceMap[agentId] || 'general_advisor';
}
