/**
 * Voice Pipeline Types
 * 
 * Modular, pluggable interfaces for STT → LLM → TTS pipeline
 * Following Core Principles: CLEAN, MODULAR, DRY
 */

export interface AudioInput {
  data: Uint8Array | ArrayBuffer | Blob
  mimeType: string
  duration?: number
}

export interface TextOutput {
  text: string
  confidence: number
  language?: string
}

export interface LLMInput {
  text: string
  systemPrompt: string
  context?: ConversationContext
  agentPersonality?: AgentPersonality
}

export interface LLMOutput {
  text: string
  tokens: number
  model: string
}

export interface TTSInput {
  text: string
  voiceId: string
  agentId?: string
}

export interface AudioOutput {
  data: Buffer
  mimeType: string
  duration: number
}

export interface ConversationContext {
  history: Array<{ role: 'user' | 'assistant'; content: string }>
  sessionId: string
  userId?: string
}

export interface AgentPersonality {
  id: string
  name: string
  voiceId: string
  systemPrompt: string
  traits: string[]
}

export interface PipelineConfig {
  stt: STTProviderConfig
  llm: LLMProviderConfig
  tts: TTSProviderConfig
  costTracking: CostTrackingConfig
}

export interface STTProviderConfig {
  provider: 'whisper' | 'elevenlabs-scribe' | 'custom'
  apiKey?: string
  language?: string
  enablePunctuation?: boolean
  // ElevenLabs Scribe specific
  diarize?: boolean       // Speaker diarization - know WHO said WHAT
  timestampsGranularity?: 'word' | 'sentence'
  keyterms?: string[]    // Help recognize specific terms
}

export interface LLMProviderConfig {
  provider: 'openai' | 'anthropic' | 'custom'
  apiKey?: string
  model: string
  maxTokens?: number
  temperature?: number
}

export interface TTSProviderConfig {
  provider: 'elevenlabs' | 'custom'
  apiKey?: string
  defaultVoiceId?: string
  // Voice settings
  stability?: number        // 0-1: Lower=expressive, Higher=consistent
  similarityBoost?: number // 0-1: Higher=more like reference voice
  style?: number           // 0-1: Exaggerates voice characteristics
  speakerBoost?: boolean  // Enhances clarity
  // Model selection
  model?: string          // 'eleven_flash_v2_5' (ultra-low latency), 'eleven_multilingual_v2' (high quality), 'eleven_v3' (best quality)
}

export interface CostTrackingConfig {
  enabled: boolean
  perSecondRate: number
  perTokenRate: number
}

export interface VoiceSession {
  id: string
  agent: AgentPersonality
  startTime: Date
  inputTokens: number
  outputTokens: number
  audioDuration: number
  cost: number
}

export class VoiceError extends Error {
  constructor(
    message: string,
    public code: 'STT_ERROR' | 'LLM_ERROR' | 'TTS_ERROR' | 'COST_ERROR',
    public original?: Error
  ) {
    super(message)
    this.name = 'VoiceError'
  }
}
