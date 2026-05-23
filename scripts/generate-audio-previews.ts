/**
 * Generate agent voice preview audio clips using ElevenLabs TTS.
 * 
 * Usage:
 *   ELEVENLABS_API_KEY=your_key npx tsx scripts/generate-audio-previews.ts
 * 
 * This creates short (~5 second) MP3 clips in /public/audio/ that are used
 * as voice previews on agent cards and in the onboarding flow.
 */

import { writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';

const API_KEY = process.env.ELEVENLABS_API_KEY;
if (!API_KEY) {
  console.error('❌ ELEVENLABS_API_KEY is required');
  process.exit(1);
}

const OUTPUT_DIR = resolve(__dirname, '../public/audio');

// Agent preview scripts — short, friendly intros
const PREVIEWS: { agentId: string; voiceId: string; text: string }[] = [
  {
    agentId: 'general_helper',
    voiceId: 'pNInz6obpgDQGcFmaJgB', // Adam
    text: "Hey there! I'm your general helper. Tell me what you need and I'll take care of it.",
  },
  {
    agentId: 'medical_advisor',
    voiceId: 'EXAVITQu4vr4xnSDxMaL', // Sarah
    text: "Hi, I'm Dr. Maya. I can help you prepare for doctor visits and understand health topics.",
  },
  {
    agentId: 'web_researcher',
    voiceId: 'onwK4e9ZLuTAKqWW03F9', // Steve (Daniel)
    text: "I'm your web researcher. Ask me anything and I'll find current, sourced information for you.",
  },
  {
    agentId: 'code_reviewer',
    voiceId: 'ErXwobaYiN019PkySvjV', // Antoni
    text: "Code reviewer here. Walk me through your problem and I'll help you debug or architect a solution.",
  },
  {
    agentId: 'solana_sage',
    voiceId: 'TxGEqnHWrfWFTfGW9XjX', // Josh
    text: "I'm the Solana Sage. I can explain wallets, transactions, and DeFi concepts in plain English.",
  },
  {
    agentId: 'tour_master',
    voiceId: '21m00Tcm4TlvDq8ikWAM', // Rachel
    text: "Hey! I'm your tour master. Tell me where you want to go and I'll plan the perfect trip.",
  },
];

async function generatePreview(preview: typeof PREVIEWS[0]) {
  console.log(`🎙️  Generating preview for ${preview.agentId}...`);

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${preview.voiceId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': API_KEY!,
    },
    body: JSON.stringify({
      text: preview.text,
      model_id: 'eleven_monolingual_v1',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`  ❌ Failed for ${preview.agentId}: ${response.status} ${error}`);
    return;
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const outputPath = resolve(OUTPUT_DIR, `preview-${preview.agentId}.mp3`);
  writeFileSync(outputPath, buffer);
  console.log(`  ✅ Saved: ${outputPath} (${(buffer.length / 1024).toFixed(1)} KB)`);
}

async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log(`\n📁 Output directory: ${OUTPUT_DIR}\n`);

  for (const preview of PREVIEWS) {
    await generatePreview(preview);
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('\n✨ Done! Audio previews generated.\n');
}

main().catch(console.error);
