/**
 * Large Language Model Provider (LLM)
 * 
 * OpenAI GPT-4 implementation
 * Handles agent personality and conversation context
 */

import { LLMInput, LLMOutput, LLMProviderConfig, VoiceError } from '../types'

export interface LLMProvider {
  complete(input: LLMInput): Promise<LLMOutput>
  getConfig(): LLMProviderConfig
  countTokens(text: string): number
}

export class OpenAIProvider implements LLMProvider {
  private apiKey: string
  private config: LLMProviderConfig

  constructor(config: LLMProviderConfig) {
    this.config = config
    this.apiKey = config.apiKey || process.env.OPENAI_API_KEY || ''
    
    if (!this.apiKey) {
      console.warn('[LLM] No API key provided - using mock mode')
    }
  }

  async complete(input: LLMInput): Promise<LLMOutput> {
    // Mock mode for demo/hackathon
    if (!this.apiKey) {
      return this.mockComplete(input)
    }

    try {
      const messages = this.buildMessages(input)

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.config.model,
          messages,
          max_tokens: this.config.maxTokens || 500,
          temperature: this.config.temperature || 0.7,
          stream: false
        })
      })

      if (!response.ok) {
        throw new VoiceError(
          `LLM API error: ${response.statusText}`,
          'LLM_ERROR'
        )
      }

      const result = await response.json()

      return {
        text: result.choices[0].message.content,
        tokens: result.usage.total_tokens,
        model: this.config.model
      }
    } catch (error) {
      if (error instanceof VoiceError) throw error
      throw new VoiceError(
        `LLM completion failed: ${error}`,
        'LLM_ERROR',
        error as Error
      )
    }
  }

  private buildMessages(input: LLMInput) {
    const messages = [
      { role: 'system', content: input.systemPrompt }
    ]

    // Add agent personality if provided
    if (input.agentPersonality) {
      messages.push({
        role: 'system',
        content: `Your name is ${input.agentPersonality.name}. ${input.agentPersonality.systemPrompt}`
      })
    }

    // Add conversation history
    if (input.context?.history) {
      messages.push(...input.context.history)
    }

    // Add current user input
    messages.push({ role: 'user', content: input.text })

    return messages
  }

  private mockComplete(input: LLMInput): LLMOutput {
    // Mock for demo - returns contextual response
    const responses = [
      "I'd be happy to help you with that! What specific information are you looking for?",
      "That's a great question. Let me explain how our AI agents work...",
      "I can definitely assist you with that. Our platform offers real-time voice interactions with verified AI agents.",
      "Thanks for asking! Our per-minute billing through x402 ensures you only pay for what you use."
    ]

    return {
      text: responses[Math.floor(Math.random() * responses.length)],
      tokens: 25,
      model: this.config.model
    }
  }

  getConfig(): LLMProviderConfig {
    return { ...this.config }
  }

  countTokens(text: string): number {
    // Rough approximation: 4 chars per token
    return Math.ceil(text.length / 4)
  }
}

// Factory function for provider selection
export function createLLMProvider(config: LLMProviderConfig): LLMProvider {
  switch (config.provider) {
    case 'openai':
      return new OpenAIProvider(config)
    case 'anthropic':
      // Placeholder for Anthropic integration
      return new OpenAIProvider({ ...config, provider: 'openai' })
    default:
      return new OpenAIProvider({ ...config, provider: 'openai' })
  }
}
