import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // output: 'standalone',
  distDir: 'build',

  // 1. Fix: "Server Leaks Information via X-Powered-By"
  // Disables the 'X-Powered-By: Next.js' header so attackers don't know your stack.
  poweredByHeader: false,

  eslint: {
    // Only run ESLint during local development and when explicitly enabled
    ignoreDuringBuilds: process.env.ESLINT_SKIP === 'true',
  },
  typescript: {
    // Skip TypeScript checks when explicitly enabled with environment variable
    ignoreBuildErrors: process.env.SKIP_TYPESCRIPT_CHECK === 'true',
  },
  images: {
    domains: ['s.gravatar.com'],
  },

  // 2. Fix: Missing Security Headers
  async headers() {
    return [
      {
        // Apply these headers to all routes
        source: '/:path*',
        headers: [
          {
            // Fix: Missing Anti-clickjacking Header
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            // Fix: X-Content-Type-Options Header Missing
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            // Fix: Strict-Transport-Security Header Not Set
            // Forces HTTPS for 2 years (63072000 seconds)
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          }//,
          //{
            // Fix: Content Security Policy (CSP) Header Not Set
          //   key: 'Content-Security-Policy',
          //   value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data: https://s.gravatar.com; font-src 'self' data:;",
          //},
        ],
      },
    ]
  }
}

export default nextConfig