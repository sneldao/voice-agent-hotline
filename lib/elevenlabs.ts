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
// Voice IDs are the canonical ElevenLabs premade-voice identifiers.
// Override any entry with a custom cloned-voice ID via environment variables
// (e.g. ELEVENLABS_VOICE_GENERAL_ADVISOR) or through the ElevenLabs dashboard.

export const AGENT_VOICES = {
  general_advisor: {
    voice_id: process.env.ELEVENLABS_VOICE_GENERAL_ADVISOR || 'pNInz6obpgDQGcFmaJgB', // Adam
    name: 'Adam',
    description: 'Professional male voice for general advice',
  },
  maria_garcia: {
    voice_id: process.env.ELEVENLABS_VOICE_MARIA_GARCIA || 'EXAVITQu4vr4xnSDxMaL', // Bella
    name: 'Bella',
    description: 'Warm female voice for customer support',
  },
  tech_support: {
    voice_id: process.env.ELEVENLABS_VOICE_TECH_SUPPORT || 'ErXwobaYiN019PkySvjV', // Antoni
    name: 'Antoni',
    description: 'Clear male voice for technical support',
  },
  crypto_expert: {
    voice_id: process.env.ELEVENLABS_VOICE_CRYPTO_EXPERT || 'TxGEqnHWrfWFTfGW9XjX', // Josh
    name: 'Josh',
    description: 'Confident male voice for crypto advice',
  },
  financial_advisor: {
    voice_id: process.env.ELEVENLABS_VOICE_FINANCIAL_ADVISOR || '21m00Tcm4TlvDq8ikWAM', // Rachel
    name: 'Rachel',
    description: 'Professional female voice for finance',
  },
} as const;

// ============================================
// ENHANCED: Conversational AI Types
// ============================================

export interface AgentTool {
  name: string;
  description: string;
  type?: 'webhook' | 'client' | 'api_integration_webhook';
  configuration?: {
    url: string;
    method: 'POST' | 'GET';
    parameters?: {
      type: 'object';
      properties: Record<string, {
        type: string;
        description?: string;
        enum?: string[];
      }>;
      required?: string[];
    };
  };
}

export interface ConversationalAgentConfig {
  name: string;
  system_prompt: string;
  voice_id: string;
  model?: string; // default: gpt-4
  language?: string; // default: en
  tools?: AgentTool[];
  tool_ids?: string[]; // Recommended: Link to registered tools
  webhook_url?: string; // For tool execution callbacks
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

    // Estimate duration from MP3 bitrate (~128kbps for ElevenLabs output)
    // MP3 frame size varies, but 128kbps is the standard ElevenLabs output rate
    const estimatedDurationSeconds = (audioBuffer.byteLength * 8) / 128000;

    return {
      audio,
      duration: Math.round(estimatedDurationSeconds * 100) / 100,
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
   * Create a new conversational agent (Enhanced V1 Registry Pattern)
   * Updated: ElevenLabs create endpoint is POST /convai/agents/create
   */
  async createAgent(config: ConversationalAgentConfig): Promise<{ agent_id: string }> {
    const response = await fetch(`${ELEVENLABS_API_URL}/convai/agents/create`, {
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
            // Updated to use the new reference pattern
            tool_ids: config.tool_ids || [],
          },
          asr: {
            provider: 'elevenlabs',
            quality: 'high',
          },
          tts: {
            voice_id: config.voice_id,
            model_id: 'eleven_turbo_v2',
            optimize_streaming_latency: 3,
          },
          llm: {
            provider: 'openai',
            model: config.model || 'gpt-4',
          },
        },
        platform_settings: {
          widget: {
            variant: 'full',
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
   * Register a persistent tool in the workspace (Proper Registry Pattern)
   * Updated for ElevenLabs API v1 (2025): requires tool_config wrapper
   */
  async createTool(tool: AgentTool): Promise<{ tool_id: string }> {
    const response = await fetch(`${ELEVENLABS_API_URL}/convai/tools`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': this.apiKey,
      },
      body: JSON.stringify({
        name: tool.name,
        tool_config: {
          type: tool.type || 'webhook',
          name: tool.name,
          description: tool.description,
          api_schema: {
            url: tool.configuration?.url,
            method: tool.configuration?.method || 'POST',
            request_body_schema: tool.configuration?.parameters,
          },
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create tool: ${error}`);
    }

    return await response.json();
  }

  /**
   * List all workspace tools
   */
  async listTools(): Promise<any[]> {
    const response = await fetch(`${ELEVENLABS_API_URL}/convai/tools`, {
      headers: {
        'xi-api-key': this.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to list tools: ${response.statusText}`);
    }

    const data = await response.json();
    return data.tools || [];
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
