'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Mic, Phone, X, Loader2 } from 'lucide-react';
import type { Agent } from '@/lib/types';

type RouterState = 'idle' | 'listening' | 'routing' | 'matched' | 'confirming';

interface VoiceRouterProps {
  agents: Agent[];
  onCallAgent: (agent: Agent) => void;
}

type BrowserSpeechRecognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

// Simple intent → agent matching using keyword overlap
function matchAgentToIntent(intent: string, agents: Agent[]): Agent | null {
  if (!intent || agents.length === 0) return null;

  const lower = intent.toLowerCase();
  const tokens = lower.split(/\s+/).filter(t => t.length > 2);

  // Keyword maps for routing
  const INTENT_KEYWORDS: Record<string, string[]> = {
    healthcare: ['doctor', 'health', 'medical', 'symptom', 'medicine', 'wellness', 'sick', 'pain', 'appointment', 'diagnosis', 'nutrition', 'diet', 'exercise', 'mental'],
    research: ['research', 'find', 'search', 'look up', 'compare', 'article', 'paper', 'news', 'information', 'learn', 'explain', 'laptop', 'review'],
    tech: ['code', 'debug', 'programming', 'bug', 'error', 'deploy', 'github', 'api', 'server', 'database', 'next.js', 'react', 'typescript', 'payment'],
    blockchain: ['crypto', 'wallet', 'transaction', 'blockchain', 'token', 'defi', 'solana', 'celo', 'ethereum', 'nft', 'swap'],
    general: ['help', 'plan', 'book', 'schedule', 'remind', 'order', 'trip', 'travel', 'recipe', 'cook', 'dinner', 'weekend'],
  };

  // Score each agent
  let bestAgent: Agent | null = null;
  let bestScore = 0;

  for (const agent of agents) {
    if (!agent.online) continue;

    let score = 0;
    const category = (agent.category || '').toLowerCase();
    const specialty = (agent.specialty || '').toLowerCase();
    const bio = (agent.bio || '').toLowerCase();

    // Check intent keywords against agent category
    const categoryKeywords = INTENT_KEYWORDS[category] || [];
    for (const keyword of categoryKeywords) {
      if (lower.includes(keyword)) score += 3;
    }

    // Check tokens against specialty and bio
    for (const token of tokens) {
      if (specialty.includes(token)) score += 2;
      if (bio.includes(token)) score += 1;
    }

    // Bonus for online + high rating
    if (agent.online) score += 1;
    if ((agent.rating || 0) >= 4) score += 1;

    if (score > bestScore) {
      bestScore = score;
      bestAgent = agent;
    }
  }

  // If no strong match, fall back to general helper
  if (bestScore < 2) {
    return agents.find(a => (a.category || '').toLowerCase() === 'general' && a.online) || agents[0];
  }

  return bestAgent;
}

export function VoiceRouter({ agents, onCallAgent }: VoiceRouterProps) {
  const [state, setState] = useState<RouterState>('idle');
  const [transcript, setTranscript] = useState('');
  const [matchedAgent, setMatchedAgent] = useState<Agent | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const confirmRecognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      confirmRecognitionRef.current?.abort();
      window.speechSynthesis?.cancel();
    };
  }, []);

  const getSpeechRecognition = useCallback(() => {
    if (typeof window === 'undefined') return null;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return null;
    return new SR() as BrowserSpeechRecognition;
  }, []);

  const speakText = useCallback((text: string): Promise<void> => {
    return new Promise((resolve) => {
      if (!window.speechSynthesis) { resolve(); return; }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.1;
      utterance.pitch = 1.0;
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      synthRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    });
  }, []);

  const startListening = useCallback(() => {
    const recognition = getSpeechRecognition();
    if (!recognition) return;

    recognitionRef.current = recognition;
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    setState('listening');
    setTranscript('');
    setMatchedAgent(null);
    setConfirmText('');

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      setTranscript(finalTranscript || interimTranscript);
    };

    recognition.onend = () => {
      // When speech ends, route the intent
      setTranscript(prev => {
        if (prev.trim()) {
          routeIntent(prev.trim());
        } else {
          setState('idle');
        }
        return prev;
      });
    };

    recognition.onerror = () => {
      setState('idle');
      setTranscript('');
    };

    try {
      recognition.start();
    } catch {
      setState('idle');
    }
  }, [agents, getSpeechRecognition]);

  const routeIntent = useCallback(async (intent: string) => {
    setState('routing');

    // Brief pause for dramatic effect
    await new Promise(r => setTimeout(r, 800));

    const agent = matchAgentToIntent(intent, agents);
    if (!agent) {
      setState('idle');
      setTranscript('');
      return;
    }

    setMatchedAgent(agent);
    setState('matched');

    // Speak the match
    const confirmMessage = `I found ${agent.name}. ${agent.specialty}. Say yes to connect, or cancel.`;
    setConfirmText(confirmMessage);
    await speakText(confirmMessage);

    // Listen for "yes" confirmation
    setState('confirming');
    listenForConfirmation(agent);
  }, [agents, speakText]);

  const listenForConfirmation = useCallback((agent: Agent) => {
    const recognition = getSpeechRecognition();
    if (!recognition) {
      // No speech recognition for confirmation — just wait for tap
      return;
    }

    confirmRecognitionRef.current = recognition;
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onresult = (event: any) => {
      const result = event.results[0]?.[0]?.transcript?.toLowerCase().trim() || '';
      if (result.includes('yes') || result.includes('yeah') || result.includes('go') || result.includes('connect') || result.includes('call') || result.includes('start')) {
        onCallAgent(agent);
        reset();
      } else if (result.includes('no') || result.includes('cancel') || result.includes('stop') || result.includes('nevermind')) {
        reset();
      }
    };

    recognition.onerror = () => {};
    recognition.onend = () => {};

    try {
      recognition.start();
    } catch {
      // Fallback: user can tap the button
    }
  }, [getSpeechRecognition, onCallAgent]);

  const reset = useCallback(() => {
    recognitionRef.current?.abort();
    confirmRecognitionRef.current?.abort();
    window.speechSynthesis?.cancel();
    setState('idle');
    setTranscript('');
    setMatchedAgent(null);
    setConfirmText('');
  }, []);

  const handleMicClick = useCallback(() => {
    if (state === 'idle') {
      startListening();
    } else {
      reset();
    }
  }, [state, startListening, reset]);

  // Mic button size and style based on state
  const micStyles = {
    idle: 'h-20 w-20 bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 hover:scale-105',
    listening: 'h-24 w-24 bg-gradient-to-br from-cyan-400 to-blue-500 shadow-xl shadow-cyan-500/50 animate-pulse scale-110',
    routing: 'h-20 w-20 bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/30',
    matched: 'h-20 w-20 bg-gradient-to-br from-emerald-500 to-green-600 shadow-lg shadow-emerald-500/30',
    confirming: 'h-20 w-20 bg-gradient-to-br from-emerald-500 to-green-600 shadow-lg shadow-emerald-500/30 animate-pulse',
  };

  const statusText = {
    idle: 'Tap to speak your request',
    listening: 'Listening...',
    routing: 'Finding the right voice...',
    matched: 'Match found',
    confirming: 'Say "yes" to connect',
  };

  return (
    <div className="relative rounded-2xl border border-gray-800 bg-gray-900/90 p-6 text-center">
      {/* Routing lines animation */}
      {(state === 'routing' || state === 'matched' || state === 'confirming') && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
          <div className="absolute left-1/2 top-1/2 h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-500/20 animate-ping" />
          <div className="absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-500/10 animate-ping" style={{ animationDelay: '0.5s' }} />
        </div>
      )}

      {/* Mic button */}
      <div className="relative z-10 mb-4 flex justify-center">
        <button
          onClick={handleMicClick}
          className={`relative flex items-center justify-center rounded-full transition-all duration-300 ${micStyles[state]}`}
          aria-label={state === 'idle' ? 'Start voice request' : 'Cancel'}
        >
          {state === 'routing' ? (
            <Loader2 className="h-8 w-8 text-white animate-spin" />
          ) : state === 'idle' ? (
            <Mic className="h-8 w-8 text-white" />
          ) : state === 'listening' ? (
            <Mic className="h-10 w-10 text-white" />
          ) : (
            <Phone className="h-8 w-8 text-white" />
          )}
        </button>
      </div>

      {/* Status */}
      <p className="relative z-10 mb-2 text-sm font-medium text-gray-300">
        {statusText[state]}
      </p>

      {/* Transcript */}
      {transcript && (
        <div className="relative z-10 mx-auto mb-3 max-w-sm rounded-xl bg-gray-800/70 px-4 py-2">
          <p className="text-sm text-white italic">"{transcript}"</p>
        </div>
      )}

      {/* Matched agent card */}
      {matchedAgent && (state === 'matched' || state === 'confirming') && (
        <div className="relative z-10 mx-auto mb-3 max-w-sm rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${matchedAgent.color || 'from-cyan-500 to-blue-500'} text-lg`}>
              {matchedAgent.avatar || matchedAgent.name.charAt(0)}
            </div>
            <div className="min-w-0 text-left">
              <p className="truncate font-semibold text-white">{matchedAgent.name}</p>
              <p className="truncate text-xs text-emerald-200">{matchedAgent.specialty}</p>
            </div>
            <button
              onClick={() => onCallAgent(matchedAgent)}
              className="ml-auto flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white transition-colors hover:bg-emerald-400"
              aria-label="Connect now"
            >
              <Phone className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Cancel button when active */}
      {state !== 'idle' && (
        <button
          onClick={reset}
          className="relative z-10 mx-auto mt-2 flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs text-gray-400 transition-colors hover:text-white"
        >
          <X className="h-3 w-3" />
          Cancel
        </button>
      )}

      {/* Idle state hint */}
      {state === 'idle' && (
        <p className="relative z-10 mt-1 text-xs text-gray-500">
          Or tap an agent below to call directly
        </p>
      )}
    </div>
  );
}
