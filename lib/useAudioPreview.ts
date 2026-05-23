'use client';

import { useState, useRef, useCallback } from 'react';

/**
 * Agent voice preview audio files.
 * In production, generate these with ElevenLabs TTS and store in /public/audio/.
 * For now, we define the mapping and the hook handles playback gracefully
 * even when files don't exist yet (fails silently).
 */
const AGENT_AUDIO_PREVIEWS: Record<string, string> = {
  general_helper: '/audio/preview-general-helper.mp3',
  medical_advisor: '/audio/preview-medical-advisor.mp3',
  web_researcher: '/audio/preview-web-researcher.mp3',
  code_reviewer: '/audio/preview-code-reviewer.mp3',
  solana_sage: '/audio/preview-solana-sage.mp3',
  tour_master: '/audio/preview-tour-master.mp3',
};

interface UseAudioPreviewReturn {
  /** Whether audio is currently playing */
  isPlaying: boolean;
  /** The agent ID currently playing (null if none) */
  playingAgentId: string | null;
  /** Start playing a preview for an agent */
  play: (agentId: string) => void;
  /** Stop any currently playing preview */
  stop: () => void;
  /** Toggle play/stop for an agent */
  toggle: (agentId: string) => void;
  /** Whether a preview file exists for this agent */
  hasPreview: (agentId: string) => boolean;
}

/**
 * Hook for playing agent voice preview audio clips.
 * Handles loading, playback, and cleanup.
 * Fails gracefully if audio files don't exist.
 */
export function useAudioPreview(): UseAudioPreviewReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingAgentId, setPlayingAgentId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setIsPlaying(false);
    setPlayingAgentId(null);
  }, []);

  const play = useCallback((agentId: string) => {
    // Stop any current playback
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    const src = AGENT_AUDIO_PREVIEWS[agentId];
    if (!src) {
      // No preview available — fail silently
      return;
    }

    const audio = new Audio(src);
    audioRef.current = audio;
    setPlayingAgentId(agentId);
    setIsPlaying(true);

    audio.addEventListener('ended', () => {
      setIsPlaying(false);
      setPlayingAgentId(null);
      audioRef.current = null;
    });

    audio.addEventListener('error', () => {
      // File doesn't exist or can't load — fail silently
      setIsPlaying(false);
      setPlayingAgentId(null);
      audioRef.current = null;
    });

    audio.play().catch(() => {
      // Autoplay blocked or file missing
      setIsPlaying(false);
      setPlayingAgentId(null);
      audioRef.current = null;
    });
  }, []);

  const toggle = useCallback((agentId: string) => {
    if (isPlaying && playingAgentId === agentId) {
      stop();
    } else {
      play(agentId);
    }
  }, [isPlaying, playingAgentId, play, stop]);

  const hasPreview = useCallback((agentId: string) => {
    return agentId in AGENT_AUDIO_PREVIEWS;
  }, []);

  return {
    isPlaying,
    playingAgentId,
    play,
    stop,
    toggle,
    hasPreview,
  };
}
