/**
 * ElevenLabs Voice API
 * 
 * Text-to-speech with streaming support.
 * Integrates with VOISSS as fallback.
 */

import { NextRequest, NextResponse } from 'next/server';

// ElevenLabs configuration
const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';

// Pre-configured voices
export const VOICES = {
  Rachel: { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', gender: 'female', accent: 'american' },
  Domi: { id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi', gender: 'female', accent: 'american' },
  Bella: { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella', gender: 'female', accent: 'american' },
  Antoni: { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni', gender: 'male', accent: 'american' },
  Josh: { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh', gender: 'male', accent: 'american' },
  Adam: { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', gender: 'male', accent: 'american' },
} as const;

export type VoiceId = keyof typeof VOICES;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, text, voiceId, stream, model } = body;

    switch (action) {
      case 'synthesize':
        return handleSynthesize({ text, voiceId, stream, model });
      case 'voices':
        return handleGetVoices();
      case 'stream':
        return handleStream({ text, voiceId });
      default:
        return NextResponse.json(
          { error: 'Invalid action', code: 'INVALID_ACTION' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[VoiceAPI] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * Synthesize text to speech
 */
async function handleSynthesize({
  text,
  voiceId = 'Adam',
  stream = false,
  model = 'eleven_multilingual_v2',
}: {
  text: string;
  voiceId?: string;
  stream?: boolean;
  model?: string;
}): Promise<NextResponse> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  
  if (!apiKey) {
    // Fallback to browser TTS for demo
    return NextResponse.json({
      success: true,
      data: {
        provider: 'browser',
        text,
        message: 'Browser TTS - configure ELEVENLABS_API_KEY for premium voice',
        voices: Object.keys(VOICES),
      },
    });
  }

  const voice = VOICES[voiceId as VoiceId] || VOICES.Adam;

  try {
    const response = await fetch(
      `${ELEVENLABS_API_URL}/text-to-speech/${voice.id}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: model,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('[VoiceAPI] ElevenLabs error:', error);
      throw new Error(`ElevenLabs API error: ${response.statusText}`);
    }

    const audioBuffer = await response.arrayBuffer();
    const duration = estimateDuration(text);

    // In production, upload to CDN and return URL
    const audioBase64 = Buffer.from(audioBuffer).toString('base64');
    const audioUrl = `data:audio/mp3;base64,${audioBase64}`;

    console.log(`[VoiceAPI] Synthesized: ${text.slice(0, 50)}... (${duration}s)`);

    return NextResponse.json({
      success: true,
      data: {
        provider: 'elevenlabs',
        voice: voice.name,
        text,
        audioUrl: stream ? audioUrl : undefined,
        audioBase64: stream ? undefined : audioBase64,
        duration,
        characters: text.length,
        cost: text.length * 0.000001, // ~$0.000001/char
      },
    });
  } catch (error) {
    console.error('[VoiceAPI] Synthesis error:', error);
    
    // Fallback to VOISSS
    return handleVoisssFallback(text, voiceId);
  }
}

/**
 * Get available voices
 */
function handleGetVoices(): NextResponse {
  const voices = Object.entries(VOICES).map(([key, voice]) => ({
    id: key,
    ...voice,
  }));

  return NextResponse.json({
    success: true,
    data: {
      voices,
      default: 'Adam',
    },
  });
}

/**
 * Streaming response for real-time audio
 */
async function handleStream({
  text,
  voiceId = 'Adam',
}: {
  text: string;
  voiceId?: string;
}): Promise<NextResponse> {
  // For streaming, we chunk the text and return SSE
  const chunks = chunkText(text, 200); // 200 chars per chunk
  
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      for (let i = 0; i < chunks.length; i++) {
        const result = await handleSynthesize({
          text: chunks[i],
          voiceId,
          stream: true,
        });
        
        const data = await result.json();
        if (data.data?.audioBase64) {
          controller.enqueue(encoder.encode(`data: ${data.data.audioBase64}\n\n`));
        }
        
        // Add small delay for streaming effect
        await new Promise(r => setTimeout(r, 100));
      }
      
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

/**
 * Fallback to VOISSS
 */
async function handleVoisssFallback(text: string, voiceId?: string): Promise<NextResponse> {
  const voisssUrl = process.env.VOISSS_URL || 'https://voisss.netlify.app';
  
  try {
    const response = await fetch(`${voisssUrl}/api/agents/vocalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        voiceId: voiceId || 'Adam',
        agentAddress: process.env.AGENT_WALLET || '0x0',
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return NextResponse.json({
        success: true,
        data: {
          provider: 'voisss',
          ...data.data,
        },
      });
    }
  } catch (error) {
    console.error('[VoiceAPI] VOISSS fallback error:', error);
  }

  // Final fallback to browser TTS
  return NextResponse.json({
    success: true,
    data: {
      provider: 'browser',
      text,
      message: 'Browser TTS fallback - API keys not configured',
    },
  });
}

/**
 * Estimate audio duration
 */
function estimateDuration(text: string): number {
  const words = text.split(/\s+/).length;
  const avgWordsPerSecond = 2.5;
  return Math.ceil(words / avgWordsPerSecond);
}

/**
 * Chunk text for streaming
 */
function chunkText(text: string, maxChunkSize: number): string[] {
  if (text.length <= maxChunkSize) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    let chunk = remaining.slice(0, maxChunkSize);
    
    // Try to break at sentence boundary
    const lastPeriod = chunk.lastIndexOf('.');
    const lastQuestion = chunk.lastIndexOf('?');
    const lastExclamation = chunk.lastIndexOf('!');
    const breakPoint = Math.max(lastPeriod, lastQuestion, lastExclamation);

    if (breakPoint > 50) {
      chunk = chunk.slice(0, breakPoint + 1);
    }

    chunks.push(chunk.trim());
    remaining = remaining.slice(chunk.length).trim();
  }

  return chunks;
}

/**
 * GET endpoint for voice info
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  if (action === 'voices') {
    return handleGetVoices();
  }

  return NextResponse.json({
    success: true,
    data: {
      provider: 'elevenlabs',
      version: 'v1',
      features: ['synthesize', 'stream', 'voices'],
      defaultVoice: 'Adam',
      voices: Object.keys(VOICES),
    },
  });
}
