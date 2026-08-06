import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.public.blob.vercel-storage.com",
        pathname: "/products/**",
      },
      {
        protocol: "https",
        hostname: "**.public.blob.vercel-storage.com",
        pathname: "/catalog/**",
      },
    ],
    formats: ["image/webp"],
    imageSizes: [64, 96, 128, 192, 256, 320, 384, 480, 640],
    minimumCacheTTL: 2678400,
  },
};

export default nextConfig;
