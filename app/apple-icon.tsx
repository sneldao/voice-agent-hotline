import { ImageResponse } from 'next/og'

export const runtime = 'nodejs'

// Apple touch icon — generated at /apple-icon so iOS stops 404ing
// /apple-touch-icon.png (which never existed in /public).
export const size = {
  width: 180,
  height: 180,
}
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 110,
          fontWeight: 700,
          background: 'linear-gradient(135deg, #f59e0b, #ea580c)',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#0f172a',
          borderRadius: '22%', // iOS applies its own mask; this previews nicely elsewhere
          letterSpacing: '-0.02em',
        }}
      >
        C
      </div>
    ),
    {
      ...size,
    }
  )
}
