import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // output: 'standalone',
  distDir: 'build',
  images: {
    domains: ['s.gravatar.com'],
  },
};

export default nextConfig;
