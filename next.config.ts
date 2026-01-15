import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable ESLint during builds for faster deployment
  // TypeScript checking still runs, but linting warnings won't block builds
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Disable TypeScript errors during builds (optional - comment out if you want type checking)
  typescript: {
    ignoreBuildErrors: true,
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
        hostname: 'assets.tcgdex.net',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
