/**
 * Text-to-Speech Provider (TTS)
 * 
 * ElevenLabs implementation
 * High-quality voice synthesis with voice cloning support
 */

import { TTSInput, AudioOutput, TTSProviderConfig, VoiceError } from '../types'

export interface TTSProvider {
  synthesize(input: TTSInput): Promise<AudioOutput>
  getConfig(): TTSProviderConfig
  listVoices(): Promise<VoiceProfile[]>
}

export interface VoiceProfile {
  id: string
  name: string
  category: string
  gender: string
  accent: string
  samples: string[]
}

export class ElevenLabsProvider implements TTSProvider {
  private apiKey: string
  private config: TTSProviderConfig
  private baseUrl = 'https://api.elevenlabs.io/v1'

  constructor(config: TTSProviderConfig) {
    this.config = config
    this.apiKey = config.apiKey || process.env.ELEVENLABS_API_KEY || ''
    
    if (!this.apiKey) {
      console.warn('[TTS] No API key provided - using mock mode')
    }
  }

  async synthesize(input: TTSInput): Promise<AudioOutput> {
    // Mock mode for demo/hackathon
    if (!this.apiKey) {
      return this.mockSynthesize(input)
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/text-to-speech/${input.voiceId}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'audio/mpeg'
          },
          body: JSON.stringify({
            text: input.text,
            // Use eleven_flash_v2_5 for ultra-low latency (~75ms) for real-time voice agents
            // For highest quality, use 'eleven_v3' or 'eleven_multilingual_v2'
            model_id: this.config.model || 'eleven_flash_v2_5',
            voice_settings: {
              stability: this.config.stability ?? 0.5,
              similarity_boost: this.config.similarityBoost ?? 0.75,
              style: this.config.style ?? 0.2,
              use_speaker_boost: this.config.speakerBoost ?? true
            },
            // Optimize for streaming
            output_format: 'mp3_44100_128'
          })
        }
      )

      if (!response.ok) {
        const error = await response.text()
        throw new VoiceError(
          `ElevenLabs API error: ${error}`,
          'TTS_ERROR'
        )
      }

      const audioBuffer = await response.arrayBuffer()
      const duration = this.estimateDuration(input.text)

      return {
        data: Buffer.from(audioBuffer),
        mimeType: 'audio/mpeg',
        duration
      }
    } catch (error) {
      if (error instanceof VoiceError) throw error
      throw new VoiceError(
        `TTS synthesis failed: ${error}`,
        'TTS_ERROR',
        error as Error
      )
    }
  }

  private estimateDuration(text: string): number {
    // Rough estimate: 3 characters per second for natural speech
    return Math.ceil(text.length / 3)
  }

  private mockSynthesize(input: TTSInput): AudioOutput {
    // Mock for demo - returns silent audio placeholder
    // In production, this would return real ElevenLabs audio
    const duration = this.estimateDuration(input.text)
    
    // Create a simple WAV header for a short beep
    const sampleRate = 16000
    const numSamples = duration * sampleRate
    const buffer = Buffer.alloc(44 + numSamples * 2)
    
    // WAV header
    buffer.write('RIFF', 0)
    buffer.writeUInt32LE(36 + numSamples * 2, 4)
    buffer.write('WAVE', 8)
    buffer.write('fmt ', 12)
    buffer.writeUInt32LE(16, 16)
    buffer.writeUInt16LE(1, 20)
    buffer.writeUInt16LE(1, 22)
    buffer.writeUInt32LE(sampleRate, 24)
    buffer.writeUInt32LE(sampleRate * 2, 28)
    buffer.writeUInt16LE(2, 32)
    buffer.writeUInt16LE(16, 34)
    buffer.write('data', 36)
    buffer.writeUInt32LE(numSamples * 2, 40)

    // Silent audio
    buffer.fill(0, 44)

    return {
      data: buffer,
      mimeType: 'audio/wav',
      duration
    }
  }

  async listVoices(): Promise<VoiceProfile[]> {
    // Return mock voices for demo
    return [
      {
        id: '21m00Tcm4TlvDq8ikWAM',
        name: 'Rachel',
        category: 'premade',
        gender: 'female',
        accent: 'american',
        samples: []
      },
      {
        id: 'AZnzlk1XvdvUe5bTIl8b',
        name: 'Domi',
        category: 'premade',
        gender: 'female',
        accent: 'american',
        samples: []
      },
      {
        id: 'MF3mGyEYrkw8f8mmU3L0',
        name: 'Adam',
        category: 'premade',
        gender: 'male',
        accent: 'american',
        samples: []
      }
    ]
  }

  getConfig(): TTSProviderConfig {
    return { ...this.config }
  }
}

// Factory function for provider selection
export function createTTSProvider(config: TTSProviderConfig): TTSProvider {
  switch (config.provider) {
    case 'elevenlabs':
      return new ElevenLabsProvider(config)
    default:
      return new ElevenLabsProvider({ ...config, provider: 'elevenlabs' })
  }
}
