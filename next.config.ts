import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable ESLint during builds for faster deployment
  // TypeScript checking still runs, but linting warnings won't block builds
  eslint: {
    ignoreDuringBuilds: true,
  },
  // TypeScript errors FAIL the build. The baseline was driven to zero on
  // 2026-07-28 (4,750 pre-existing errors cleaned); ignoreBuildErrors:true
  // is what let a missing import ship and take down every card detail page
  // for two days (fixed in 01b9673). Do not turn it back on — fix the error.
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    // Enable modern image formats for better compression
    formats: ['image/avif', 'image/webp'],
    // Optimize device sizes for responsive images
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // Cache optimized images for 1 hour
    minimumCacheTTL: 3600,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'zyxtqcvwkbpvsjsszbzg.supabase.co',
        port: '',
        pathname: '/storage/v1/object/**',
      },
      {
        // Supabase image transform endpoint (for resized images)
        protocol: 'https',
        hostname: 'zyxtqcvwkbpvsjsszbzg.supabase.co',
        port: '',
        pathname: '/storage/v1/render/image/**',
      },
      {
        protocol: 'https',
        hostname: 'images.pokemontcg.io',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.scrydex.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'assets.tcgdex.net',
        port: '',
        pathname: '/**',
      },
      {
        // One Piece TCG card images from OPTCG API (fallback - has watermarks)
        protocol: 'https',
        hostname: 'optcgapi.com',
        port: '',
        pathname: '/media/**',
      },
      {
        // Official One Piece TCG card images from Bandai (has watermarks)
        protocol: 'https',
        hostname: 'en.onepiece-cardgame.com',
        port: '',
        pathname: '/images/cardlist/**',
      },
      {
        // Limitless TCG One Piece card images (clean, no watermarks)
        protocol: 'https',
        hostname: 'limitlesstcg.nyc3.cdn.digitaloceanspaces.com',
        port: '',
        pathname: '/one-piece/**',
      },
      {
        // Lorcast Lorcana card images
        protocol: 'https',
        hostname: 'cards.lorcast.io',
        port: '',
        pathname: '/card/**',
      },
    ],
  },
  async redirects() {
    return [
      {
        // Host standardization: the bare apex is canonical. Both hosts used to
        // serve 200s, which splits crawl budget and link equity between two
        // origins and makes every canonical/JSON-LD @id ambiguous.
        source: '/:path*',
        has: [{ type: 'host', value: 'www.dcmgrading.com' }],
        destination: 'https://dcmgrading.com/:path*',
        permanent: true,
      },
    ]
  },
  async headers() {
    return [
      {
        // Apple Universal Links file has no extension — Vercel would default to
        // application/octet-stream, which Apple rejects. Force application/json.
        source: '/.well-known/apple-app-site-association',
        headers: [
          { key: 'Content-Type', value: 'application/json' },
          { key: 'Cache-Control', value: 'public, max-age=3600' },
        ],
      },
      {
        // Android App Links: the .json extension already yields application/json,
        // but pin Cache-Control so the CDN doesn't serve a stale negative cache.
        source: '/.well-known/assetlinks.json',
        headers: [
          { key: 'Content-Type', value: 'application/json' },
          { key: 'Cache-Control', value: 'public, max-age=3600' },
        ],
      },
    ]
  },
};

export default nextConfig;
