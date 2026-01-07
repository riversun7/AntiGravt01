import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: process.env.INTERNAL_API_URL || 'http://localhost:3001/api/:path*', // Proxy to Backend
      },
    ];
  },
  // @ts-expect-error - Valid Next.js config but types might be strict
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  output: 'standalone',
};

export default nextConfig;
