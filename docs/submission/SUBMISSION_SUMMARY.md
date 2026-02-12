# voice-agent-hotline - Celo Hackathon Submission Summary

## Project Overview

**Name:** Voice Agent Hotline  
**Tagline:** Talk to verified AI agents. Pay per second. Built for Celo AI Partner Hackathon.  
**Demo:** https://voice-agent-hotline.vercel.app  
**Repository:** https://github.com/sneldao/voice-agent-hotline

## Hackathon Details

- **Deadline:** February 15, 2026
- **Platform:** Celo AI Partner Catalyst Hackathon
- **Prize Track:** AI Agents with Real-World Utility

## Project Stats

- **Completion:** 95%
- **Build Size:** 10.1 kB (home), 39.9 kB (demo)
- **Tech Stack:** Next.js 14, Tailwind CSS, ElevenLabs, x402, Superfluid, ERC-8004

## Core Features

### 🎙️ Voice
- Real AI voice via ElevenLabs
- WebRTC peer connections
- Call recording and playback

### 💰 Payments
- **x402 Direct:** Pay per call segment
- **Superfluid Streaming:** Pay per second
- Celo + Base blockchain support

### 🤖 Agent Skills
- **Book:** Appointments, reservations
- **Order:** Purchases, services
- **Schedule:** Events, reminders
- **Research:** Information gathering

### ⭐ Trust
- ERC-8004 agent registry
- Reputation system
- Verified identities

## Demo Agents (4)

1. 👩‍🏫 Maria Garcia - Spanish Teacher ($0.01/min)
2. 👨‍💻 Alex Chen - Coding Mentor ($0.03/min)
3. 👨‍🍳 Chef Mario - Italian Cuisine (available)
4. [More agents on demo]

## Architecture

```
User (Mobile/Web)
    │
    ├─► WebRTC Voice Call
    │
    ├─► x402 Payment (Celo/Base)
    │   │
    │   ├─ Direct Payment
    │   └─ Superfluid Streaming
    │
    └─► ERC-8004 Delegation
        │
        ├─ Book appointments
        ├─ Place orders
        ├─ Schedule events
        └─ Research tasks
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14 + Tailwind CSS |
| Voice | ElevenLabs TTS + WebRTC |
| Payments | x402 + Superfluid (Celo, Base) |
| Identity | ERC-8004 |
| Database | Upstash Redis |

## Submission Checklist

- [x] Complete codebase
- [x] Live demo deployed
- [x] Build verified (no errors)
- [x] GitHub repository created
- [ ] Submit to Celo hackathon platform
- [ ] (Optional) Demo video

## Demo Mode

Set `NEXT_PUBLIC_DEMO_MODE=true` to test without real wallet.

## Contact

- GitHub: https://github.com/sneldao/voice-agent-hotline
- Demo: https://voice-agent-hotline.vercel.app
- Celo Notion: https://celoplatform.notion.site/Build-Agents-for-the-Real-World-Celo-Hackathon

---

**Submitted:** [DATE]  
**Project ID:** [TO BE ASSIGNED BY CELO]
