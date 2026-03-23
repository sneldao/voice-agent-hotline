# Hackathon Submission (Celo Hackathon V2)

## Quick Submit (Tweet Template)

```
🤖 Built an AI Voice Agent Hotline for @Celo #BuildAgentsForTheRealWorld!

✅ Real-time voice calls with AI agents
✅ Celo-native settlement with stablecoins
✅ Optional payment rails via x402 / WDK plumbing
✅ ERC-8004 agent registry & delegation
✅ Agent Skills framework + SDK for builders

🔗 Karma: [YOUR_KARMA_LINK]
🔖 agentscan agentId: [YOUR_AGENT_ID]
🧾 Self verification: [SELF_LINK_OR_SCREENSHOT_NOTE]
🌐 Live Demo: https://voisss-agent-hotline.vercel.app

Tagging @Celo @CeloDevs @CeloPublicGoods
```

## Submission Details

**Project:** Voice Agent Hotline  
**Tagline:** Talk to verified AI agents on Celo. Pay as you go.  
**Demo:** https://voisss-agent-hotline.vercel.app  
**Repo:** https://github.com/sneldao/voice-agent-hotline  
**Track Targets:** Best Agent on Celo, Best Agent Infra on Celo, 8004scan (if eligible)  

### Positioning

Celo is the core platform for this project: marketplace discovery, stablecoin settlement, and ERC-8004 identity/reputation all live in the Celo story. Tether WDK and x402 are integrated as optional payment plumbing so users and agents can choose the payment UX that best fits the session without changing the project’s Celo-first architecture.

### Required Links (V2)

- **Karma project:** [YOUR_KARMA_LINK]
- **Submission form:** https://app.karmahq.xyz/celo/programs/1059/apply
- **Tweet:** [YOUR_TWEET_LINK]
- **agentscan agentId:** [YOUR_AGENT_ID]
- **Self verification:** [SELF_LINK] or include screenshot note if unsupported in your country
- Optional: **Molthunt** registration link

### Key Features

- 🎙️ Real-time voice calls (WebRTC + ElevenLabs)
- 💰 Celo-native stablecoin settlement for paid calls
- 🧰 Optional x402 / WDK payment plumbing for broader wallet and payment UX
- 🔐 ERC-4337 smart contract wallets + session keys
- 🤖 Agent Skills framework + SDK for external developers
- ⭐ Reputation + delegation via ERC-8004

### Agent IDs (for submission)

```
agent_2101khgsy8aqfxv8yr3r9548bqrx  (Solana Sage)
agent_0201khgsya1dfcgv6p5ch10995b9  (Code Reviewer)
agent_6701khgsyb70fdebb2ce36dfjs2m  (Tournament Master)
agent_2101khgsyd02fnvshvr7rzb50qj6  (General Helper)
```

### V2 Timeline (GMT)

- Kick-off: March 2, 5 PM GMT  
- Submissions close: March 22, 9 AM GMT  
- Winners announced: March 24, 3 PM GMT  

### Checklist

- [x] Code complete
- [x] Live demo deployed
- [x] Build passing
- [x] GitHub repository
- [ ] Register on Karma
- [ ] Verify agent with Self (or screenshot if unsupported)
- [ ] Register agent on agentscan
- [ ] Optional: Register on Molthunt
- [ ] Tweet submission (with required tags + links)
- [ ] Submit on Karma form

## Notes on Frameworks

OpenClaw is recommended but **not required**. This project uses an OpenClaw‑style intent architecture; see `/lib/intent-architecture.ts` and `/app/api/intents/route.ts`.

## Full Documentation

See [project docs](../README.md) for architecture, deployment, and API details.
