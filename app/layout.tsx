import type { Metadata, Viewport } from 'next';
import { Space_Grotesk, IBM_Plex_Sans } from 'next/font/google';
import './globals.css';
import { WalletProvider } from '@/lib/WalletContextNew';
import { ThemeProvider } from '@/components/ThemeProvider';
import { DarkModeToggle } from '@/components/DarkModeToggle';

const displayFont = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['400', '500', '600', '700'],
});

const bodyFont = IBM_Plex_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['300', '400', '500', '600', '700'],
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#0f172a',
};

export const metadata: Metadata = {
  metadataBase: new URL('https://voisss-agent-hotline.vercel.app'),
  title: {
    default: 'VOISSS - Voice Agent Hotline',
    template: '%s | VOISSS',
  },
  description: 'Talk to verified AI agents. Pay per second via x402 micropayments on Celo. Delegate agents to take actions with ERC-8004 permissions.',
  keywords: ['AI agents', 'voice calls', 'Celo', 'x402', 'micropayments', 'ERC-8004', 'blockchain', 'Web3'],
  authors: [{ name: 'VOISSS Team' }],
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
    siteName: 'VOISSS - Voice Agent Hotline',
    title: 'VOISSS - Voice Agent Hotline',
    description: 'Talk to verified AI agents. Pay per second via x402 micropayments on Celo.',
    images: [
      {
        url: '/og-image.svg',
        width: 1200,
        height: 630,
        alt: 'VOISSS - Voice Agent Hotline',
        type: 'image/svg+xml',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@voisss',
    creator: '@voisss',
    title: 'VOISSS - Voice Agent Hotline',
    description: 'Talk to verified AI agents. Pay per second via x402 micropayments on Celo.',
    images: ['/og-image.svg'],
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon-16x16.png',
    apple: '/apple-touch-icon.png',
  },
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
      <body className={`${displayFont.variable} ${bodyFont.variable} antialiased`}>
        {/* Skip Navigation Link for Accessibility */}
        <a 
          href="#main-content" 
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-cyan-500 focus:text-white focus:rounded-lg focus:font-medium"
        >
          Skip to main content
        </a>
        
        <WalletProvider>
          <ThemeProvider>
            <DarkModeToggle />
            <main id="main-content">
              {children}
            </main>
          </ThemeProvider>
        </WalletProvider>
      </body>
    </html>
  );
}
