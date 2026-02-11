import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from '@/lib/WalletContext';
import { ThemeProvider } from '@/components/ThemeProvider';
import { DarkModeToggle } from '@/components/DarkModeToggle';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#0f172a',
};

export const metadata: Metadata = {
  title: 'VOISSS - Voice Agent Hotline',
  description: 'Talk to AI agents, pay per second via x402 micropayments on Celo. Delegate agents to take actions with ERC-8004 permissions.',
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
      <body className="antialiased">
        <Providers>
          <ThemeProvider>
            <DarkModeToggle />
            {children}
          </ThemeProvider>
        </Providers>
      </body>
    </html>
  );
}
