/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typedRoutes: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config, { dev }) => {
    if (dev) {
      // Windows file locking can break filesystem cache writes/renames under `.next/cache`.
      // Memory cache avoids `UNKNOWN open ...\.next\static\chunks\webpack.js` + pack rename failures.
      config.cache = { type: 'memory' };
    }
    return config;
  }
};

export default nextConfig;
