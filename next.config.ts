import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      "usb": false,
      "bufferutil": false,
      "utf-8-validate": false,
    };
    return config;
  },
}

export default nextConfig