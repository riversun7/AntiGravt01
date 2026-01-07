import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // API proxying is handled by /app/api routes at runtime
  // @ts-expect-error - Valid Next.js config but types might be strict
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  output: 'standalone',
};

export default nextConfig;
