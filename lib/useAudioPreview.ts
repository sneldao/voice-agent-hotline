'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Agent voice preview audio files.
 * Files must exist in /public/audio/ for previews to play.
 * hasPreview() checks whether a file has been verified to load,
 * not just whether a mapping entry exists — so the UI never shows
 * a play button for a non-existent file.
 *
 * To generate previews: run `npx tsx scripts/generate-voice-previews.ts`
 * (requires ELEVENLABS_API_KEY) which creates the MP3s via TTS.
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
  /** Whether a verified preview file exists for this agent */
  hasPreview: (agentId: string) => boolean;
}

/**
 * Track which audio files have been verified to exist via HEAD request.
 * Cached for the session — once verified, doesn't re-check.
 */
const verifiedFiles = new Set<string>();
const checkingFiles = new Set<string>();

export function useAudioPreview(): UseAudioPreviewReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingAgentId, setPlayingAgentId] = useState<string | null>(null);
  const [, forceUpdate] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Probe all preview files on mount to populate verifiedFiles
  useEffect(() => {
    for (const [agentId, src] of Object.entries(AGENT_AUDIO_PREVIEWS)) {
      if (verifiedFiles.has(src) || checkingFiles.has(src)) continue;
      checkingFiles.add(src);
      fetch(src, { method: 'HEAD' })
        .then(res => {
          if (res.ok) verifiedFiles.add(src);
        })
        .catch(() => {})
        .finally(() => {
          checkingFiles.delete(src);
          forceUpdate(n => n + 1);
        });
    }
  }, []);

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
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    const src = AGENT_AUDIO_PREVIEWS[agentId];
    if (!src || !verifiedFiles.has(src)) return;

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
      verifiedFiles.delete(src);
      setIsPlaying(false);
      setPlayingAgentId(null);
      audioRef.current = null;
    });

    audio.play().catch(() => {
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
    const src = AGENT_AUDIO_PREVIEWS[agentId];
    return !!src && verifiedFiles.has(src);
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
