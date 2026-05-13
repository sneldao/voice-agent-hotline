# ElevenHacks Submission Guide

## Challenge Requirements Checklist

- [x] **Built with Cursor** — Entire project developed in Cursor with AI assistance
- [x] **Uses ElevenLabs** — Deep integration with Conversational AI (STT + TTS + WebRTC)
- [x] **Fully operable without a keyboard** — Voice-first UX, tap-to-call, no typing needed
- [x] **Live demo** — [voisss-agent-hotline.vercel.app](https://voisss-agent-hotline.vercel.app)
- [ ] **Viral-style demo video** — See script below
- [ ] **Social media posts** — See templates below

---

## What Makes VOISSS Stand Out

### For the "No Keyboard" Requirement
- The entire user journey (discover → call → interact → pay → rate) requires zero keyboard input
- Agents execute real actions mid-conversation (web search, booking, blockchain lookups)
- Not just a chatbot with TTS — it's a full marketplace with voice-driven tool execution
- The redesigned UI now feels like an AI phone-operator switchboard: tap a line, get patched through, keep talking

### For the "ElevenLabs Integration" Requirement
- Target architecture uses the official ElevenLabs `<elevenlabs-convai>` widget for reliable voice sessions
- Each agent has a unique ElevenLabs voice (6 different voices)
- Conversational AI handles both STT (input) and TTS (output)
- Webhook-based tool execution during live conversations
- Widget-controlled voice engine is the active refactor plan; current app still has temporary SDK plumbing while the custom UI is finalized
- Voice Router: one-tap mic connects to AI concierge instantly

### For the "Built with Cursor" Requirement
- All code written with Cursor AI assistance
- Complex integrations (ElevenLabs SDK, WebRTC, Celo blockchain) developed iteratively with Cursor
- Architecture designed through AI-assisted planning

---

## Demo Video Script (60 seconds, viral style)

Recommended visual angle: lean into the switchboard. Show the operator console, glowing line lamps, rotary-style call control, and patched-line active call view before explaining the backend.

### Option A: "The No-Keyboard Challenge"

```
[0-3s] HOOK
Text on screen: "I built an app I've never typed in."
You: holding phone, hands visible, never touching keyboard

[3-8s] PROBLEM
Quick cuts of: typing long ChatGPT prompts, copy-pasting, 
frustrated typing on phone keyboard
Text: "AI shouldn't need a keyboard."

[8-15s] OPEN THE APP
Show VOISSS marketplace on phone
Tap an agent (Dr. Maya or Web Researcher)
Text: "One tap. Then just talk."

[15-35s] THE CONVERSATION (main demo)
Live voice conversation with the agent:
- You: "Hey, can you look up the latest research on intermittent fasting?"
- Agent: *searches the web in real-time*
- Agent: "I found several recent studies. The most cited one from 2024 shows..."
Show the transcript appearing in real-time
Show the "Streaming Live" payment badge

[35-45s] WOW MOMENT
- You: "Can you also check if there are any good fasting apps?"
- Agent: *searches again, reads results*
- Show the cost ticker going up in real-time ($0.0012... $0.0015...)

[45-55s] WRAP UP
Tap end call
Show the call summary: duration, cost, transcript
Tap 5 stars to rate
Text: "Full conversation. Zero typing."

[55-60s] CTA
Text: "VOISSS — Talk to AI agents. No keyboard required."
Show: @cursor_ai @elevenlabsio #ElevenHacks
Link: voisss-agent-hotline.vercel.app
```

### Option B: "Hands Busy" Scenario

```
[0-5s] HOOK
You're cooking (hands covered in dough/sauce)
Phone rings notification: "Need to research something?"
You: "I can't type right now..."

[5-10s] SOLUTION
Tap VOISSS with elbow/knuckle
Tap Web Researcher agent

[10-40s] CONVERSATION
Full voice interaction while cooking:
- Research a recipe modification
- Agent searches the web, reads results
- You ask follow-up questions
- All hands-free

[40-55s] RESULT
Show transcript of the full conversation
Show it cost $0.02 for 3 minutes of research
"Better than typing with flour hands"

[55-60s] CTA
"VOISSS. AI you can talk to."
@cursor_ai @elevenlabsio #ElevenHacks
```

---

## Social Media Templates

### X (Twitter)

```
🎙️ Built an app you never have to type in.

VOISSS is a voice-first AI agent marketplace:
→ Tap an agent
→ Talk naturally  
→ They search the web, book things, research — all by voice
→ Pay per second with crypto

Built with @cursor_ai + @elevenlabsio Conversational AI

No keyboard. No prompts. Just talk.

🔗 voisss-agent-hotline.vercel.app

#ElevenHacks
```

### LinkedIn

```
What if AI didn't need a keyboard?

I built VOISSS — a marketplace where you call AI agents like you'd call a friend. Each agent is a specialist (doctor, researcher, coder, travel planner) powered by ElevenLabs' voice AI.

The entire experience is hands-free:
• One tap to start a call
• Speak naturally — the agent understands and responds in real-time
• Agents can search the web, look up data, and take actions mid-conversation
• Pay per second with stablecoins

Built entirely in Cursor with ElevenLabs Conversational AI handling the voice layer (WebRTC, speech-to-text, text-to-speech).

Perfect for when your hands are busy — cooking, driving, walking — or for accessibility.

Try it: voisss-agent-hotline.vercel.app

Built with @Cursor and @ElevenLabs for #ElevenHacks

#AI #VoiceAI #HandsFree #ElevenLabs #Cursor
```

### Instagram / TikTok Caption

```
Built an app I've never typed in 🎙️

AI agents you can CALL — like a phone call but with AI experts.

No keyboard. No prompts. Just talk.

@cursor_ai @elevenlabsio #ElevenHacks #AI #VoiceAI #HandsFree #NoKeyboard
```

---

## Scoring Strategy

| Category | Points | Strategy |
|----------|--------|----------|
| Social posts | +50 per platform | Post on X, LinkedIn, Instagram, TikTok (= 200 pts) |
| Placement | Up to +400 | Strong demo video + unique concept (marketplace, not just chatbot) |
| Most Viral | +200 | Hook-first video, relatable scenario (cooking/driving) |
| Most Popular | +200 | Community engagement, share in relevant communities |

### Maximize Points
1. Post on ALL 4 platforms (X, LinkedIn, Instagram, TikTok) = 200 pts minimum
2. Make the video genuinely entertaining/useful (viral potential)
3. Share in communities: r/artificial, Hacker News, Product Hunt, Discord servers
4. Engage with other submissions (community voting)

---

## Video Recording Tips

1. **Screen record on phone** — VOISSS is mobile-first, looks best on phone
2. **Use a quiet room** — The voice conversation needs to be audible
3. **Show the real app** — Don't fake it, use the live demo
4. **Keep it under 60s** — Viral content is short
5. **Add captions** — Many people watch without sound (ironic for a voice app, but true)
6. **Show the "wow" moment** — Agent searching the web mid-conversation is the hook
7. **End with the link** — Make it easy for viewers to try it

---

## Submission Checklist

- [ ] Demo video recorded (60s, viral style)
- [ ] Video uploaded to all platforms (X, LinkedIn, Instagram, TikTok)
- [ ] All posts tag @cursor_ai and @elevenlabsio
- [ ] All posts use #ElevenHacks
- [ ] README updated (done ✅)
- [ ] Live demo working at voisss-agent-hotline.vercel.app
- [ ] Submit via the hackathon platform before deadline

---

## Key Differentiators vs Other Submissions

Most submissions will likely be:
- Simple voice chatbots (one agent, one conversation)
- Voice-to-text note apps
- Voice-controlled to-do lists

VOISSS is different because:
1. **Marketplace** — Multiple specialized agents, not just one
2. **Tool execution** — Agents DO things (search, book, research) during the call
3. **Real payments** — On-chain settlement per second
4. **Platform** — Developers can list their own agents
5. **Production-ready** — Deployed, working, with real users

This positions it as a "what voice AI could become" rather than a toy demo.
