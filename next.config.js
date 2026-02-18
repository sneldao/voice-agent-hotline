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
};

module.exports = nextConfig;
