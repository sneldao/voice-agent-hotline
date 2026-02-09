// Voice Service - ElevenLabs + VOISSS + Browser fallback

export interface VoiceResult {
  audioUrl: string;
  duration: number;
  cost: number;
  provider: string;
}

export interface VoiceConfig {
  elevenLabsApiKey?: string;
  voisssEndpoint?: string;
  defaultVoice?: string;
}

export class VoiceService {
  private elevenLabsUrl = 'https://api.elevenlabs.io/v1';
  private config: VoiceConfig;

  constructor(config: VoiceConfig = {}) {
    this.config = config;
  }

  /**
   * Convert text to speech with fallback chain
   */
  async speak(text: string): Promise<VoiceResult> {
    // Try ElevenLabs first
    if (this.config.elevenLabsApiKey) {
      try {
        return await this.elevenLabs(text);
      } catch (e) {
        console.warn('[Voice] ElevenLabs failed, falling back');
      }
    }

    // Try VOISSS
    if (this.config.voisssEndpoint) {
      try {
        return await this.voisss(text);
      } catch (e) {
        console.warn('[Voice] VOISSS failed, falling back');
      }
    }

    // Browser TTS as last resort
    return this.browserTTS(text);
  }

  /**
   * ElevenLabs TTS
   */
  private async elevenLabs(text: string): Promise<VoiceResult> {
    const voiceId = this.config.defaultVoice || 'pNInz6obpgDQGcFmaJgB'; // Adam

    const response = await fetch(
      `${this.elevenLabsUrl}/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': this.config.elevenLabsApiKey!,
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`ElevenLabs error: ${response.statusText}`);
    }

    // In production, upload to CDN and return URL
    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);

    return {
      audioUrl,
      duration: text.split(/\s+/).length / 2.5, // ~2.5 words/sec
      cost: text.length * 0.000001, // ~$0.000001/char
      provider: 'elevenlabs',
    };
  }

  /**
   * VOISSS TTS with x402 payments
   */
  private async voisss(text: string): Promise<VoiceResult> {
    if (!this.config.voisssEndpoint) {
      throw new Error('VOISSS endpoint not configured');
    }

    const response = await fetch(`${this.config.voisssEndpoint}/vocalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voiceId: this.config.defaultVoice }),
    });

    if (response.status === 402) {
      throw new Error('Payment required');
    }

    const data = await response.json();
    return {
      audioUrl: data.audioUrl,
      duration: 0,
      cost: 0.00001 * text.length,
      provider: 'voisss',
    };
  }

  /**
   * Browser Speech API fallback
   */
  private browserTTS(text: string): VoiceResult {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      return {
        audioUrl: '',
        duration: 0,
        cost: 0,
        provider: 'browser',
      };
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;

    // Get English voice
    const voices = window.speechSynthesis.getVoices();
    utterance.voice = voices.find(v => v.lang.startsWith('en')) || voices[0];

    window.speechSynthesis.speak(utterance);

    return {
      audioUrl: '',
      duration: text.split(/\s+/).length / 2.5,
      cost: 0,
      provider: 'browser',
    };
  }

  /**
   * Get available voices
   */
  async getVoices(): Promise<Array<{ id: string; name: string; gender: string }>> {
    if (!this.config.elevenLabsApiKey) {
      return [
        { id: 'default', name: 'Default Browser Voice', gender: 'unknown' },
      ];
    }

    try {
      const response = await fetch(`${this.elevenLabsUrl}/voices`, {
        headers: { 'xi-api-key': this.config.elevenLabsApiKey! },
      });

      const data = await response.json();
      return data.voices.map((v: { voice_id: string; name: string; labels: { gender: string } }) => ({
        id: v.voice_id,
        name: v.name,
        gender: v.labels?.gender || 'unknown',
      }));
    } catch {
      return [
        { id: 'default', name: 'Default', gender: 'unknown' },
      ];
    }
  }
}

// Factory
export function createVoiceService(config?: VoiceConfig): VoiceService {
  return new VoiceService(config);
}

// Browser type augmentation
declare global {
  interface Window {
    speechSynthesis: SpeechSynthesis;
  }
}
