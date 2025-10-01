import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    // ppr: true, // Disabled - only available in canary versions
  },
  images: {
    remotePatterns: [
      {
        hostname: 'avatar.vercel.sh',
      },
      {
        hostname: 'img.clerk.com',
      },
      {
        hostname: 'images.clerk.dev',
      },
    ],
  },
};

export default nextConfig;
