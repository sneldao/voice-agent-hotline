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

// Providers
export { STTProvider, WhisperProvider, createSTTProvider } from './providers/stt'
export { LLMProvider, OpenAIProvider, createLLMProvider } from './providers/llm'
export { TTSProvider, ElevenLabsProvider, createTTSProvider, VoiceProfile } from './providers/tts'
export { ElevenLabsScribeProvider, createSTTProvider as createScribeProvider } from './providers/scribe'

// WebRTC voice streaming
export { WebRTCVoiceService, createVoiceCall, VoiceCallOptions } from './webrtc'

// Cost tracking
export { CostTracker, getCostTracker, resetCostTracker } from './cost'

// Types
export * from './types'
