/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // Standalone output for Hetzner/VPS deployment
  // Creates minimal server bundle in .next/standalone
  output: 'standalone',
  
  // Optimize for production
  poweredByHeader: false,
  compress: true,

  images: {
    unoptimized: true,
  },
  
  // Disable static generation for all routes - this app requires dynamic rendering
  // due to client-only SDKs (ElevenLabs, WebRTC, WalletConnect)
  generateBuildId: async () => {
    return 'build-' + Date.now()
  },

  // Empty turbopack config - webpack config above handles customizations
  turbopack: {},

  // Server actions configuration
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',  // Support voice data uploads
    },
  },

  // Headers for security. CORS for /api/* is handled centrally in
  // middleware.ts (dynamic origin reflection + preflight handling), so we
  // deliberately do NOT set static Access-Control-* headers here — duplicate
  // or contradictory CORS headers make browsers reject the response.
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
        ],
      },
    ];
  },

  // Same-origin API proxy — the architectural fix for the CORS failures.
  //
  // Topology: the Vercel deployment is a pure frontend; the Hetzner VPS runs
  // the real API. Previously the browser called the VPS directly
  // (cross-origin), so any backend restart/proxy error surfaced as a CORS
  // failure with no response body for the UI to work with.
  //
  // When API_PROXY_TARGET is set (Vercel production only), the browser calls
  // its OWN origin at /api/* and the Next.js server forwards the request
  // server-to-server — no browser CORS at all, no preflight round-trips,
  // first-party cookies, and ad-blockers stop flagging the calls.
  //
  // beforeFiles makes the proxy take precedence over the local route handlers
  // (which only have real backing services on the VPS anyway). Leave
  // API_PROXY_TARGET unset on the VPS itself and in local dev.
  async rewrites() {
    const target = (process.env.API_PROXY_TARGET || '').replace(/\/+$/, '');
    if (!target) return [];
    return {
      beforeFiles: [
        {
          source: '/api/:path*',
          destination: `${target}/api/:path*`,
        },
      ],
    };
  },

  // Webpack configuration to suppress third-party warnings and handle client-only modules
  webpack: (config, { isServer }) => {
    // Mark client-only modules as external on server to prevent bundling during SSR
    if (isServer) {
      config.externals = config.externals || [];
      if (Array.isArray(config.externals)) {
        config.externals.push('@elevenlabs/client');
      }
    }

    // Suppress pino-pretty warning from WalletConnect
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        'pino-pretty': false,
        'pino/file': false,
      };
    }

    // Ignore native module warnings from third-party deps
    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      {
        module: /node_modules\/@walletconnect/,
        message: /Module not found: Can't resolve 'pino-pretty'/,
      },
      // Suppress all "Module not found" warnings for optional dependencies
      /Can't resolve '(pino-pretty|sodium-native)'/,
      // Suppress Critical dependency warnings from native modules
      /Critical dependency: require function is used/,
      /Critical dependency: the request of a dependency is an expression/,
    ];

    return config;
  },
};

module.exports = nextConfig;
