/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  images: {
    unoptimized: true,
  },
  // GitHub Pages serves from subdirectory
  basePath: '/voice-agent-hotline',
};

module.exports = nextConfig;
