// WebRTC Voice Service for Real Calls

interface VoiceConfig {
  iceServers: RTCIceServer[];
}

interface CallSession {
  id: string;
  agentId: string;
  callerAddress: string;
  status: 'pending' | 'connecting' | 'connected' | 'ended';
  startTime: number;
  endTime?: number;
}

export class VoiceService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private config: VoiceConfig;

  constructor(config?: Partial<VoiceConfig>) {
    this.config = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        ...(config?.iceServers || []),
      ],
    };
  }

  // Initialize local media stream
  async initializeLocalStream(constraints: MediaStreamConstraints = { audio: true, video: false }): Promise<MediaStream> {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      return this.localStream;
    } catch (error) {
      console.error('Failed to get local stream:', error);
      throw new Error('Could not access microphone');
    }
  }

  // Create peer connection
  async createPeerConnection(): Promise<RTCPeerConnection> {
    this.peerConnection = new RTCPeerConnection(this.config);

    // Add local tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        this.peerConnection!.addTrack(track, this.localStream!);
      });
    }

    // Handle incoming tracks
    this.peerConnection.ontrack = (event) => {
      this.remoteStream = event.streams[0];
    };

    // ICE candidate handling
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        // In production: send to signaling server
        this.sendIceCandidate(event.candidate);
      }
    };

    // Connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      console.log('Connection state:', this.peerConnection?.connectionState);
    };

    return this.peerConnection;
  }

  // Create offer (caller side)
  async createOffer(): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    const offer = await this.peerConnection.createOffer({
      offerToReceiveAudio: true,
    });
    await this.peerConnection.setLocalDescription(offer);
    return offer;
  }

  // Create answer (callee side)
  async createAnswer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    return answer;
  }

  // Handle incoming answer
  async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
  }

  // Add ICE candidate
  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }
    await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  }

  // Toggle mute
  toggleMute(enabled: boolean): void {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = !enabled;
      });
    }
  }

  // Get remote stream
  getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  // Get local stream
  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  // End call
  async endCall(): Promise<void> {
    // Stop all tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.remoteStream = null;
  }

  // Send ICE candidate to signaling server
  private sendIceCandidate(candidate: RTCIceCandidate): void {
    // In production: WebSocket to signaling server
    // signalingServer.send({ type: 'ice-candidate', candidate });
  }

  // Get call statistics
  async getStats(): Promise<RTCStatsReport | null> {
    if (!this.peerConnection) return null;
    return await this.peerConnection.getStats();
  }
}

// WebSocket Signaling Service
export class SignalingService {
  private ws: WebSocket | null = null;
  private messageHandlers: Map<string, (data: any) => void> = new Map();

  constructor(private url: string) {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('Signaling connected');
        resolve();
      };

      this.ws.onerror = (error) => {
        console.error('Signaling error:', error);
        reject(error);
      };

      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        const handler = this.messageHandlers.get(data.type);
        if (handler) {
          handler(data);
        }
      };

      this.ws.onclose = () => {
        console.log('Signaling disconnected');
      };
    });
  }

  // Send message
  send(type: string, payload: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }));
    }
  }

  // Register message handler
  on(type: string, handler: (data: any) => void): void {
    this.messageHandlers.set(type, handler);
  }

  // Disconnect
  disconnect(): void {
    this.ws?.close();
    this.ws = null;
  }
}

// Call Session Management
export class CallSessionManager {
  private sessions: Map<string, CallSession> = new Map();

  createSession(agentId: string, callerAddress: string): CallSession {
    const session: CallSession = {
      id: crypto.randomUUID(),
      agentId,
      callerAddress,
      status: 'pending',
      startTime: Date.now(),
    };
    this.sessions.set(session.id, session);
    return session;
  }

  updateStatus(sessionId: string, status: CallSession['status']): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = status;
    }
  }

  endSession(sessionId: string): CallSession | null {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'ended';
      session.endTime = Date.now();
    }
    return session || null;
  }

  getSession(sessionId: string): CallSession | null {
    return this.sessions.get(sessionId) || null;
  }

  getSessionDuration(sessionId: string): number {
    const session = this.sessions.get(sessionId);
    if (!session) return 0;
    const endTime = session.endTime || Date.now();
    return Math.floor((endTime - session.startTime) / 1000); // seconds
  }
}

// Export singleton instances
export const voiceService = new VoiceService();
export const signalingService = new SignalingService(
  process.env.NEXT_PUBLIC_SIGNALING_URL || 'wss://signaling.example.com'
);
export const sessionManager = new CallSessionManager();
