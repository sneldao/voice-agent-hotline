/**
 * Browser & Latency Utilities
 * 
 * Handle diverse browser environments and optimize for low latency
 */

export interface BrowserInfo {
  name: string
  version: number
  os: string
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
  supportsWebRTC: boolean
  supportsAudioWorklet: boolean
  supportsMediaRecorder: boolean
  preferredCodec: string
  recommendedQuality: 'low' | 'medium' | 'high'
}

/**
 * Detect browser and capabilities
 */
export function getBrowserInfo(): BrowserInfo {
  const ua = navigator.userAgent
  
  // Detect browser
  let name = 'unknown'
  let version = 0
  
  if (ua.includes('Chrome')) {
    name = 'chrome'
    version = parseInt(ua.match(/Chrome\/(\d+)/)?.[1] || '0')
  } else if (ua.includes('Safari') && !ua.includes('Chrome')) {
    name = 'safari'
    version = parseInt(ua.match(/Version\/(\d+)/)?.[1] || '0')
  } else if (ua.includes('Firefox')) {
    name = 'firefox'
    version = parseInt(ua.match(/Firefox\/(\d+)/)?.[1] || '0')
  } else if (ua.includes('Edg')) {
    name = 'edge'
    version = parseInt(ua.match(/Edg\/(\d+)/)?.[1] || '0')
  }

  // Detect OS
  let os = 'unknown'
  if (ua.includes('iPhone')) os = 'ios'
  else if (ua.includes('iPad')) os = 'ios'
  else if (ua.includes('Android')) os = 'android'
  else if (ua.includes('Windows')) os = 'windows'
  else if (ua.includes('Mac')) os = 'mac'
  else if (ua.includes('Linux')) os = 'linux'

  // Detect device type
  const isMobile = /iPhone|Android|Mobile/i.test(ua)
  const isTablet = /iPad|Tablet/i.test(ua)
  const isDesktop = !isMobile && !isTablet

  // Check capabilities
  const supportsWebRTC = !!(
    navigator.mediaDevices && 
    navigator.mediaDevices.getUserMedia &&
    window.RTCPeerConnection
  )

  const supportsAudioWorklet = !!window.AudioWorklet
  const supportsMediaRecorder = !!window.MediaRecorder

  // Preferred codec and quality based on browser
  let preferredCodec = 'opus'
  let recommendedQuality: 'low' | 'medium' | 'high' = 'high'

  if (name === 'safari') {
    // Safari has limited codec support
    preferredCodec = 'mp4a'
    recommendedQuality = 'medium'
  } else if (isMobile || name === 'firefox') {
    recommendedQuality = 'medium'
  }

  if (isMobile) {
    recommendedQuality = 'low'
  }

  return {
    name,
    version,
    os,
    isMobile,
    isTablet,
    isDesktop,
    supportsWebRTC,
    supportsAudioWorklet,
    supportsMediaRecorder,
    preferredCodec,
    recommendedQuality
  }
}

/**
 * Get optimal audio constraints for browser
 */
export function getAudioConstraints(browser: BrowserInfo) {
  const base = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true
  }

  if (browser.isMobile) {
    // Mobile: reduce quality for bandwidth
    return {
      ...base,
      sampleRate: 16000,
      channelCount: 1,
      bitsPerSample: 16
    }
  }

  // Desktop: higher quality
  return {
    ...base,
    sampleRate: 48000,
    channelCount: 1,
    bitsPerSample: 16
  }
}

/**
 * Get WebRTC config for browser
 */
export function getRTCConfig(browser: BrowserInfo): RTCConfiguration {
  const config: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  }

  // Add TURN servers for poor connections (in production)
  // if (browser.isMobile) {
  //   config.iceServers.push({
  //     urls: 'turn:your-turn-server.com:3478',
  //     username: 'user',
  //     credential: 'pass'
  //   })
  // }

  return config
}

/**
 * Monitor connection quality
 */
export class ConnectionMonitor {
  private pingTimes: number[] = []
  private lastPing = 0

  constructor(private onQualityChange: (quality: 'good' | 'fair' | 'poor') => void) {}

  ping() {
    const now = Date.now()
    if (this.lastPing > 0) {
      const ping = now - this.lastPing
      this.pingTimes.push(ping)
      if (this.pingTimes.length > 10) this.pingTimes.shift()
      
      const avg = this.pingTimes.reduce((a, b) => a + b, 0) / this.pingTimes.length
      
      if (avg < 100) this.onQualityChange('good')
      else if (avg < 300) this.onQualityChange('fair')
      else this.onQualityChange('poor')
    }
    this.lastPing = now
  }

  getAveragePing(): number {
    if (this.pingTimes.length === 0) return 0
    return this.pingTimes.reduce((a, b) => a + b, 0) / this.pingTimes.length
  }
}

/**
 * Adaptive audio buffer for latency optimization
 */
export class AudioBuffer {
  private buffer: Int16Array[] = []
  private targetLatencyMs = 100 // Target buffer latency

  push(data: Int16Array) {
    this.buffer.push(data)
    // Keep buffer to ~200ms of audio
    while (this.buffer.length > 8) {
      this.buffer.shift()
    }
  }

  pop(): Int16Array | null {
    return this.buffer.shift() || null
  }

  clear() {
    this.buffer = []
  }

  getLatency(): number {
    // Approximate latency based on buffer size
    return this.buffer.length * 25 // ~25ms per chunk
  }

  isReady(): boolean {
    return this.buffer.length >= 2 // At least 2 chunks before playing
  }
}
