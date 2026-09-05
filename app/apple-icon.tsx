import { ImageResponse } from 'next/og';
import { HouseMark } from '@/components/desk/HouseMark';

export const runtime = 'nodejs';

// Apple touch icon — generated at /apple-icon so iOS stops 404ing
// /apple-touch-icon.png (which never existed in /public).
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#15251f', color: '#c5ac78',
      borderRadius: '12%', // iOS applies its own mask; this previews nicely elsewhere
    }}><HouseMark size={128} color="#c5ac78" /></div>,
    size,
  );
}
