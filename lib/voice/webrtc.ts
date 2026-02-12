/**
 * WebRTC Voice Service
 * 
 * Real-time voice streaming for voice agent calls
 * Captures microphone audio, sends to pipeline, streams response back
 */

import { VoicePipeline } from './pipeline'

export interface VoiceCallOptions {
  agentId: string
  onAudioStream: (audio: Uint8Array) => void
  onTranscript: (text: string, isFinal: boolean) => void
  onError: (error: Error) => void
  onEnd: () => void
}

export class WebRTCVoiceService {
  private pipeline: VoicePipeline
  private peerConnection: RTCPeerConnection | null = null
  private audioContext: AudioContext | null = null
  private mediaStream: MediaStream | null = null
  private audioWorklet: AudioWorkletNode | null = null

  constructor() {
    this.pipeline = new VoicePipeline()
  }

  /**
   * Start a voice call with an agent
   */
  async startCall(options: VoiceCallOptions): Promise<void> {
    try {
      // Request microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      })

      // Create peer connection for WebRTC signaling
      this.peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' }
        ]
      })

      // Add audio track to peer connection
      this.mediaStream.getTracks().forEach(track => {
        this.peerConnection!.addTrack(track, this.mediaStream!)
      })

      // Handle incoming audio from agent
      this.peerConnection.ontrack = (event) => {
        this.handleIncomingAudio(event.streams[0])
      }

      // Handle ICE candidates
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          // Send to signaling server
          this.sendICECandidate(event.candidate)
        }
      }

      // Create audio context for processing
      this.audioContext = new AudioContext()
      
      // Set up audio worklet for real-time processing
      await this.setupAudioWorklet(options)

      console.log('[WebRTC] Call started successfully')

    } catch (error) {
      console.error('[WebRTC] Failed to start call:', error)
      options.onError(error as Error)
    }
  }

  /**
   * Set up audio worklet for real-time audio processing
   */
  private async setupAudioWorklet(options: VoiceCallOptions): Promise<void> {
    // Create worklet code as a blob
    const workletCode = `
      class AudioProcessor extends AudioWorkletProcessor {
        constructor() {
          super()
          this.buffer = []
        }

        process(inputs, outputs, parameters) {
          const input = inputs[0]
          if (input && input.length > 0) {
            const channelData = input[0]
            // Send audio data to main thread
            this.port.postMessage({
              type: 'audio',
              data: channelData
            })
          }
          return true
        }
      }

      registerProcessor('audio-processor', AudioProcessor)
    `

    const blob = new Blob([workletCode], { type: 'application/javascript' })
    const workletUrl = URL.createObjectURL(blob)

    await this.audioContext!.audioWorklet.addModule(workletUrl)

    this.audioWorklet = new AudioWorkletNode(this.audioContext!, 'audio-processor')

    this.audioWorklet.port.onmessage = async (event) => {
      if (event.data.type === 'audio') {
        const audioData = new Uint8Array(event.data.data)
        await this.processAudioInput(audioData, options)
      }
    }

    // Connect worklet to audio context
    const source = this.audioContext!.createMediaStreamSource(this.mediaStream!)
    source.connect(this.audioWorklet)
  }

  /**
   * Process audio input through the voice pipeline
   */
  private async processAudioInput(audioData: Uint8Array, options: VoiceCallOptions): Promise<void> {
    try {
      // Convert to AudioInput format
      const audioInput = {
        data: audioData,
        mimeType: 'audio/webm'
      }

      // Transcribe audio to text (STT)
      const transcript = await this.pipeline.transcribe(audioInput)
      
      if (transcript.text && transcript.text.trim().length > 0) {
        // Send transcript to UI
        options.onTranscript(transcript.text, true)
      }

    } catch (error) {
      console.error('[WebRTC] Audio processing error:', error)
    }
  }

  /**
   * Handle incoming audio from the agent
   */
  private handleIncomingAudio(stream: MediaStream): void {
    const audio = new Audio()
    audio.srcObject = stream
    audio.play()
  }

  /**
   * Send ICE candidate to signaling server
   */
  private sendICECandidate(candidate: RTCIceCandidateInit): void {
    // In production, send to your signaling server
    console.log('[WebRTC] ICE candidate:', candidate.candidate)
  }

  /**
   * End the current call
   */
  async endCall(): Promise<void> {
    // Stop all tracks
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop())
      this.mediaStream = null
    }

    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close()
      this.peerConnection = null
    }

    // Close audio context
    if (this.audioContext) {
      await this.audioContext.close()
      this.audioContext = null
    }

    console.log('[WebRTC] Call ended')
  }

  /**
   * Get call statistics
   */
  async getCallStats(): Promise<RTCStatsReport | null> {
    return this.peerConnection?.getStats() || null
  }
}

// Factory function
export function createVoiceCall(options: VoiceCallOptions): WebRTCVoiceService {
  const service = new WebRTCVoiceService()
  service.startCall(options)
  return service
}
