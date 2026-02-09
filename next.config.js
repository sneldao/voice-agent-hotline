/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Enable server-side rendering (remove static export)
  // output: 'export', // Removed for Vercel SSR
  
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;
