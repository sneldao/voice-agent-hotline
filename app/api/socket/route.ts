/**
 * WebSocket Voice Server for Real-time Audio Streaming
 * 
 * Handles voice call connections, audio chunk routing, and call state management.
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import type { Server as HttpServer } from 'http';

export interface CallState {
  id: string;
  agentId: string;
  userId: string;
  status: 'idle' | 'connecting' | 'connected' | 'ended';
  startTime: number;
  duration: number;
  audioChunks: number;
}

export interface AudioMessage {
  type: 'audio';
  data: Buffer;
  chunkIndex: number;
  timestamp: number;
}

export interface CallControlMessage {
  type: 'start_call' | 'end_call' | 'mute' | 'unmute' | 'typing';
  agentId: string;
  userId: string;
}

export interface VoiceEvents {
  'call:start': (data: { agentId: string; userId: string }) => void;
  'call:end': (data: { agentId: string; userId: string }) => void;
  'audio:chunk': (data: { agentId: string; userId: string; chunk: Buffer }) => void;
  'call:state': (state: CallState) => void;
  'error': (error: { message: string; code: string }) => void;
}

export class VoiceServer {
  private io: SocketIOServer;
  private calls: Map<string, CallState> = new Map();
  private agentConnections: Map<string, Set<string>> = new Map(); // agentId -> socketIds
  private userConnections: Map<string, Set<string>> = new Map(); // userId -> socketIds

  constructor(httpServer: HttpServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
      path: '/api/socket',
    });

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  private setupMiddleware(): void {
    this.io.use((socket, next) => {
      const userId = socket.handshake.query.userId as string;
      const agentId = socket.handshake.query.agentId as string;
      
      if (!userId && !agentId) {
        return next(new Error('Authentication required'));
      }
      
      socket.data.userId = userId;
      socket.data.agentId = agentId;
      next();
    });
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      console.log(`[VoiceServer] Client connected: ${socket.id}`);
      
      const userId = socket.data.userId as string;
      const agentId = socket.data.agentId as string;

      // Track connection
      if (userId) {
        const sockets = this.userConnections.get(userId) || new Set();
        sockets.add(socket.id);
        this.userConnections.set(userId, sockets);
      }

      if (agentId) {
        const sockets = this.agentConnections.get(agentId) || new Set();
        sockets.add(socket.id);
        this.agentConnections.set(agentId, sockets);
      }

      // Handle call start
      socket.on('call:start', (data: { agentId: string; userId: string }) => {
        const callId = `${data.userId}-${data.agentId}-${Date.now()}`;
        const call: CallState = {
          id: callId,
          agentId: data.agentId,
          userId: data.userId,
          status: 'connecting',
          startTime: Date.now(),
          duration: 0,
          audioChunks: 0,
        };
        
        this.calls.set(callId, call);
        
        // Notify agent
        this.io.to(`agent:${data.agentId}`).emit('call:incoming', {
          callId,
          userId: data.userId,
        });
        
        console.log(`[VoiceServer] Call started: ${callId}`);
      });

      // Handle audio chunks
      socket.on('audio:chunk', (data: { callId: string; chunk: Buffer; agentId: string }) => {
        const call = this.calls.get(data.callId);
        if (call && call.status === 'connected') {
          call.audioChunks++;
          
          // Route to appropriate parties
          socket.to(`agent:${data.agentId}`).emit('audio:received', {
            callId: data.callId,
            chunk: data.chunk,
            chunkIndex: call.audioChunks,
          });
        }
      });

      // Handle call end
      socket.on('call:end', (data: { callId: string }) => {
        const call = this.calls.get(data.callId);
        if (call) {
          call.status = 'ended';
          call.duration = Date.now() - call.startTime;
          
          // Notify all parties
          this.io.emit('call:ended', {
            callId: data.callId,
            duration: call.duration,
            agentId: call.agentId,
            userId: call.userId,
          });
          
          // Clean up after delay
          setTimeout(() => {
            this.calls.delete(data.callId);
          }, 60000);
          
          console.log(`[VoiceServer] Call ended: ${data.callId}, duration: ${call.duration}ms`);
        }
      });

      // Handle typing indicator
      socket.on('typing:start', (data: { agentId: string; userId: string }) => {
        socket.to(`agent:${data.agentId}`).emit('typing:show', { userId: data.userId });
      });

      socket.on('typing:stop', (data: { agentId: string; userId: string }) => {
        socket.to(`agent:${data.agentId}`).emit('typing:hide', { userId: data.userId });
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log(`[VoiceServer] Client disconnected: ${socket.id}`);
        
        // Clean up tracking
        if (userId) {
          const sockets = this.userConnections.get(userId);
          if (sockets) {
            sockets.delete(socket.id);
            if (sockets.size === 0) {
              this.userConnections.delete(userId);
            }
          }
        }

        if (agentId) {
          const sockets = this.agentConnections.get(agentId);
          if (sockets) {
            sockets.delete(socket.id);
            if (sockets.size === 0) {
              this.agentConnections.delete(agentId);
            }
          }
        }
      });
    });
  }

  /**
   * Join a room (agent or user)
   */
  joinRoom(socketId: string, room: string): void {
    this.io.sockets.sockets.get(socketId)?.join(room);
  }

  /**
   * Leave a room
   */
  leaveRoom(socketId: string, room: string): void {
    this.io.sockets.sockets.get(socketId)?.leave(room);
  }

  /**
   * Get call statistics
   */
  getStats(): {
    activeCalls: number;
    totalCalls: number;
    agentConnections: number;
    userConnections: number;
  } {
    const activeCalls = Array.from(this.calls.values()).filter(
      c => c.status !== 'ended'
    ).length;

    return {
      activeCalls,
      totalCalls: this.calls.size,
      agentConnections: this.agentConnections.size,
      userConnections: this.userConnections.size,
    };
  }

  /**
   * Get call by ID
   */
  getCall(callId: string): CallState | undefined {
    return this.calls.get(callId);
  }

  /**
   * Update call status
   */
  updateCallStatus(callId: string, status: CallState['status']): void {
    const call = this.calls.get(callId);
    if (call) {
      call.status = status;
      this.io.emit('call:state', call);
    }
  }

  /**
   * Broadcast to a specific agent's connected clients
   */
  broadcastToAgent(agentId: string, event: string, data: unknown): void {
    this.io.to(`agent:${agentId}`).emit(event, data);
  }

  /**
   * Broadcast to a specific user's connected clients
   */
  broadcastToUser(userId: string, event: string, data: unknown): void {
    this.io.to(`user:${userId}`).emit(event, data);
  }
}

// Factory function
export function createVoiceServer(httpServer: HttpServer): VoiceServer {
  return new VoiceServer(httpServer);
}
