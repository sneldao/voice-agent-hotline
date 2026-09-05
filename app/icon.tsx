import { ImageResponse } from 'next/og';
import { HouseMark } from '@/components/desk/HouseMark';

export const runtime = 'nodejs';
export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#15251f', color: '#c5ac78' }}>
      <HouseMark size={28} color="#c5ac78" />
    </div>,
    size,
  );
}
