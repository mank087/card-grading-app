import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'zyxtqcvwkbpvsjsszbzg.supabase.co',
        port: '',
        pathname: '/storage/v1/object/**',
      },
    ],
  },
};

export default nextConfig;
