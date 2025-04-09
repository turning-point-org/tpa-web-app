import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // output: 'standalone',
  distDir: 'build',
  eslint: {
    // Only run ESLint during local development and when explicitly enabled
    ignoreDuringBuilds: process.env.ESLINT_SKIP === 'true',
  },
  images: {
    domains: ['s.gravatar.com'],
  },
};

export default nextConfig;
