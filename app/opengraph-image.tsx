import { ImageResponse } from 'next/og';
import { HouseMark } from '@/components/desk/HouseMark';

export const alt = 'Claflin — your trading desk. A considered approach to tokenized stocks on Base.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', background: '#15251f', color: '#e8e6d9', padding: 36 }}>
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: 44, border: '1px solid #82724f' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}><HouseMark size={64} color="#c5ac78" /><span style={{ fontSize: 30, letterSpacing: 10 }}>CLAFLIN</span></div>
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 52, fontFamily: 'serif', fontSize: 80, lineHeight: 1.1 }}><span>Your trading desk.</span><span style={{ color: '#c5ac78', fontSize: 48 }}>A considered approach.</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 28, borderTop: '1px solid #82724f', color: '#aeb9aa', fontSize: 18 }}><span>HETTY / TOKENIZED STOCKS ON BASE</span><span>PAPER TRADING</span></div>
      </div>
    </div>,
    size,
  );
}
