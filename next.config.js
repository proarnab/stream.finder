// next.config.js — HARDENED StreamFinder v3
const withPWA = require('next-pwa')({
  dest: 'public', register: true, skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  runtimeCaching: [
    { urlPattern: /^https:\/\/image\.tmdb\.org\/.*/i, handler: 'CacheFirst',
      options: { cacheName: 'tmdb-images', expiration: { maxEntries: 500, maxAgeSeconds: 86400 * 30 } } },
    { urlPattern: /^https:\/\/api\.themoviedb\.org\/.*/i, handler: 'NetworkFirst',
      options: { cacheName: 'tmdb-api', expiration: { maxEntries: 200, maxAgeSeconds: 3600 } } },
  ],
});

const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
  { key: 'Content-Security-Policy', value: [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://js.hcaptcha.com https://challenges.cloudflare.com https://pagead2.googlesyndication.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: https:",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self' https://api.themoviedb.org https://hcaptcha.com https://challenges.cloudflare.com",
    "frame-src https://hcaptcha.com https://challenges.cloudflare.com",
    "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'", "upgrade-insecure-requests",
  ].join('; ') },
  ...(process.env.NODE_ENV === 'production' ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }] : []),
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'image.tmdb.org', pathname: '/t/p/**' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com', pathname: '/**' },
      { protocol: 'https', hostname: 'avatars.githubusercontent.com', pathname: '/**' },
    ],
    minimumCacheTTL: 60,
    formats: ['image/avif', 'image/webp'],
  },
  experimental: {
    serverActions: { allowedOrigins: [process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'] },
  },
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
  async redirects() {
    if (process.env.NODE_ENV !== 'production') return [];
    return [{
      source: '/:path*',
      has: [{ type: 'header', key: 'x-forwarded-proto', value: 'http' }],
      destination: `https://${(process.env.NEXT_PUBLIC_SITE_URL ?? 'yourdomain.com').replace(/^https?:\/\//, '')}/:path*`,
      permanent: true,
    }];
  },
};

module.exports = withPWA(nextConfig);
