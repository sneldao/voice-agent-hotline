# voice-agent-hotline - Agent Marketplace v9

## Status: in_progress
## Completion: 60%
## Deadline: 2026-02-15 (Celo Hackathon) + Ongoing

## 🎯 Mission: Build production-ready voice agent marketplace
External autonomous agents can register, set their rates, and users can call them via voice.

---

## v9 ROADMAP - Voice Agent Marketplace

### Phase 1: Agent Registry & Directory (In Progress)
- [x] ERC-8004 agent identity foundation
- [ ] Agent registration API
- [ ] Agent directory listing
- [ ] Search/filter by capability, rate, rating

### Phase 2: ElevenLabs Integration (Complete)
- [x] TTS: eleven_flash_v2_5 (~75ms latency)
- [x] STT: Whisper provider
- [x] ElevenLabs Scribe provider with diarization
- [ ] WebRTC voice streaming
- [ ] Real-time call handling

### Phase 3: Marketplace Features
- [ ] Agent rate configuration ($/minute)
- [ ] Ratings & reputation system
- [ ] x402 micropayments per second
- [ ] Call history & transcripts

### Phase 4: Production Readiness
- [ ] Error handling & retries
- [ ] Rate limiting & abuse prevention
- [ ] Analytics & monitoring
- [ ] Load testing

---

## Current Ratings (Target: 9/10)
- **Product Design: 8.5/10**
- **Architecture: 9/10** ✅
- **UI/UX: 9/10** ✅
- **Agent Experience: 9/10** ✅
- **Marketplace Features: 5/10** 🚧
- **Overall: 7.5/10** 🎯

---

## Completed Features
- ✅ Voice pipeline (STT → LLM → TTS)
- ✅ ElevenLabs optimized settings
- ✅ AgentSkillsPanel
- ✅ ERC-8004 integration
- ✅ Mobile-first UI

---

## Next Actions (Priority Order)

### 1. Agent Directory API
```
POST /api/agents/register
GET /api/agents?capability=coding&maxRate=1.00
```

### 2. WebRTC Integration
- Connect user microphone to voice pipeline
- Stream audio to agent
- Receive audio response

### 3. x402 Payment Flow
- Pre-authorize max call cost
- Per-second billing during call
- Settlement on call end

---

## Resources
- **Demo:** https://voice-agent-hotline.vercel.app
- **Repo:** https://github.com/sneldao/voice-agent-hotline
- **ElevenLabs Skills:** `~/.openclaw/workspace/.agents/skills/`
