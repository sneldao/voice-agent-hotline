// ============================================
// ElevenLabs Text-to-Speech Integration
// ============================================
// High-quality voice synthesis for AI agents
// API: https://elevenlabs.io/api

import { Readable } from 'stream';

// ============================================
// Configuration
// ============================================

const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';

// ============================================
// Types
// ============================================

export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category: string;
  description: string;
  preview_url: string;
  labels: Record<string, string>;
}

export interface TTSRequest {
  text: string;
  voiceId?: string;
  modelId?: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
  useSpeakerBoost?: boolean;
}

export interface TTSResponse {
  audio: Readable;
  duration: number;
}

// ============================================
// ElevenLabs Service
// ============================================

export class ElevenLabsService {
  private apiKey: string;
  private defaultVoiceId: string;

  constructor(apiKey: string, defaultVoiceId: string = '21m00Tcm4TlvDq8ikWAM') {
    this.apiKey = apiKey;
    this.defaultVoiceId = defaultVoiceId;
  }

  /**
   * Get available voices
   */
  async getVoices(): Promise<ElevenLabsVoice[]> {
    const response = await fetch(`${ELEVENLABS_API_URL}/voices`, {
      headers: {
        'xi-api-key': this.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get voices: ${response.statusText}`);
    }

    const data = await response.json();
    return data.voices as ElevenLabsVoice[];
  }

  /**
   * Convert text to speech
   */
  async textToSpeech(request: TTSRequest): Promise<TTSResponse> {
    const {
      text,
      voiceId = this.defaultVoiceId,
      modelId = 'eleven_monolingual_v1',
      stability = 0.5,
      similarityBoost = 0.75,
      style = 0,
      useSpeakerBoost = true,
    } = request;

    const response = await fetch(
      `${ELEVENLABS_API_URL}/text-to-speech/${voiceId}?optimize_streaming_latency=4`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model_id: modelId,
          voice_settings: {
            stability,
            similarity_boost: similarityBoost,
            style,
            use_speaker_boost: useSpeakerBoost,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`TTS failed: ${error}`);
    }

    // Get duration from headers
    const duration = parseFloat(response.headers.get('x-duration') || '0');

    return {
      audio: Readable.fromWeb(response.body as any),
      duration,
    };
  }

  /**
   * Get voice by ID
   */
  async getVoice(voiceId: string): Promise<ElevenLabsVoice> {
    const response = await fetch(`${ELEVENLABS_API_URL}/voices/${voiceId}`, {
      headers: {
        'xi-api-key': this.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get voice: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get remaining character quota
   */
  async getQuota(): Promise<{ character_count: number; character_limit: number }> {
    const response = await fetch(`${ELEVENLABS_API_URL}/user`, {
      headers: {
        'xi-api-key': this.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get quota: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      character_count: data.subscription?.character_count || 0,
      character_limit: data.subscription?.character_limit || 0,
    };
  }
}

// ============================================
// Agent Voice Profiles
// ============================================

export const AGENT_VOICES = {
  maria_garcia: {
    voiceId: '21m00Tcm4TlvDq8ikWAM',
    name: 'Rachel',
    description: 'Native Spanish tutor voice',
    style: 0.3,
  },
  tech_support: {
    voiceId: 'AZnzlk1XvdvUeBnqxgGO',
    name: 'Josh',
    description: 'Professional tech support voice',
    style: 0.2,
  },
  general_advisor: {
    voiceId: 'EXAVITQu4vr4xnSDxMaL',
    name: 'Bella',
    description: 'Friendly general advisor',
    style: 0.5,
  },
} as const;

// ============================================
// Usage Examples
// ============================================

/*
// Initialize service
const elevenLabs = new ElevenLabsService(
  process.env.ELEVENLABS_API_KEY!,
  AGENT_VOICES.maria_garcia.voiceId
);

// Get available voices
const voices = await elevenLabs.getVoices();
console.log('Available voices:', voices);

// Generate speech
const { audio, duration } = await elevenLabs.textToSpeech({
  text: 'Hola! Soy Maria, tu tutora de español.',
  voiceId: AGENT_VOICES.maria_garcia.voiceId,
  stability: 0.5,
  similarityBoost: 0.75,
});

// Save to file or stream to user
const buffer = await streamToBuffer(audio);
await writeFile('output.mp3', buffer);
*/
