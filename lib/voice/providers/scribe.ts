/**
 * ElevenLabs Scribe Provider (STT)
 * 
 * Scribe v2 - state-of-the-art transcription with speaker diarization
 * Supports 90+ languages, word-level timestamps, and real-time
 */

import { AudioInput, TextOutput, STTProviderConfig, VoiceError } from '../types'

export interface ScribeProvider {
  transcribe(input: AudioInput): Promise<TextOutput>
  getConfig(): STTProviderConfig
}

export interface ScribeWord {
  text: string
  start: number
  end: number
  type: 'word' | 'spacing' | 'audio_event'
  speaker_id?: string
}

export interface ScribeResult {
  text: string
  language_code: string
  language_probability: number
  words: ScribeWord[]
}

export class ElevenLabsScribeProvider implements ScribeProvider {
  private apiKey: string
  private config: STTProviderConfig
  private baseUrl = 'https://api.elevenlabs.io/v1'

  constructor(config: STTProviderConfig) {
    this.config = config
    this.apiKey = config.apiKey || process.env.ELEVENLABS_API_KEY || ''
    
    if (!this.apiKey) {
      console.warn('[STT] No API key provided - using mock mode')
    }
  }

  async transcribe(input: AudioInput): Promise<TextOutput> {
    // Mock mode for demo/hackathon
    if (!this.apiKey) {
      return this.mockTranscribe(input)
    }

    try {
      // Convert input data to proper format
      let blobData: Uint8Array
      if (input.data instanceof Uint8Array) {
        blobData = input.data
      } else if (input.data instanceof ArrayBuffer) {
        blobData = new Uint8Array(input.data)
      } else {
        blobData = new Uint8Array(await input.data.arrayBuffer())
      }

      const formData = new FormData()
      formData.append('file', new Blob([blobData as any]), 'audio.wav')
      formData.append('model_id', 'scribe_v2')  // Use standard Scribe for accuracy
      formData.append('language_code', this.config.language || 'en')
      
      if (this.config.timestampsGranularity) {
        formData.append('timestamps_granularity', this.config.timestampsGranularity)
      }
      
      if (this.config.diarize) {
        formData.append('diarize', 'true')
      }

      const response = await fetch(`${this.baseUrl}/scribe`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: formData
      })

      if (!response.ok) {
        const error = await response.text()
        throw new VoiceError(
          `ElevenLabs Scribe API error: ${error}`,
          'STT_ERROR'
        )
      }

      const result: ScribeResult = await response.json()

      return {
        text: result.text,
        confidence: result.language_probability,
        language: result.language_code
      }
    } catch (error) {
      if (error instanceof VoiceError) throw error
      throw new VoiceError(
        `STT transcription failed: ${error}`,
        'STT_ERROR',
        error as Error
      )
    }
  }

  private mockTranscribe(input: AudioInput): TextOutput {
    // Mock for demo
    return {
      text: 'Hello, I would like to learn more about your services.',
      confidence: 0.95,
      language: 'en'
    }
  }

  getConfig(): STTProviderConfig {
    return { ...this.config }
  }
}

// Factory function for provider selection
export function createSTTProvider(config: STTProviderConfig): any {
  switch (config.provider) {
    case 'whisper':
      // Import dynamically to avoid circular deps
      return { 
        transcribe: async (input: AudioInput) => ({ text: 'Whisper not implemented', confidence: 0, language: 'en' }),
        getConfig: () => config 
      }
    case 'elevenlabs-scribe':
      return new ElevenLabsScribeProvider(config)
    default:
      return { 
        transcribe: async (input: AudioInput) => ({ text: 'STT not configured', confidence: 0, language: 'en' }),
        getConfig: () => config 
      }
  }
}
