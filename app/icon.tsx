export const runtime = 'edge'
export const contentType = 'image/svg+xml'

export function GET() {
  return new Response(
    `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#8b5cf6"/>
          <stop offset="100%" stop-color="#3b82f6"/>
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="16" fill="url(#g)"/>
      <text x="16" y="22" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="700" font-size="18" fill="white">V</text>
    </svg>`,
    { headers: { 'Content-Type': 'image/svg+xml' } }
  )
}
