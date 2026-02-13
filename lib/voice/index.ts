/**
 * Voice Pipeline - Main Export
 * 
 * Modular STT → LLM → TTS pipeline for voice agents
 * 
 * Usage:
 *   import { VoicePipeline, getVoicePipeline, CostTracker, getCostTracker } from '@/lib/voice'
 * 
 * @see lib/voice/README.md for full documentation
 */

// Core pipeline
export { VoicePipeline, getVoicePipeline, resetVoicePipeline } from './pipeline'

// Providers - use type exports for interfaces
export type { STTProvider } from './providers/stt'
export { WhisperProvider, createSTTProvider } from './providers/stt'

export type { LLMProvider } from './providers/llm'
export { OpenAIProvider, createLLMProvider } from './providers/llm'

export type { TTSProvider, VoiceProfile } from './providers/tts'
export { ElevenLabsProvider, createTTSProvider } from './providers/tts'

export type { ElevenLabsScribeProvider } from './providers/scribe'
export { createSTTProvider as createScribeProvider } from './providers/scribe'

// WebRTC voice streaming
export type { VoiceCallOptions } from './webrtc'
export { WebRTCVoiceService, createVoiceCall } from './webrtc'

// Cost tracking
export { CostTracker, getCostTracker, resetCostTracker } from './cost'

// Types
export * from './types'
