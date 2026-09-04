import type { Metadata, Viewport } from 'next';
import { Fraunces, IBM_Plex_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { WalletProvider } from '@/lib/WalletContextNew';
import { ThemeProvider } from '@/components/ThemeProvider';
import { WidgetEngineProvider } from '@/components/WidgetEngine';

// Distinctive type: Fraunces (variable display) + IBM Plex Sans (body) + JetBrains Mono (codes & balances)
const displayFont = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  axes: ['opsz', 'SOFT'],
});

const bodyFont = IBM_Plex_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

const monoFont = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#1c1917',
};

export const metadata: Metadata = {
  metadataBase: new URL('https://voisss-agent-hotline.vercel.app'),
  title: {
    default: 'VOISSS — A phonebook for AI you can talk to',
    template: '%s | VOISSS',
  },
  description: 'Say what you need. VOISSS connects you to the right voice agent — hands-free AI calls powered by ElevenLabs, billed per minute in USDC on Arbitrum.',
  keywords: ['AI agents', 'voice AI', 'ElevenLabs', 'hands-free', 'voice calls', 'conversational AI', 'USDC', 'Arbitrum', 'x402', 'AI hotline'],
  authors: [{ name: 'VOISSS' }],
  creator: 'VOISSS',
  publisher: 'VOISSS',
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://voisss-agent-hotline.vercel.app',
    siteName: 'VOISSS',
    title: 'VOISSS — A phonebook for AI you can talk to',
    description: 'Say what you need. Get connected to the right voice agent. Hands-free AI calls, billed per minute in USDC on Arbitrum.',
    images: [
      {
        url: '/og-image.svg',
        width: 1200,
        height: 630,
        alt: 'VOISSS — Voice Agent Hotline. AI agents you can talk to, billed in USDC on Arbitrum.',
        type: 'image/svg+xml',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@voisss',
    creator: '@voisss',
    title: 'VOISSS — A phonebook for AI you can talk to',
    description: 'Say what you need. Get connected to the right voice agent. Hands-free AI calls, billed per minute in USDC on Arbitrum.',
    images: ['/og-image.svg'],
  },
  // Icons come from file conventions: app/icon.tsx (32px PNG) and
  // app/apple-icon.tsx (180px) are auto-injected by Next.js; /favicon.ico
  // is served from /public. (The old manual entries pointed at files that
  // never existed — the favicon-16x16.png 404 in the console.)
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var savedTheme = localStorage.getItem('theme');
                var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                var theme = savedTheme || (prefersDark ? 'dark' : 'light');
                document.documentElement.classList.add(theme + '-mode');
              })();
            `,
          }}
        />
      </head>
      <body className={`${displayFont.variable} ${bodyFont.variable} ${monoFont.variable} antialiased`}>
        {/* Skip Navigation Link for Accessibility */}
        <a 
          href="#main-content" 
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-cyan-500 focus:text-white focus:rounded-lg focus:font-medium"
        >
          Skip to main content
        </a>
        
        <WalletProvider>
          <ThemeProvider>
            <WidgetEngineProvider>
              <div>
                {children}
              </div>
            </WidgetEngineProvider>
          </ThemeProvider>
        </WalletProvider>
      </body>
    </html>
  );
}
