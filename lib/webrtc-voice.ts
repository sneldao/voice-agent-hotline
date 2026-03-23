// ============================================
// WebRTC Real-Time Voice Service
// ============================================
// Production-grade WebRTC implementation for
// low-latency voice calls with AI agents

import { EventEmitter } from 'events';

// ============================================
// Types
// ============================================
export interface CallSession {
  id: string;
  agentId: string;
  userId: string;
  peerConnection: RTCPeerConnection;
  localStream: MediaStream;
  remoteStream: MediaStream | null;
  dataChannel: RTCDataChannel | null;
  state: 'connecting' | 'connected' | 'disconnected' | 'failed';
  startTime: number;
  endTime?: number;
  metrics: CallMetrics;
}

export interface CallMetrics {
  latency: number;           // Round-trip time in ms
  packetLoss: number;        // Percentage
  jitter: number;           // Variation in packet arrival
  audioLevel: number;       // 0-1
  bytesReceived: number;
  bytesSent: number;
}

export interface VoiceConfig {
  iceServers: RTCIceServer[];
  codec?: 'opus' | 'pcmu' | 'pcma';
  bitrate?: number;         // kbps
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
}

export interface TranscriptMessage {
  type: 'transcript' | 'response' | 'interrupt' | 'end';
  text: string;
  isFinal: boolean;
  timestamp: number;
  speaker: 'user' | 'agent';
}

// ============================================
// Default Configuration
// ============================================
const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

const DEFAULT_CONFIG: VoiceConfig = {
  iceServers: DEFAULT_ICE_SERVERS,
  codec: 'opus',
  bitrate: 128,
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};

// ============================================
// WebRTC Voice Service
// ============================================
export class WebRTCVoiceService extends EventEmitter {
  private sessions: Map<string, CallSession> = new Map();
  private config: VoiceConfig;
  private audioContext: AudioContext | null = null;

  constructor(config: Partial<VoiceConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize audio context (must be called after user interaction)
   */
  async initializeAudio(): Promise<void> {
    if (typeof window === 'undefined') return;

    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  /**
   * Start a new voice call
   */
  async startCall(
    callId: string,
    agentId: string,
    userId: string,
    signalEndpoint: string
  ): Promise<CallSession> {
    await this.initializeAudio();

    // Get user media (microphone)
    const localStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: this.config.echoCancellation,
        noiseSuppression: this.config.noiseSuppression,
        autoGainControl: this.config.autoGainControl,
        sampleRate: 48000,
        channelCount: 1,
      },
      video: false,
    });

    // Create peer connection
    const peerConnection = new RTCPeerConnection({
      iceServers: this.config.iceServers,
      iceCandidatePoolSize: 10,
    });

    // Add local stream tracks
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });

    // Create data channel for signaling/transcripts
    const dataChannel = peerConnection.createDataChannel('voice', {
      ordered: true,
    });

    this.setupDataChannel(dataChannel, callId);

    // Create session
    const session: CallSession = {
      id: callId,
      agentId,
      userId,
      peerConnection,
      localStream,
      remoteStream: null,
      dataChannel,
      state: 'connecting',
      startTime: Date.now(),
      metrics: {
        latency: 0,
        packetLoss: 0,
        jitter: 0,
        audioLevel: 0,
        bytesReceived: 0,
        bytesSent: 0,
      },
    };

    this.sessions.set(callId, session);

    // Setup event handlers
    this.setupPeerConnection(session, signalEndpoint);

    // Create and send offer
    const offer = await peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: false,
    });

    await peerConnection.setLocalDescription(offer);

    // Send offer to signaling server
    await this.sendSignal(signalEndpoint, {
      type: 'offer',
      callId,
      agentId,
      sdp: offer.sdp,
    });

    this.emit('callStarted', { callId, agentId });

    return session;
  }

  /**
   * Setup peer connection event handlers
   */
  private setupPeerConnection(session: CallSession, signalEndpoint: string): void {
    const { peerConnection } = session;

    // ICE candidate handling
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal(signalEndpoint, {
          type: 'ice-candidate',
          callId: session.id,
          candidate: event.candidate,
        });
      }
    };

    // Connection state changes
    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection.connectionState;
      console.log(`[WebRTC] Connection state: ${state}`);

      if (state === 'connected') {
        session.state = 'connected';
        this.emit('connected', { callId: session.id });
        this.startMetricsCollection(session);
      } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
        session.state = state === 'disconnected' ? 'disconnected' : 'failed';
        this.emit('disconnected', { callId: session.id, state });
        this.stopMetricsCollection(session);
      }
    };

    // Remote stream received
    peerConnection.ontrack = (event) => {
      console.log('[WebRTC] Remote stream received');
      session.remoteStream = event.streams[0];
      this.emit('remoteStream', { callId: session.id, stream: event.streams[0] });
    };

    // Data channel from remote
    peerConnection.ondatachannel = (event) => {
      const channel = event.channel;
      this.setupDataChannel(channel, session.id);
    };
  }

  /**
   * Setup data channel for transcripts and control
   */
  private setupDataChannel(channel: RTCDataChannel, callId: string): void {
    channel.onopen = () => {
      console.log(`[WebRTC] Data channel open for ${callId}`);
    };

    channel.onmessage = (event) => {
      try {
        const message: TranscriptMessage = JSON.parse(event.data);
        this.emit('message', { callId, message });

        // Handle specific message types
        switch (message.type) {
          case 'transcript':
            this.emit('transcript', { callId, text: message.text, isFinal: message.isFinal });
            break;
          case 'response':
            this.emit('agentResponse', { callId, text: message.text });
            break;
          case 'interrupt':
            this.emit('interrupt', { callId });
            break;
          case 'end':
            this.emit('callEnded', { callId });
            break;
        }
      } catch (error) {
        console.error('[WebRTC] Error parsing data channel message:', error);
      }
    };

    channel.onerror = (error) => {
      console.error(`[WebRTC] Data channel error for ${callId}:`, error);
    };

    channel.onclose = () => {
      console.log(`[WebRTC] Data channel closed for ${callId}`);
    };
  }

  /**
   * Handle incoming signal (answer or ICE candidate)
   */
  async handleSignal(
    callId: string,
    signal: { type: 'answer' | 'ice-candidate'; sdp?: string; candidate?: RTCIceCandidateInit }
  ): Promise<void> {
    const session = this.sessions.get(callId);
    if (!session) {
      throw new Error(`Call ${callId} not found`);
    }

    const { peerConnection } = session;

    if (signal.type === 'answer' && signal.sdp) {
      await peerConnection.setRemoteDescription(new RTCSessionDescription({
        type: 'answer',
        sdp: signal.sdp,
      }));
    } else if (signal.type === 'ice-candidate' && signal.candidate) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(signal.candidate));
    }
  }

  /**
   * Send signal to server with retry logic
   * RELIABILITY: Exponential backoff with 3 retries
   */
  private async sendSignal(endpoint: string, data: any, retries = 3): Promise<void> {
    const maxRetries = retries;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });

        if (!res.ok) {
          throw new Error(`Signal failed: ${res.status}`);
        }

        return; // Success
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`[WebRTC] Signal error (attempt ${attempt}/${maxRetries}):`, lastError.message);

        if (attempt < maxRetries) {
          // Exponential backoff: 1s, 2s, 4s with jitter
          const delay = Math.min(1000 * Math.pow(2, attempt - 1) + Math.random() * 500, 5000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Signal failed after retries');
  }

  /**
   * Send transcript or control message
   */
  sendMessage(callId: string, message: Partial<TranscriptMessage>): void {
    const session = this.sessions.get(callId);
    if (!session?.dataChannel || session.dataChannel.readyState !== 'open') {
      return;
    }

    const fullMessage: TranscriptMessage = {
      type: message.type || 'transcript',
      text: message.text || '',
      isFinal: message.isFinal ?? true,
      timestamp: Date.now(),
      speaker: message.speaker || 'user',
    };

    session.dataChannel.send(JSON.stringify(fullMessage));
  }

  /**
   * Interrupt the agent (stop current speech)
   */
  interrupt(callId: string): void {
    this.sendMessage(callId, {
      type: 'interrupt',
      text: 'interrupt',
      isFinal: true,
      speaker: 'user',
    });

    this.emit('interruptSent', { callId });
  }

  /**
   * End a call
   */
  async endCall(callId: string): Promise<void> {
    const session = this.sessions.get(callId);
    if (!session) return;

    // Send end signal
    this.sendMessage(callId, {
      type: 'end',
      text: 'end',
      isFinal: true,
      speaker: 'user',
    });

    // Close data channel
    if (session.dataChannel) {
      session.dataChannel.close();
    }

    // Close peer connection
    session.peerConnection.close();

    // Stop all tracks
    session.localStream.getTracks().forEach(track => track.stop());
    session.remoteStream?.getTracks().forEach(track => track.stop());

    session.endTime = Date.now();
    session.state = 'disconnected';

    this.stopMetricsCollection(session);

    this.emit('callEnded', {
      callId,
      duration: session.endTime - session.startTime,
      metrics: session.metrics,
    });

    this.sessions.delete(callId);
  }

  /**
   * Get call session
   */
  getSession(callId: string): CallSession | undefined {
    return this.sessions.get(callId);
  }

  /**
   * Get all active calls
   */
  getActiveCalls(): CallSession[] {
    return Array.from(this.sessions.values()).filter(
      s => s.state === 'connecting' || s.state === 'connected'
    );
  }

  /**
   * Start collecting call metrics
   */
  private metricsIntervals: Map<string, NodeJS.Timeout> = new Map();

  private startMetricsCollection(session: CallSession): void {
    const interval = setInterval(async () => {
      try {
        const stats = await session.peerConnection.getStats();

        stats.forEach(report => {
          if (report.type === 'inbound-rtp' && report.kind === 'audio') {
            session.metrics.bytesReceived = report.bytesReceived || 0;
            session.metrics.packetLoss = report.packetsLost
              ? (report.packetsLost / (report.packetsReceived + report.packetsLost)) * 100
              : 0;
            session.metrics.jitter = report.jitter || 0;
          }

          if (report.type === 'outbound-rtp' && report.kind === 'audio') {
            session.metrics.bytesSent = report.bytesSent || 0;
          }

          if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            session.metrics.latency = report.currentRoundTripTime * 1000 || 0;
          }
        });

        this.emit('metrics', { callId: session.id, metrics: session.metrics });
      } catch (error) {
        console.error('[WebRTC] Metrics error:', error);
      }
    }, 1000);

    this.metricsIntervals.set(session.id, interval);
  }

  private stopMetricsCollection(session: CallSession): void {
    const interval = this.metricsIntervals.get(session.id);
    if (interval) {
      clearInterval(interval);
      this.metricsIntervals.delete(session.id);
    }
  }

  /**
   * Get audio level from local stream
   */
  getAudioLevel(callId: string): number {
    const session = this.sessions.get(callId);
    if (!session || !this.audioContext) return 0;

    // Create analyzer
    const source = this.audioContext.createMediaStreamSource(session.localStream);
    const analyzer = this.audioContext.createAnalyser();
    analyzer.fftSize = 256;
    source.connect(analyzer);

    const bufferLength = analyzer.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyzer.getByteFrequencyData(dataArray);

    // Calculate average level
    const average = dataArray.reduce((a, b) => a + b) / bufferLength;
    return average / 255; // Normalize to 0-1
  }

  /**
   * Mute/unmute microphone
   */
  setMuted(callId: string, muted: boolean): void {
    const session = this.sessions.get(callId);
    if (!session) return;

    session.localStream.getAudioTracks().forEach(track => {
      track.enabled = !muted;
    });

    this.emit('muteChanged', { callId, muted });
  }

  /**
   * Check if microphone is muted
   */
  isMuted(callId: string): boolean {
    const session = this.sessions.get(callId);
    if (!session) return false;

    return session.localStream.getAudioTracks().some(track => !track.enabled);
  }
}

// ============================================
// Singleton Instance
// ============================================
export const webRTCService = typeof window !== 'undefined'
  ? new WebRTCVoiceService()
  : null;

// ============================================
// React Hook
// ============================================
export function useWebRTCVoice() {
  return {
    service: webRTCService,
    isSupported: typeof window !== 'undefined' && !!window.RTCPeerConnection,
  };
}
