# WebRTC Voice Integration

## Overview
Real-time voice communication with AI agents using WebRTC for sub-500ms latency.

## Architecture

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│    User     │ ←WebRTC→│   Cloud     │ ←Data→  │  ElevenLabs │
│   Browser   │         │   Agent     │ Channel │     AI      │
└─────────────┘         └─────────────┘         └─────────────┘
       │
       ├─ Local audio stream (microphone)
       ├─ Remote audio stream (agent voice)
       └─ Data channel (transcripts, interrupts)
```

## WebRTC Implementation

### 1. Connection Setup
```typescript
class WebRTCVoiceService {
  private pc: RTCPeerConnection;
  private dataChannel: RTCDataChannel;
  
  async startCall(agentId: string): Promise<CallSession> {
    // Create peer connection
    this.pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ],
      iceCandidatePoolSize: 10
    });
    
    // Get user media
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 48000
      }
    });
    
    // Add tracks
    stream.getTracks().forEach(track => {
      this.pc.addTrack(track, stream);
    });
    
    // Create data channel for control
    this.dataChannel = this.pc.createDataChannel('voice', {
      ordered: true
    });
    
    // Handle messages
    this.dataChannel.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleDataChannelMessage(message);
    };
    
    // Create offer
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    
    // Send to signaling server
    const answer = await this.signalToServer({
      type: 'offer',
      agentId,
      sdp: offer.sdp
    });
    
    await this.pc.setRemoteDescription(answer);
    
    return {
      id: generateCallId(),
      agentId,
      localStream: stream,
      startTime: Date.now()
    };
  }
}
```

### 2. Data Channel Protocol
```typescript
interface VoiceMessage {
  type: 'transcript' | 'response' | 'interrupt' | 'end';
  text?: string;
  isFinal?: boolean;
  timestamp: number;
  speaker: 'user' | 'agent';
}

// Send transcript
function sendTranscript(text: string, isFinal: boolean) {
  dataChannel.send(JSON.stringify({
    type: 'transcript',
    text,
    isFinal,
    timestamp: Date.now(),
    speaker: 'user'
  }));
}

// Interrupt agent
function interruptAgent() {
  dataChannel.send(JSON.stringify({
    type: 'interrupt',
    timestamp: Date.now(),
    speaker: 'user'
  }));
}

// End call
function endCall() {
  dataChannel.send(JSON.stringify({
    type: 'end',
    timestamp: Date.now(),
    speaker: 'user'
  }));
}
```

### 3. ElevenLabs Integration
```typescript
interface ElevenLabsConfig {
  agentId: string;
  voiceId: string;
  model: 'eleven_flash_v2_5';
  language: 'en';
}

async function createElevenLabsAgent(config: ElevenLabsConfig) {
  const response = await fetch('https://api.elevenlabs.io/v1/convai/agents', {
    method: 'POST',
    headers: {
      'xi-api-key': process.env.ELEVENLABS_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: config.agentId,
      conversation_config: {
        agent: {
          prompt: getAgentPrompt(config.agentId),
          first_message: getAgentGreeting(config.agentId)
        },
        asr: {
          quality: 'high',
          provider: 'elevenlabs',
          user_input_audio_format: 'pcm_16000'
        },
        turn: {
          turn_timeout: 7,
          mode: 'turn'
        },
        tts: {
          model_id: config.model,
          voice_id: config.voiceId,
          agent_output_audio_format: 'pcm_16000'
        }
      },
      platform_settings: {
        auth: {
          enable_auth: false
        }
      }
    })
  });
  
  return response.json();
}
```

## Metrics & Monitoring

### Latency Tracking
```typescript
interface CallMetrics {
  latency: number;        // RTT in ms
  packetLoss: number;     // Percentage
  jitter: number;        // Variation in ms
  audioLevel: number;    // 0-1
  bytesReceived: number;
  bytesSent: number;
}

async function collectMetrics(pc: RTCPeerConnection): Promise<CallMetrics> {
  const stats = await pc.getStats();
  
  let latency = 0;
  let packetLoss = 0;
  let jitter = 0;
  
  stats.forEach(report => {
    if (report.type === 'candidate-pair' && report.state === 'succeeded') {
      latency = report.currentRoundTripTime * 1000;
    }
    if (report.type === 'inbound-rtp') {
      packetLoss = (report.packetsLost / report.packetsReceived) * 100;
      jitter = report.jitter;
    }
  });
  
  return { latency, packetLoss, jitter, ... };
}
```

### Quality Indicators
```typescript
function getQualityRating(metrics: CallMetrics): 'excellent' | 'good' | 'fair' | 'poor' {
  if (metrics.latency < 150 && metrics.packetLoss < 1) {
    return 'excellent';
  }
  if (metrics.latency < 300 && metrics.packetLoss < 3) {
    return 'good';
  }
  if (metrics.latency < 500 && metrics.packetLoss < 5) {
    return 'fair';
  }
  return 'poor';
}
```

## Error Handling

### Connection Recovery
```typescript
pc.onconnectionstatechange = () => {
  switch (pc.connectionState) {
    case 'disconnected':
      // Try to reconnect
      setTimeout(() => attemptReconnection(callId), 2000);
      break;
      
    case 'failed':
      // End call gracefully
      endCall(callId, { reason: 'connection_failed' });
      break;
  }
};

async function attemptReconnection(callId: string) {
  try {
    // Create new offer with ice restart
    const offer = await pc.createOffer({ iceRestart: true });
    await pc.setLocalDescription(offer);
    
    // Get new answer from server
    const answer = await signalReconnection(callId, offer);
    await pc.setRemoteDescription(answer);
  } catch (error) {
    endCall(callId, { reason: 'reconnection_failed' });
  }
}
```

## Best Practices

### 1. Audio Quality
```typescript
const audioConstraints = {
  echoCancellation: true,      // Prevent feedback
  noiseSuppression: true,      // Reduce background noise
  autoGainControl: true,       // Normalize volume
  sampleRate: 48000,           // High quality
  channelCount: 1              // Mono for voice
};
```

### 2. Bandwidth Adaptation
```typescript
// Monitor bandwidth and adjust quality
const sender = pc.getSenders().find(s => 
  s.track?.kind === 'audio'
);

const params = sender.getParameters();
params.encodings[0].maxBitrate = 64000; // 64 kbps for voice
await sender.setParameters(params);
```

### 3. Security
```typescript
// Use DTLS for encryption
const pc = new RTCPeerConnection({
  iceServers: [...],
  dtlsTransportPolicy: 'all'  // Enforce DTLS
});

// Validate agent identity
const agentCertificate = await pc.getRemoteCertificates();
// Verify certificate matches expected agent
```

## Testing

### Local Testing
```bash
# Use WebRTC internals
chrome://webrtc-internals

# Check ICE candidates
# Verify data channel messages
# Monitor audio levels
```

### Load Testing
```typescript
// Simulate multiple concurrent calls
async function loadTest(numCalls: number) {
  const calls = [];
  
  for (let i = 0; i < numCalls; i++) {
    calls.push(startCall(`agent_${i}`));
  }
  
  const results = await Promise.allSettled(calls);
  
  const success = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;
  
  console.log(`Success: ${success}, Failed: ${failed}`);
}
```

## Resources
- [WebRTC MDN Docs](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
- [ElevenLabs Conversational AI](https://elevenlabs.io/docs/conversational-ai)
- [WebRTC Stats](https://www.w3.org/TR/webrtc-stats/)
