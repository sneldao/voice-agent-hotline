// ============================================
// useAgentVoice Hook
// ============================================
// React hook for managing AI agent voice responses

'use client';

import { useState, useCallback, useRef } from 'react';
import { AgentVoiceResponse, AgentPersonality, AGENT_PERSONALITIES } from './agent-voice';

interface UseAgentVoiceReturn {
  isSpeaking: boolean;
  isGenerating: boolean;
  error: string | null;
  currentResponse: VoiceMessage | null;
  speak: (text: string) => Promise<void>;
  stopSpeaking: () => void;
  setPersonality: (agentId: string) => void;
  generateGreeting: () => Promise<void>;
}

interface VoiceMessage {
  text: string;
  audioUrl: string;
  duration: number;
}

export function useAgentVoice(apiKey: string, initialAgentId: string = 'general_advisor') {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentResponse, setCurrentResponse] = useState<VoiceMessage | null>(null);
  
  const voiceRef = useRef<AgentVoiceResponse | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize voice service
  if (!voiceRef.current && apiKey) {
    const personality = AGENT_PERSONALITIES[initialAgentId] || AGENT_PERSONALITIES.general_advisor;
    voiceRef.current = new AgentVoiceResponse(apiKey, personality);
  }

  const setPersonality = useCallback((agentId: string) => {
    if (voiceRef.current) {
      const personality = AGENT_PERSONALITIES[agentId] || AGENT_PERSONALITIES.general_advisor;
      voiceRef.current.setPersonality(personality);
    }
  }, []);

  const speak = useCallback(async (text: string) => {
    if (!voiceRef.current) {
      setError('Voice service not initialized');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const response = await voiceRef.current.generateResponse(text);
      
      if (response.audioUrl) {
        // Stop any currently playing audio
        if (audioRef.current) {
          audioRef.current.pause();
        }

        // Create new audio element
        const audio = new Audio(response.audioUrl);
        audioRef.current = audio;

        audio.onplay = () => {
          setIsGenerating(false);
          setIsSpeaking(true);
          setCurrentResponse({
            text: response.text,
            audioUrl: response.audioUrl || '',
            duration: response.duration || 0,
          });
        };

        audio.onended = () => {
          setIsSpeaking(false);
        };

        audio.onerror = () => {
          setError('Audio playback failed');
          setIsSpeaking(false);
          setIsGenerating(false);
        };

        audio.play();
      } else {
        setIsGenerating(false);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Speech generation failed';
      setError(message);
      setIsGenerating(false);
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsSpeaking(false);
    setCurrentResponse(null);
  }, []);

  const generateGreeting = useCallback(async () => {
    if (!voiceRef.current) {
      setError('Voice service not initialized');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const response = await voiceRef.current.generateGreeting();
      
      if (response.audioUrl) {
        if (audioRef.current) {
          audioRef.current.pause();
        }

        const audio = new Audio(response.audioUrl);
        audioRef.current = audio;

        audio.onplay = () => {
          setIsGenerating(false);
          setIsSpeaking(true);
        };

        audio.onended = () => {
          setIsSpeaking(false);
        };

        audio.play();
      } else {
        setIsGenerating(false);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Greeting generation failed';
      setError(message);
      setIsGenerating(false);
    }
  }, []);

  return {
    isSpeaking,
    isGenerating,
    error,
    currentResponse,
    speak,
    stopSpeaking,
    setPersonality,
    generateGreeting,
  };
}
