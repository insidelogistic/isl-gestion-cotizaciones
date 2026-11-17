import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['node:sqlite', 'pg'],
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
