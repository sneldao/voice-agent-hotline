import { ImageResponse } from 'next/og'

export const runtime = 'nodejs'

export const size = {
  width: 32,
  height: 32,
}
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 22,
          fontWeight: 700,
          background: 'linear-gradient(135deg, #f59e0b, #ea580c)',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#0f172a',
          borderRadius: '50%',
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
