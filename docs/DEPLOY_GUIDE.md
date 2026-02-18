# Voice Agent Marketplace - Deployment Guide

## 🎯 What's Been Built

A complete Voice Agent Marketplace powered by:
- **ElevenLabs Conversational AI** - Natural voice conversations with tool capabilities
- **Composio** - Tool execution framework (GitHub, Solana, Web Search)
- **Celo x402 + Superfluid** - Crypto micropayments per minute
- **Upstash Redis** - Agent and call data storage

## 🤖 Pre-Built Agents

### 1. Solana Sage 🪙 ($0.10/min)
- **Agent ID**: `agent_2101khgsy8aqfxv8yr3r9548bqrx`
- **Voice**: Roger (laid-back, conversational)
- **Tools**: Solana balance, NFT lookup, token prices
- **Use Case**: Blockchain queries and crypto tracking

### 2. Code Reviewer 💻 ($0.15/min)
- **Agent ID**: `agent_0201khgsya1dfcgv6p5ch10995b9`
- **Voice**: Sarah (confident, professional)
- **Tools**: GitHub repos, file reading, code search, issues
- **Use Case**: Code reviews and GitHub operations

### 3. Tournament Master 🎮 ($0.08/min)
- **Agent ID**: `agent_6701khgsyb70fdebb2ce36dfjs2m`
- **Voice**: Charlie (energetic, Australian)
- **Tools**: Web search, Wikipedia
- **Use Case**: Gaming stats and tournament info

### 4. General Helper 🤖 ($0.05/min)
- **Agent ID**: `agent_2101khgsyd02fnvshvr7rzb50qj6`
- **Voice**: River (neutral, informative)
- **Tools**: Web search, scraping, Wikipedia, time, calculations, weather
- **Use Case**: General queries and research

## 📁 New/Updated Files

### Created:
1. `lib/db-seed.ts` - Agent seeding utilities
2. `app/api/agents/seed/route.ts` - Seed endpoint
3. `DEPLOYMENT.md` - This guide

### Previously Created (Phase 1):
4. `lib/elevenlabs.ts` - Enhanced with Conversational AI SDK
5. `lib/composio.ts` - Tool execution service
6. `app/api/webhooks/elevenlabs/route.ts` - Tool callback handler
7. `.env.local.example` - Updated environment variables

## 🔑 Required Environment Variables

Create `.env.local` with:

```bash
# ElevenLabs
ELEVENLABS_API_KEY=sk_your_elevenlabs_key
ELEVENLABS_CONVERSATIONAL_ENABLED=true

# Composio
COMPOSIO_API_KEY=your_composio_key

# Web Tools
FIRECRAWL_API_KEY=your_firecrawl_key
TAVILY_API_KEY=your_tavily_key

# Webhook URL (for tool callbacks)
NEXT_PUBLIC_WEBHOOK_URL=https://your-domain.vercel.app

# Existing vars (Upstash, Celo, etc.) - keep as is
```

## 🚀 Deployment Steps

### Step 1: Environment Setup
```bash
# Copy environment template
cp .env.local.example .env.local

# Add your API keys
nano .env.local
```

### Step 2: Install Dependencies
```bash
npm install
# or
pnpm install
```

### Step 3: Seed Database
```bash
# Start dev server
npm run dev

# Seed agents (in another terminal or browser)
curl -X POST http://localhost:3000/api/agents/seed
```

Expected response:
```json
{
  "success": true,
  "message": "Agents seeded successfully"
}
```

### Step 4: Verify Agents
```bash
curl http://localhost:3000/api/agents
```

Should return all 4 agents with their ElevenLabs agent IDs.

### Step 5: Deploy to Vercel
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Add environment variables in Vercel dashboard
vercel env add ELEVENLABS_API_KEY
vercel env add COMPOSIO_API_KEY
# ... add all other env vars

# Redeploy with env vars
vercel --prod
```

## 🧪 Testing

### Test 1: Verify Agents Endpoint
```bash
curl https://your-domain.vercel.app/api/agents
```

### Test 2: Start Conversation (via your frontend)
1. Visit your deployed marketplace
2. Select an agent (e.g., "General Helper")
3. Click "Start Call"
4. Speak to test voice interaction

### Test 3: Webhook Integration
The webhook at `/api/webhooks/elevenlabs` will receive tool execution requests from ElevenLabs and forward them to Composio.

Monitor in Vercel logs:
```bash
vercel logs --follow
```

### Test 4: Tool Execution
Try these prompts with agents:

**Solana Sage**: "Check the balance of wallet ABC123"
**Code Reviewer**: "Show me the README from facebook/react"
**Tournament Master**: "Find recent Dota 2 tournament results"
**General Helper**: "What's the weather in San Francisco?"

## 🔧 Architecture Flow

```
User speaks → ElevenLabs Conversational AI
    ↓
Agent decides: Need tool?
    ↓ (yes)
Webhook: /api/webhooks/elevenlabs
    ↓
lib/composio.ts: executeTool()
    ↓
Composio executes tool (GitHub, Solana, Web Search)
    ↓
Result → ElevenLabs → Agent speaks response
```

## 📊 Monitoring

### Check Agent Usage
```bash
curl https://your-domain.vercel.app/api/analytics
```

### Check Active Calls
```bash
curl https://your-domain.vercel.app/api/calls
```

### View Ratings
```bash
curl https://your-domain.vercel.app/api/agents/:agentId/ratings
```

## 🐛 Troubleshooting

### Issue: Agents not showing up
```bash
# Re-seed database
curl -X POST https://your-domain.vercel.app/api/agents/seed
```

### Issue: Tools not executing
1. Check Composio API key is valid
2. Verify webhook URL in .env matches deployed URL
3. Check Vercel logs for webhook errors

### Issue: Voice quality issues
- Ensure using `eleven_flash_v2_5` model (already configured)
- Check ElevenLabs quota/limits
- Test voice quality in ElevenLabs dashboard first

### Issue: Payment flow not working
- Verify Celo/Superfluid setup (existing code)
- Check x402 contract addresses
- Monitor payment events in Celo explorer

## 📝 Next Steps

### Phase 4 Enhancements (Optional):
1. **Add more agents** - Create specialized agents for your use cases
2. **Custom tools** - Add domain-specific tools via Composio
3. **Advanced payment flows** - Subscription models, bundles
4. **Analytics dashboard** - Real-time call metrics
5. **Agent training** - Fine-tune with conversation data

## 🎉 You're Ready!

The marketplace is now fully functional with:
✅ 4 pre-built conversational agents
✅ ElevenLabs integration with tool support
✅ Composio tool execution
✅ Payment infrastructure (Celo)
✅ Database seeding
✅ Webhook handling

**Test it live and let me know what breaks!** 🚀
