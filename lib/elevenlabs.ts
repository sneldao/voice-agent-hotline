// ============================================
// ElevenLabs Integration (TTS + Conversational AI)
// ============================================
// Enhanced: Added Conversational AI SDK for full voice agent conversations
// API: https://elevenlabs.io/docs

import { Readable } from 'stream';

// ============================================
// Configuration
// ============================================

const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';

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
// Agent Voice Configurations
// ============================================

export const AGENT_VOICES = {
  general_advisor: {
    voice_id: 'Adam',
    name: 'Adam',
    description: 'Professional male voice for general advice',
  },
  maria_garcia: {
    voice_id: 'Bella',
    name: 'Bella',
    description: 'Warm female voice for customer support',
  },
  tech_support: {
    voice_id: 'Antoni',
    name: 'Antoni',
    description: 'Clear male voice for technical support',
  },
  crypto_expert: {
    voice_id: 'Josh',
    name: 'Josh',
    description: 'Confident male voice for crypto advice',
  },
  financial_advisor: {
    voice_id: 'Rachel',
    name: 'Rachel',
    description: 'Professional female voice for finance',
  },
} as const;

// ============================================
// ENHANCED: Conversational AI Types
// ============================================

export interface ConversationalAgentConfig {
  name: string;
  system_prompt: string;
  voice_id: string;
  model?: string; // default: gpt-4
  language?: string; // default: en
  tools?: AgentTool[];
  webhook_url?: string; // For tool execution callbacks
}

export interface AgentTool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description?: string;
      enum?: string[];
    }>;
    required?: string[];
  };
}

export interface ConversationRequest {
  agent_id: string;
  metadata?: Record<string, any>; // Pass session_id, user_wallet, etc.
}

export interface ConversationResponse {
  conversation_id: string;
  agent_id: string;
  call_url: string; // Web-based call URL
  phone_number?: string; // Phone number (if available)
  status: 'active' | 'ended';
  created_at: string;
}

// ============================================
// ElevenLabs Service (Enhanced)
// ============================================

export class ElevenLabsService {
  private apiKey: string;
  private defaultVoiceId: string;

  constructor(apiKey?: string, defaultVoiceId?: string) {
    this.apiKey = apiKey || ELEVENLABS_API_KEY;
    this.defaultVoiceId = defaultVoiceId || process.env.ELEVENLABS_DEFAULT_VOICE || 'Adam';

    if (!this.apiKey) {
      console.warn('[ElevenLabs] API key not configured');
    }
  }

  // ============================================
  // TTS Methods (Existing)
  // ============================================

  async textToSpeech(request: TTSRequest): Promise<TTSResponse> {
    const voiceId = request.voiceId || this.defaultVoiceId;

    const response = await fetch(
      `${ELEVENLABS_API_URL}/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': this.apiKey,
        },
        body: JSON.stringify({
          text: request.text,
          model_id: request.modelId || 'eleven_monolingual_v1',
          voice_settings: {
            stability: request.stability ?? 0.5,
            similarity_boost: request.similarityBoost ?? 0.75,
            style: request.style ?? 0,
            use_speaker_boost: request.useSpeakerBoost ?? true,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`ElevenLabs TTS failed: ${response.statusText}`);
    }

    const audioBuffer = await response.arrayBuffer();
    const audio = Readable.from(Buffer.from(audioBuffer));

    return {
      audio,
      duration: 0, // TODO: Calculate from audio
    };
  }

  async getVoices(): Promise<ElevenLabsVoice[]> {
    const response = await fetch(`${ELEVENLABS_API_URL}/voices`, {
      headers: {
        'xi-api-key': this.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch voices: ${response.statusText}`);
    }

    const data = await response.json();
    return data.voices;
  }

  // ============================================
  // ENHANCED: Conversational AI Methods
  // ============================================

  /**
   * Create a new conversational agent
   */
  async createAgent(config: ConversationalAgentConfig): Promise<{ agent_id: string }> {
    const response = await fetch(`${ELEVENLABS_API_URL}/convai/agents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': this.apiKey,
      },
      body: JSON.stringify({
        name: config.name,
        conversation_config: {
          agent: {
            prompt: {
              prompt: config.system_prompt,
            },
            first_message: `Hello! I'm ${config.name}. How can I help you today?`,
            language: config.language || 'en',
            tools: config.tools || [], // Add tools here
          },
          asr: {
            provider: 'elevenlabs', // Auto STT
            quality: 'high',
          },
          tts: {
            voice_id: config.voice_id,
            model_id: 'eleven_turbo_v2_5',
            optimize_streaming_latency: 3,
          },
          llm: {
            provider: 'openai',
            model: config.model || 'gpt-4',
            tool_call_config: config.tools && config.tools.length > 0 ? {
              tool_webhook_url: config.webhook_url,
            } : undefined,
          },
        },
        platform_settings: {
          widget: {
            variant: 'full_screen',
          },
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create agent: ${error}`);
    }

    return await response.json();
  }

  /**
   * Update agent configuration (tools, prompts, etc.)
   */
  async updateAgent(agentId: string, config: Partial<ConversationalAgentConfig>): Promise<void> {
    const response = await fetch(`${ELEVENLABS_API_URL}/convai/agents/${agentId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': this.apiKey,
      },
      body: JSON.stringify(config),
    });

    if (!response.ok) {
      throw new Error(`Failed to update agent: ${response.statusText}`);
    }
  }

  /**
   * Start a conversation with an agent
   */
  async startConversation(request: ConversationRequest): Promise<ConversationResponse> {
    const response = await fetch(`${ELEVENLABS_API_URL}/convai/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': this.apiKey,
      },
      body: JSON.stringify({
        agent_id: request.agent_id,
        metadata: request.metadata || {},
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to start conversation: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      conversation_id: data.conversation_id,
      agent_id: data.agent_id,
      call_url: data.url || `https://elevenlabs.io/app/convai/${data.conversation_id}`,
      status: 'active',
      created_at: new Date().toISOString(),
    };
  }

  /**
   * Get conversation details
   */
  async getConversation(conversationId: string): Promise<any> {
    const response = await fetch(
      `${ELEVENLABS_API_URL}/convai/conversations/${conversationId}`,
      {
        headers: {
          'xi-api-key': this.apiKey,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get conversation: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * End a conversation
   */
  async endConversation(conversationId: string): Promise<void> {
    const response = await fetch(
      `${ELEVENLABS_API_URL}/convai/conversations/${conversationId}/end`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': this.apiKey,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to end conversation: ${response.statusText}`);
    }
  }
}

// ============================================
// Singleton Export (Backward Compatible)
// ============================================

export const elevenLabsService = new ElevenLabsService();
