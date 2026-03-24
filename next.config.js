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

  // Server actions configuration
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',  // Support voice data uploads
    },
  },

  // Headers for security and performance
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

    // Ignore native module warnings from sodium-native/WDK
    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      {
        module: /node_modules\/@tetherto\/wdk/,
        message: /Can't resolve 'sodium-native'/,
      },
      {
        module: /node_modules\/sodium-native/,
        message: /Critical dependency/,
      },
      {
        module: /node_modules\/require-addon/,
        message: /Critical dependency/,
      },
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
