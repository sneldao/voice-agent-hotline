/**
 * Next.js Config for Backend-Only Deployment (Hetzner)
 * 
 * This config is optimized for API-only deployment.
 * The frontend is served by Vercel.
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // Standalone output for minimal server bundle
  output: 'standalone',
  
  // Disable static page generation - we're API-only
  // This speeds up the build and reduces memory usage
  distDir: '.next',
  
  // Optimize for production
  poweredByHeader: false,
  compress: true,

  // Disable image optimization (not needed for API)
  images: {
    unoptimized: true,
  },

  // Server actions configuration
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },

  // Headers for security
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          // CORS headers for Vercel frontend
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS, PATCH' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ];
  },

  // Disable type checking and linting during build (faster builds)
  // These should be checked in CI before deployment
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
