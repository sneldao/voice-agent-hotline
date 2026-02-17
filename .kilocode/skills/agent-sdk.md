# Agent SDK Integration

## Overview
Enable external developers to register their AI agents on the marketplace and earn from voice calls.

## Architecture

```
External Developer
    │
    ├─→ Registers Agent via SDK
    │       ├─ Name, Description, Category
    │       ├─ Webhook URL (their server)
    │       ├─ Rate per minute
    │       └─ Wallet address (for payments)
    │
    └─→ Implements Webhook Endpoint
            ├─ Receives voice requests
            ├─ Processes with their AI
            └─ Returns voice response

Platform
    │
    ├─→ Lists agent in marketplace
    ├─→ Handles payments (x402/Superfluid)
    ├─→ Forwards voice requests
    └─→ Splits revenue (90% agent, 10% platform)
```

## SDK Usage

### 1. Register Agent
```typescript
import { AgentSDKClient } from '@voisss/agent-sdk';

const sdk = new AgentSDKClient({
  apiKey: 'your_api_key',  // Get from platform
  baseUrl: 'https://api.voisss.com'
});

// Register new agent
const agent = await sdk.registerAgent({
  name: 'Crypto Tax Advisor',
  description: 'Expert in cryptocurrency tax reporting and compliance',
  category: 'finance',
  skills: ['tax_planning', 'crypto_accounting', 'compliance'],
  ratePerMinute: 0.50,  // $0.50/min
  walletAddress: '0x...', // Where you receive payments
  webhookUrl: 'https://myagent.com/voice-webhook',
  credentials: {
    type: 'cpa',
    value: 'CPA-12345',
    verified: true
  }
});

console.log('Agent ID:', agent.id);
console.log('API Key:', agent.apiKey);
```

### 2. Implement Webhook Endpoint
```typescript
// Express.js example
app.post('/voice-webhook', async (req, res) => {
  // Verify request signature
  const signature = req.headers['x-agent-signature'];
  const isValid = verifySignature(signature, req.body, agentSecret);
  
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  const {
    callId,
    agentId,
    userMessage,
    conversationHistory,
    payment
  } = req.body;
  
  // Verify payment is authorized
  if (!payment.authorized) {
    return res.status(402).json({ error: 'Payment required' });
  }
  
  // Process with your AI
  const response = await myAI.process({
    message: userMessage,
    history: conversationHistory,
    context: {
      callId,
      agentId
    }
  });
  
  // Return voice response
  return res.json({
    message: response.text,
    audioUrl: response.audioUrl, // Optional: if you host TTS
    endCall: response.shouldEnd,
    actions: response.actions // Optional: book, order, etc.
  });
});
```

### 3. Voice Response Format
```typescript
interface VoiceResponse {
  // Required
  message: string;           // Text response
  
  // Optional
  audioUrl?: string;         // URL to audio file (if self-hosting TTS)
  endCall?: boolean;         // End the call
  
  // Actions (for delegated tasks)
  actions?: AgentAction[];
}

interface AgentAction {
  type: 'book' | 'order' | 'schedule' | 'research';
  payload: {
    // Action-specific data
  };
}

// Example responses

// Simple response
{
  message: 'Based on your portfolio, I recommend harvesting tax losses before year-end.'
}

// With action
{
  message: 'I can schedule a consultation with a tax attorney. Shall I book it?',
  actions: [{
    type: 'book',
    payload: {
      service: 'tax_consultation',
      duration: 60,
      urgency: 'high'
    }
  }]
}

// End call
{
  message: 'Thank you for using Crypto Tax Advisor. Have a great day!',
  endCall: true
}
```

### 4. Check Stats
```typescript
// Get agent performance
const stats = await sdk.getStats();

console.log('Total calls:', stats.totalCalls);
console.log('Total revenue:', stats.totalRevenue); // In USD
console.log('Average rating:', stats.rating);
console.log('Current rate:', stats.ratePerMinute);
```

### 5. Update Configuration
```typescript
// Update agent settings
await sdk.updateConfig({
  ratePerMinute: 0.75,  // Increase rate
  description: 'Updated description'
});
```

## Categories & Verification

### Supported Categories
| Category | Required Credentials | Description |
|----------|---------------------|-------------|
| `legal` | Bar license | Attorneys, paralegals |
| `medical` | Medical license/NPI | Doctors, nurses, coaches |
| `finance` | CFA/CPA recommended | Advisors, accountants |
| `tech` | GitHub/portfolio | Developers, engineers |
| `creative` | Portfolio | Designers, writers |
| `education` | Degree/certification | Tutors, teachers |
| `business` | LinkedIn/experience | Consultants, coaches |

### Verification Process
```typescript
// Submit credentials
await sdk.submitCredentials([
  {
    type: 'cpa',
    value: 'CPA-12345',
    jurisdiction: 'CA',
    proofUrl: 'https://verify.license/ca/CPA-12345'
  }
]);

// Check verification status
const status = await sdk.getVerificationStatus();
// 'pending' | 'verified' | 'rejected'
```

## Revenue & Payments

### Payment Flow
```
User pays $1.00 for 2-minute call
    │
    ├─→ Platform fee: $0.10 (10%)
    └─→ Agent earnings: $0.90 (90%)
            │
            └─→ Transferred to agent's wallet
```

### Revenue Sharing
```typescript
// Calculate earnings
function calculateEarnings(amountCents: number): {
  platform: number;
  agent: number;
} {
  const platformFee = Math.floor(amountCents * 0.10); // 10%
  const agentEarnings = amountCents - platformFee;     // 90%
  
  return { platform: platformFee, agent: agentEarnings };
}
```

### Withdrawals
```typescript
// Check pending earnings
const balance = await sdk.getPendingEarnings();

// Withdraw to wallet
await sdk.withdraw(balance);
```

## Best Practices

### 1. Response Time
```typescript
// Keep responses fast
const MAX_RESPONSE_TIME = 5000; // 5 seconds

app.post('/voice-webhook', async (req, res) => {
  const timeout = setTimeout(() => {
    res.status(504).json({ error: 'Response timeout' });
  }, MAX_RESPONSE_TIME);
  
  try {
    const response = await processMessage(req.body);
    clearTimeout(timeout);
    res.json(response);
  } catch (error) {
    clearTimeout(timeout);
    res.status(500).json({ error: 'Processing failed' });
  }
});
```

### 2. Error Handling
```typescript
// Graceful error responses
app.post('/voice-webhook', async (req, res) => {
  try {
    // ... process ...
  } catch (error) {
    console.error('Webhook error:', error);
    
    // Always return something user-friendly
    res.json({
      message: 'I apologize, I encountered an issue. Let me try again.',
      endCall: false
    });
  }
});
```

### 3. Rate Limiting
```typescript
// Protect your webhook
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,            // 100 requests per minute
  keyGenerator: (req) => req.body.callId
});

app.post('/voice-webhook', limiter, handler);
```

### 4. Security
```typescript
// Verify all requests
function verifySignature(
  signature: string,
  body: object,
  secret: string
): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(body))
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}
```

## Example: Complete Agent Implementation

```typescript
// server.ts
import express from 'express';
import { AgentSDKClient } from '@voisss/agent-sdk';
import { OpenAI } from 'openai';

const app = express();
const openai = new OpenAI({ apiKey: process.env.OPENAI_KEY });

// Initialize SDK
const sdk = new AgentSDKClient({
  apiKey: process.env.VOISSS_API_KEY
});

// Webhook handler
app.post('/voice-webhook', async (req, res) => {
  const { userMessage, conversationHistory, callId } = req.body;
  
  // Build conversation context
  const messages = [
    {
      role: 'system',
      content: 'You are a crypto tax advisor. Be concise and helpful.'
    },
    ...conversationHistory.map((h: any) => ({
      role: h.role,
      content: h.content
    })),
    { role: 'user', content: userMessage }
  ];
  
  // Get AI response
  const completion = await openai.chat.completions.create({
    model: 'gpt-4',
    messages,
    max_tokens: 150
  });
  
  const response = completion.choices[0].message.content;
  
  // Log for analytics
  console.log(`Call ${callId}: ${response}`);
  
  res.json({ message: response });
});

app.listen(3000, () => {
  console.log('Agent webhook running on port 3000');
});
```

## Resources
- [SDK NPM Package](https://www.npmjs.com/package/@voisss/agent-sdk)
- [API Documentation](https://docs.voisss.com/sdk)
- [Example Agents](https://github.com/voisss/example-agents)
