# Voice Pipeline

Modular STT → LLM → TTS pipeline for voice agents.

## Architecture

```
┌─────────────────────────────────────────────────┐
│              VoicePipeline                       │
│  ┌─────────┐   ┌─────────┐   ┌─────────┐       │
│  │   STT   │ → │   LLM   │ → │   TTS   │       │
│  │(Whisper)│   │(GPT-4)  │   │ElevenLabs│      │
│  └─────────┘   └─────────┘   └─────────┘       │
└─────────────────────────────────────────────────┘
```

## Quick Start

```typescript
import { getVoicePipeline, AgentPersonality } from '@/lib/voice'

// Create pipeline with default config
const pipeline = getVoicePipeline()

// Define an agent
const agent: AgentPersonality = {
  id: 'therapist',
  name: 'Dr. Sarah',
  voiceId: '21m00Tcm4TlvDq8ikWAM',
  systemPrompt: 'You are a compassionate therapist...',
  traits: ['empathetic', 'patient', 'insightful']
}

// Process voice input
const audio = await fetch('/user-message.wav')
const response = await pipeline.process(audio, agent)

// Send audio to user
play(response.data)
```

## Configuration

### Environment Variables

```env
OPENAI_API_KEY=sk-...
ELEVENLABS_API_KEY=xi_...
```

### Custom Config

```typescript
import { VoicePipeline } from '@/lib/voice'

// Optimized for real-time voice agents (ultra-low latency)
const pipeline = new VoicePipeline({
  // STT: Use 'whisper' or 'elevenlabs-scribe' for native ElevenLabs
  stt: { 
    provider: 'whisper', 
    language: 'en',
    diarize: true  // Know WHO said WHAT
  },
  
  // LLM: GPT-4 for agent intelligence
  llm: { 
    provider: 'openai', 
    model: 'gpt-4', 
    temperature: 0.7 
  },
  
  // TTS: eleven_flash_v2_5 for ultra-low latency (~75ms)
  tts: { 
    provider: 'elevenlabs',
    model: 'eleven_flash_v2_5',  // Ultra-low latency for real-time
    stability: 0.5,
    similarityBoost: 0.75,
    style: 0.2,
    speakerBoost: true
  },
  
  costTracking: { enabled: true, perSecondRate: 0.01, perTokenRate: 0.0001 }
})
```

### Model Selection Guide

| Use Case | STT Model | TTS Model |
|----------|-----------|-----------|
| Real-time voice agent | `whisper` or `elevenlabs-scribe` | `eleven_flash_v2_5` (~75ms) |
| Highest quality | `scribe_v2` | `eleven_v3` |
| Balanced | `whisper` | `eleven_multilingual_v2` |
```

## Cost Tracking

```typescript
import { getCostTracker } from '@/lib/voice'

const tracker = getCostTracker()

// After a session
const cost = tracker.trackCost(session)
console.log(`Session cost: $${cost.totalCost.toFixed(4)}`)

// Usage report
const report = tracker.getUsageReport('daily')
console.log(report)
```

## API Reference

### VoicePipeline

| Method | Description |
|--------|-------------|
| `process(audio, agent, context?)` | Full pipeline: Audio → Text → LLM → Audio |
| `chat(text, agent, context?)` | Text-only mode for testing |
| `stream(audio, agent)` | Streaming for real-time feel |
| `getSession(id)` | Get session details |
| `listVoices()` | List available TTS voices |
| `healthCheck()` | Check provider connectivity |

### Providers

All providers implement pluggable interfaces:

- **STT**: Whisper (default), Google STT, Azure Speech
- **LLM**: OpenAI GPT-4 (default), Anthropic Claude
- **TTS**: ElevenLabs (default), Azure TTS, Amazon Polly

## File Structure

```
lib/voice/
├── index.ts          # Main exports
├── types.ts          # TypeScript interfaces
├── pipeline.ts       # Main orchestrator
├── cost.ts          # Billing & cost tracking
├── README.md        # This file
└── providers/
    ├── stt.ts       # Speech-to-Text
    ├── llm.ts       # Language Model
    └── tts.ts       # Text-to-Speech
```

## Core Principles

| Principle | Implementation |
|----------|----------------|
| **MODULAR** | Each provider independently testable |
| **DRY** | Shared providers across agents |
| **CLEAN** | Clear STT → LLM → TTS separation |
| **PERFORMANT** | Streaming, cost tracking, caching |
| **ORGANIZED** | `lib/voice/` domain folder |

## Integration with x402

```typescript
import { getCostTracker } from '@/lib/voice'

const tracker = getCostTracker()

// Export usage for x402 payment
const payment = tracker.exportForPayment(sessionId)

// Send to payment contract
await x402Payment.send(payment)
```

## Examples

See `docs/examples/voice-pipeline/` for complete examples.
