/**
 * Voice Pipeline - Example Usage
 * 
 * Demonstrates how to use the modular voice pipeline
 */

import {
  VoicePipeline,
  CostTracker,
  AgentPersonality,
  ConversationContext,
  AudioInput
} from './'

// ============================================================================
// EXAMPLE 1: Basic Voice Conversation
// ============================================================================

async function basicExample() {
  const pipeline = new VoicePipeline()
  const tracker = new CostTracker()

  // Define an agent
  const therapist: AgentPersonality = {
    id: 'therapist',
    name: 'Dr. Sarah',
    voiceId: '21m00Tcm4TlvDq8ikWAM',
    systemPrompt: 'You are a compassionate therapist who listens actively and provides thoughtful insights.',
    traits: ['empathetic', 'patient', 'insightful']
  }

  // Simulated user audio (in production, from microphone)
  const userAudio: AudioInput = {
    data: new Uint8Array(1024), // Placeholder audio data
    mimeType: 'audio/webm'
  }

  // Process the conversation
  const responseAudio = await pipeline.process(userAudio, therapist)

  // Get cost
  const sessions = pipeline.getActiveSessions()
  const cost = tracker.calculateCost(sessions[0])
  console.log(`Session cost: $${(cost.totalCost || 0).toFixed(4)}`)

  // Play response to user (Web Audio API in browser)
  // playAudio(responseAudio.data)
}

// ============================================================================
// EXAMPLE 2: Text Chat Mode (for testing without audio)
// ============================================================================

async function textChatExample() {
  const pipeline = new VoicePipeline()

  const agent: AgentPersonality = {
    id: 'coding-assistant',
    name: 'CodeBot',
    voiceId: 'MF3mGyEYrkw8f8mmU3L0',
    systemPrompt: 'You are a helpful coding assistant.',
    traits: ['precise', 'technical', 'patient']
  }

  // Conversation context
  const context: ConversationContext = {
    sessionId: 'session_123',
    history: [
      { role: 'user', content: 'How do I use the voice pipeline?' },
      { role: 'assistant', content: 'The voice pipeline is modular...' }
    ]
  }

  // Chat without audio
  const result = await pipeline.chat(
    'Can you show me an example?',
    agent,
    context
  )

  console.log('Response:', result.response)
  console.log('Cost:', `$${(result.cost || 0).toFixed(6)}`)
}

// ============================================================================
// EXAMPLE 3: Multi-Agent Handoff
// ============================================================================

async function multiAgentExample() {
  const pipeline = new VoicePipeline()

  const agents: Record<string, AgentPersonality> = {
    sales: {
      id: 'sales',
      name: 'Alex',
      voiceId: 'AZnzlk1XvdvUe5bTIl8b',
      systemPrompt: 'You are a friendly sales representative.',
      traits: ['enthusiastic', 'helpful']
    },
    support: {
      id: 'support',
      name: 'Sam',
      voiceId: '21m00Tcm4TlvDq8ikWAM',
      systemPrompt: 'You are a helpful support agent.',
      traits: ['patient', 'technical']
    }
  }

  // Route to appropriate agent
  async function routeToAgent(message: string): Promise<string> {
    // Simple keyword-based routing
    if (message.toLowerCase().includes('buy') || 
        message.toLowerCase().includes('price')) {
      return 'sales'
    }
    return 'support'
  }

  const userMessage = "I'd like to know about pricing"
  const agentId = await routeToAgent(userMessage)
  const agent = agents[agentId]

  console.log(`Routing to: ${agent.name}`)
}

// ============================================================================
// EXAMPLE 4: Cost Tracking & Reporting
// ============================================================================

async function costTrackingExample() {
  const tracker = new CostTracker()

  // Simulate multiple sessions
  const sessions = [
    {
      id: 'session_1',
      agent: { id: 'sales', name: 'Alex', voiceId: 'xxx', systemPrompt: '', traits: [] },
      startTime: new Date(),
      inputTokens: 150,
      outputTokens: 200,
      audioDuration: 45,
      cost: 0
    },
    {
      id: 'session_2',
      agent: { id: 'support', name: 'Sam', voiceId: 'yyy', systemPrompt: '', traits: [] },
      startTime: new Date(),
      inputTokens: 300,
      outputTokens: 400,
      audioDuration: 90,
      cost: 0
    }
  ]

  sessions.forEach(s => tracker.trackSession(s))

  // Get reports
  const daily = tracker.getUsageReport('daily')
  const weekly = tracker.getUsageReport('weekly')

  console.log('Daily Report:', daily)
  console.log('Weekly Report:', weekly)

  // Export for x402 payment
  const payment = tracker.exportForPayment('session_1')
  console.log('Payment data:', payment)
}

// ============================================================================
// EXAMPLE 5: Voice Selection
// ============================================================================

async function voiceSelectionExample() {
  const pipeline = new VoicePipeline()

  // List available voices
  const voices = await pipeline.listVoices()

  console.log('Available voices:')
  voices.forEach(v => {
    console.log(`  - ${v.name} (${v.gender}, ${v.accent})`)
  })

  // Select voice
  const selectedVoice = voices[0]  // Rachel
  console.log(`Selected: ${selectedVoice.name}`)
}

// Run examples if this file is executed directly
if (require.main === module) {
  console.log('Running examples...\n')
  
  basicExample()
    .then(() => console.log('\n✓ Basic example complete\n'))
    .catch(console.error)
}

export {
  basicExample,
  textChatExample,
  multiAgentExample,
  costTrackingExample,
  voiceSelectionExample
}
