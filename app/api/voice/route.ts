// ElevenLabs Voice API - Demo

export const dynamic = 'force-dynamic';
const VOICES = {
  Rachel: { voiceId: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', gender: 'female' },
  Domi: { voiceId: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi', gender: 'female' },
  Bella: { voiceId: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella', gender: 'female' },
  Antoni: { voiceId: 'ErXwobaYiN019PkySvjV', name: 'Antoni', gender: 'male' },
  Josh: { voiceId: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh', gender: 'male' },
  Adam: { voiceId: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', gender: 'male' },
} as const;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, text, voiceId } = body;

    if (action === 'voices') {
      return Response.json({
        success: true,
        data: {
          voices: Object.entries(VOICES).map(([key, v]) => ({ id: key, ...v })),
          default: 'Adam',
        },
      });
    }

    if (!text) {
      return Response.json({ error: 'text required' }, { status: 400 });
    }

    const voice = VOICES[voiceId as keyof typeof VOICES] || VOICES.Adam;
    const apiKey = process.env.ELEVENLABS_API_KEY;

    if (!apiKey) {
      // Browser TTS fallback
      return Response.json({
        success: true,
        data: {
          provider: 'browser',
          text,
          message: 'Configure ELEVENLABS_API_KEY for premium voice',
        },
      });
    }

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice.voiceId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0 },
      }),
    });

    if (!response.ok) {
      throw new Error(`ElevenLabs error: ${response.statusText}`);
    }

    const audioBuffer = await response.arrayBuffer();
    const duration = Math.ceil(text.split(/\s+/).length / 2.5);
    const audioBase64 = Buffer.from(audioBuffer).toString('base64');

    return Response.json({
      success: true,
      data: {
        provider: 'elevenlabs',
        voice: voice.name,
        text,
        audioBase64: `data:audio/mp3;base64,${audioBase64}`,
        duration,
        cost: text.length * 0.000001,
      },
    });
  } catch (error) {
    console.error('[VoiceAPI] Error:', error);
    return Response.json(
      { error: 'Synthesis failed', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return Response.json({
    success: true,
    data: {
      provider: 'elevenlabs',
      version: 'v1',
      features: ['synthesize', 'voices'],
      defaultVoice: 'Adam',
      voices: Object.keys(VOICES),
    },
  });
}
