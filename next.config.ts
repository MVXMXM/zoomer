import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  webpack(config, { dev }) {
    if (!dev) {
      // Ship the tuned defaults, without the development editor or its styles.
      config.resolve.alias = {
        ...config.resolve.alias,
        'dialkit$': path.resolve(__dirname, 'app/lib/dialkit.production.tsx'),
        'dialkit/styles.css$': path.resolve(__dirname, 'app/lib/dialkit.production.css'),
      }
    }
    return config
  },
  async redirects() {
    return [
      { source: "/demo", destination: "/", permanent: false },
      { source: "/demo/:path*", destination: "/", permanent: false },
    ]
  },
};

export default nextConfig;
