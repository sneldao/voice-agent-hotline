/**
 * Speech-to-Text Provider (STT)
 * 
 * OpenAI Whisper implementation
 * Pluggable provider - swap out for any STT service
 */

import { AudioInput, TextOutput, STTProviderConfig, VoiceError } from '../types'

export interface STTProvider {
  transcribe(input: AudioInput): Promise<TextOutput>
  getConfig(): STTProviderConfig
}

export class WhisperProvider implements STTProvider {
  private apiKey: string
  private config: STTProviderConfig

  constructor(config: STTProviderConfig) {
    this.config = config
    this.apiKey = config.apiKey || process.env.OPENAI_API_KEY || ''
    
    if (!this.apiKey) {
      console.warn('[STT] No API key provided - using mock mode')
    }
  }

  async transcribe(input: AudioInput): Promise<TextOutput> {
    // Mock mode for demo/hackathon without API key
    if (!this.apiKey) {
      return this.mockTranscribe(input)
    }

    try {
      const formData = new FormData()
      // Convert input data to proper Blob for FormData
      let blobData: Uint8Array
      if (input.data instanceof Uint8Array) {
        blobData = input.data
      } else if (input.data instanceof ArrayBuffer) {
        blobData = new Uint8Array(input.data)
      } else {
        // Blob - convert to array buffer first
        blobData = new Uint8Array(await input.data.arrayBuffer())
      }
      formData.append('file', new Blob([blobData as any]), 'audio.wav')
      formData.append('model', 'whisper-1')
      formData.append('language', this.config.language || 'en')
      formData.append('response_format', 'verbose_json')

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: formData
      })

      if (!response.ok) {
        throw new VoiceError(
          `STT API error: ${response.statusText}`,
          'STT_ERROR'
        )
      }

      const result = await response.json()

      return {
        text: result.text,
        confidence: result.confidence || 0.95,
        language: result.language
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
    // Mock for demo - returns expected format
    return {
      text: 'Hello, I would like to learn more about your services.',
      confidence: 0.92,
      language: 'en'
    }
  }

  getConfig(): STTProviderConfig {
    return { ...this.config }
  }
}

// Factory function for provider selection
export function createSTTProvider(config: STTProviderConfig): STTProvider {
  switch (config.provider) {
    case 'whisper':
      return new WhisperProvider(config)
    default:
      return new WhisperProvider({ ...config, provider: 'whisper' })
  }
}
