// ============================================
// Agent Voice Response System
// ============================================
// Converts AI agent text responses to speech using ElevenLabs

import { ElevenLabsService } from './elevenlabs';

// ============================================
// Types
// ============================================

export interface VoiceResponse {
  text: string;
  audioUrl?: string;
  duration?: number;
  voiceId: string;
  timestamp: Date;
}

export interface AgentPersonality {
  id: string;
  name: string;
  specialty: string;
  rating: number;
  pricePerMinute: number;
  avatar?: string;
  voiceId: string;
  speakingStyle: 'friendly' | 'professional' | 'casual' | 'enthusiastic';
  pace: 'slow' | 'normal' | 'fast';
  toneModifier: number; // 0-1, affects pitch/variation
}

interface AgentVoiceSource {
  id: string;
  name: string;
  specialty: string;
  rating: number;
  rate: number;
  avatar?: string;
  voiceId?: string;
  category?: string;
}

// ============================================
// Predefined Agent Personalities
// ============================================

export const AGENT_PERSONALITIES: Record<string, AgentPersonality> = {
  maria_garcia: {
    id: 'maria_garcia',
    name: 'Maria Garcia',
    specialty: 'Spanish Tutor',
    rating: 4.93,
    pricePerMinute: 0.01,
    avatar: '👩‍🏫',
    voiceId: '21m00Tcm4TlvDq8ikWAM', // Rachel
    speakingStyle: 'friendly',
    pace: 'normal',
    toneModifier: 0.7,
  },
  tech_support: {
    id: 'tech_support',
    name: 'Tech Support',
    specialty: 'Technical Help',
    rating: 4.85,
    pricePerMinute: 0.03,
    avatar: '👨‍💻',
    voiceId: 'AZnzlk1XvdvUeBnqxgGO', // Josh
    speakingStyle: 'professional',
    pace: 'normal',
    toneModifier: 0.3,
  },
  general_advisor: {
    id: 'general_advisor',
    name: 'Bella',
    specialty: 'General Advisor',
    rating: 4.78,
    pricePerMinute: 0.02,
    avatar: '👩‍💼',
    voiceId: 'EXAVITQu4vr4xnSDxMaL', // Bella
    speakingStyle: 'friendly',
    pace: 'normal',
    toneModifier: 0.5,
  },
  chef_mario: {
    id: 'chef_mario',
    name: 'Chef Mario',
    specialty: 'Italian Cuisine',
    rating: 4.91,
    pricePerMinute: 0.02,
    avatar: '👨‍🍳',
    voiceId: 'nPczCjz82ySBk5oxzD6y', // Mario
    speakingStyle: 'enthusiastic',
    pace: 'normal',
    toneModifier: 0.6,
  },
};

export const DEFAULT_AGENT_PERSONALITY = AGENT_PERSONALITIES.general_advisor;

export function createAgentPersonality(agent: AgentVoiceSource): AgentPersonality {
  const speakingStyle = getSpeakingStyle(agent);
  const pace = speakingStyle === 'casual' ? 'fast' : 'normal';

  return {
    id: agent.id,
    name: agent.name,
    specialty: agent.specialty,
    rating: agent.rating,
    pricePerMinute: agent.rate,
    avatar: agent.avatar,
    voiceId: agent.voiceId || DEFAULT_AGENT_PERSONALITY.voiceId,
    speakingStyle,
    pace,
    toneModifier: getToneModifier(speakingStyle),
  };
}

// ============================================
// Response Templates
// ============================================

const GREETING_TEMPLATES = [
  "Hello! How can I help you today?",
  "Hi there! Welcome to VOISSS. What would you like to discuss?",
  "Hey! I'm here to assist you. What's on your mind?",
];

const CLOSING_TEMPLATES = [
  "Is there anything else I can help you with?",
  "Feel free to reach out anytime. Have a great day!",
  "Let me know if you need anything else. Bye for now!",
];

// ============================================
// Voice Response Service
// ============================================

export class AgentVoiceResponse {
  private tts: ElevenLabsService;
  private cache: Map<string, VoiceResponse> = new Map();
  private personality: AgentPersonality;

  constructor(apiKey: string, personality: AgentPersonality) {
    this.tts = new ElevenLabsService(apiKey, personality.voiceId);
    this.personality = personality;
  }

  /**
   * Set agent personality
   */
  setPersonality(personality: AgentPersonality) {
    this.personality = personality;
  }

  /**
   * Generate greeting in agent's voice
   */
  async generateGreeting(): Promise<VoiceResponse> {
    const template = GREETING_TEMPLATES[
      Math.floor(Math.random() * GREETING_TEMPLATES.length)
    ];
    return this.generateResponse(template);
  }

  /**
   * Generate closing in agent's voice
   */
  async generateClosing(): Promise<VoiceResponse> {
    const template = CLOSING_TEMPLATES[
      Math.floor(Math.random() * CLOSING_TEMPLATES.length)
    ];
    return this.generateResponse(template);
  }

  /**
   * Generate voice response from text
   */
  async generateResponse(text: string): Promise<VoiceResponse> {
    // Check cache
    const cacheKey = `${this.personality.id}:${text}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    try {
      const response = await this.tts.textToSpeech({
        text,
        voiceId: this.personality.voiceId,
        stability: this.getStability(),
        similarityBoost: 0.75,
        style: this.personality.toneModifier,
        useSpeakerBoost: true,
      });

      // Create blob URL for playback
      const chunks: Uint8Array[] = [];
      for await (const chunk of response.audio) {
        chunks.push(new Uint8Array(chunk));
      }
      const blob = new Blob(chunks as BlobPart[], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(blob);

      const voiceResponse: VoiceResponse = {
        text,
        audioUrl,
        duration: response.duration,
        voiceId: this.personality.voiceId,
        timestamp: new Date(),
      };

      // Cache the response (limit cache size)
      if (this.cache.size > 100) {
        const firstKey = this.cache.keys().next().value as string;
        const old = this.cache.get(firstKey);
        if (old?.audioUrl) URL.revokeObjectURL(old.audioUrl);
        this.cache.delete(firstKey);
      }
      this.cache.set(cacheKey, voiceResponse);

      return voiceResponse;
    } catch (error) {
      console.error('Voice generation failed:', error);
      return {
        text,
        voiceId: this.personality.voiceId,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Stream response for long text
   */
  async *generateStreamingResponse(text: string): AsyncGenerator<VoiceResponse> {
    // Split text into sentences for incremental generation
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    
    for (const sentence of sentences) {
      yield this.generateResponse(sentence.trim());
    }
  }

  /**
   * Get stability setting based on personality
   */
  private getStability(): number {
    switch (this.personality.speakingStyle) {
      case 'enthusiastic':
        return 0.3;
      case 'casual':
        return 0.4;
      case 'friendly':
        return 0.5;
      case 'professional':
        return 0.6;
      default:
        return 0.5;
    }
  }

  /**
   * Get pace multiplier
   */
  getPaceMultiplier(): number {
    switch (this.personality.pace) {
      case 'slow':
        return 0.8;
      case 'fast':
        return 1.2;
      default:
        return 1.0;
    }
  }

  /**
   * Clean up resources
   */
  cleanup() {
    for (const response of this.cache.values()) {
      if (response.audioUrl) {
        URL.revokeObjectURL(response.audioUrl);
      }
    }
    this.cache.clear();
  }
}

function getSpeakingStyle(agent: AgentVoiceSource): AgentPersonality['speakingStyle'] {
  const category = agent.category?.toLowerCase() || '';
  const specialty = agent.specialty.toLowerCase();

  if (category === 'finance' || specialty.includes('advisor')) {
    return 'professional';
  }

  if (category === 'tech' || specialty.includes('engineer') || specialty.includes('infrastructure')) {
    return 'professional';
  }

  if (specialty.includes('travel') || specialty.includes('guide') || specialty.includes('concierge')) {
    return 'enthusiastic';
  }

  if (specialty.includes('blockchain') || specialty.includes('analyst')) {
    return 'casual';
  }

  return 'friendly';
}

function getToneModifier(style: AgentPersonality['speakingStyle']): number {
  switch (style) {
    case 'enthusiastic':
      return 0.7;
    case 'casual':
      return 0.4;
    case 'professional':
      return 0.35;
    default:
      return 0.5;
  }
}

// ============================================
// Usage Example
// ============================================

/*
const response = new AgentVoiceResponse(
  process.env.ELEVENLABS_API_KEY!,
  AGENT_PERSONALITIES.maria_garcia
);

// Generate greeting
const greeting = await response.generateGreeting();
console.log('Text:', greeting.text);
console.log('Audio:', greeting.audioUrl);
console.log('Duration:', greeting.duration);

// Stream a response
for await (const chunk of response.generateStreamingResponse(
  'Hola! Me llamo Maria. Como estas hoy? Que te gustaria aprender?'
)) {
  console.log('Chunk:', chunk.text);
}

// Clean up when done
response.cleanup();
*/
