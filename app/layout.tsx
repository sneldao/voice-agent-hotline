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

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://your-claflin-app.vercel.app';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Claflin — your broker is on the line',
    template: '%s | Claflin',
  },
  description: 'Call Hetty, the first Claflin broker. Ask about tokenized stocks, get quotes, and place paper trades by voice — confirmed before execution.',
  keywords: ['Claflin', 'Hetty', 'voice broker', 'tokenized stocks', 'Coinbase', 'Base', 'Robinhood', 'paper trading', 'voice trading', 'AI broker', 'USDC', 'x402'],
  authors: [{ name: 'Claflin' }],
  creator: 'Claflin',
  publisher: 'Claflin',
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: siteUrl,
    siteName: 'Claflin',
    title: 'Claflin — your broker is on the line',
    description: 'Call Hetty, the first Claflin broker. Ask about tokenized stocks, get quotes, and place paper trades by voice — confirmed before execution.',
    images: [
      {
        url: '/og-image.svg',
        width: 1200,
        height: 630,
        alt: 'Claflin — your broker is on the line. Call Hetty for tokenized stock quotes and paper trades.',
        type: 'image/svg+xml',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@claflin_broker',
    creator: '@claflin_broker',
    title: 'Claflin — your broker is on the line',
    description: 'Call Hetty, the first Claflin broker. Ask about tokenized stocks, get quotes, and place paper trades by voice — confirmed before execution.',
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
