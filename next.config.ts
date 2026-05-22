import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    config.externals.push('protobufjs/minimal.js');
    return config;
  },
};

export default nextConfig;