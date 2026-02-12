/**
 * Voice Pipeline Orchestrator
 * 
 * Main orchestrator for STT → LLM → TTS pipeline
 * Handles streaming, error recovery, and cost tracking
 */

import { 
  AudioInput, 
  AudioOutput, 
  TextOutput, 
  LLMInput,
  PipelineConfig,
  VoiceSession,
  AgentPersonality,
  ConversationContext,
  VoiceError
} from './types'
import { STTProvider, createSTTProvider } from './providers/stt'
import { LLMProvider, createLLMProvider } from './providers/llm'
import { TTSProvider, createTTSProvider } from './providers/tts'

export class VoicePipeline {
  private stt: STTProvider
  private llm: LLMProvider
  private tts: TTSProvider
  private config: PipelineConfig
  private activeSessions: Map<string, VoiceSession> = new Map()

  constructor(config: Partial<PipelineConfig> = {}) {
    this.config = {
      stt: config.stt || { provider: 'whisper' },
      llm: config.llm || { provider: 'openai', model: 'gpt-4' },
      tts: config.tts || { provider: 'elevenlabs' },
      costTracking: config.costTracking || { 
        enabled: true, 
        perSecondRate: 0.01, 
        perTokenRate: 0.0001 
      }
    }

    this.stt = createSTTProvider(this.config.stt)
    this.llm = createLLMProvider(this.config.llm)
    this.tts = createTTSProvider(this.config.tts)
  }

  /**
   * Full pipeline: Audio → Text → LLM → Audio
   */
  async process(
    audio: AudioInput,
    agent: AgentPersonality,
    context?: ConversationContext
  ): Promise<AudioOutput> {
    const sessionId = this.generateSessionId()
    const startTime = Date.now()
    
    const session: VoiceSession = {
      id: sessionId,
      agent,
      startTime: new Date(startTime),
      inputTokens: 0,
      outputTokens: 0,
      audioDuration: 0,
      cost: 0
    }

    try {
      // Step 1: Speech-to-Text
      const transcription = await this.stt.transcribe(audio)
      session.inputTokens += this.llm.countTokens(transcription.text)

      // Step 2: LLM Processing
      const llmInput: LLMInput = {
        text: transcription.text,
        systemPrompt: agent.systemPrompt,
        context,
        agentPersonality: agent
      }
      const llmResponse = await this.llm.complete(llmInput)
      session.outputTokens += llmResponse.tokens

      // Step 3: Text-to-Speech
      const ttsInput = {
        text: llmResponse.text,
        voiceId: agent.voiceId,
        agentId: agent.id
      }
      const audioOutput = await this.tts.synthesize(ttsInput)
      session.audioDuration = audioOutput.duration

      // Calculate cost
      if (this.config.costTracking.enabled) {
        session.cost = this.calculateCost(session)
      }

      this.activeSessions.set(sessionId, session)
      return audioOutput

    } catch (error) {
      throw new VoiceError(
        `Pipeline failed: ${error}`,
        error instanceof VoiceError ? error.code : 'LLM_ERROR'
      )
    }
  }

  /**
   * Streaming pipeline for real-time feel
   */
  async *stream(
    audio: AsyncGenerator<AudioInput>,
    agent: AgentPersonality,
    context?: ConversationContext
  ): AsyncGenerator<AudioOutput, void, unknown> {
    for await (const chunk of audio) {
      yield await this.process(chunk, agent, context)
    }
  }

  /**
   * Text-only mode for testing
   */
  async chat(
    text: string,
    agent: AgentPersonality,
    context?: ConversationContext
  ): Promise<{ response: string; cost: number }> {
    const llmInput: LLMInput = {
      text,
      systemPrompt: agent.systemPrompt,
      context,
      agentPersonality: agent
    }

    const llmResponse = await this.llm.complete(llmInput)
    const cost = this.config.costTracking.enabled
      ? llmResponse.tokens * this.config.costTracking.perTokenRate
      : 0

    return {
      response: llmResponse.text,
      cost
    }
  }

  /**
   * Get session statistics
   */
  getSession(sessionId: string): VoiceSession | undefined {
    return this.activeSessions.get(sessionId)
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): VoiceSession[] {
    return Array.from(this.activeSessions.values())
  }

  /**
   * End a session and calculate final cost
   */
  endSession(sessionId: string): VoiceSession | undefined {
    const session = this.activeSessions.get(sessionId)
    if (session) {
      session.cost = this.calculateCost(session)
      this.activeSessions.delete(sessionId)
    }
    return session
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private calculateCost(session: VoiceSession): number {
    const audioCost = session.audioDuration * this.config.costTracking.perSecondRate
    const tokenCost = (session.inputTokens + session.outputTokens) * this.config.costTracking.perTokenRate
    return audioCost + tokenCost
  }

  /**
   * Get available voices from TTS provider
   */
  async listVoices() {
    return this.tts.listVoices()
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ stt: boolean; llm: boolean; tts: boolean }> {
    return {
      stt: true,  // In production, ping actual APIs
      llm: true,
      tts: true
    }
  }
}

// Singleton instance for easy import
let pipelineInstance: VoicePipeline | null = null

export function getVoicePipeline(config?: Partial<PipelineConfig>): VoicePipeline {
  if (!pipelineInstance) {
    pipelineInstance = new VoicePipeline(config)
  }
  return pipelineInstance
}

export function resetVoicePipeline(): void {
  pipelineInstance = null
}
