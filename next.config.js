/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config, { isServer }) => {
    const path = require('path');

    // Stub out standalone project pages (app/app/) before webpack parses imports
    config.module.rules.push({
      test: /\.(ts|tsx)$/,
      include: [/app[/\\]app/],
      use: path.resolve(__dirname, 'stub-loader.js'),
    });

    // Ignore non-page standalone project files
    config.module.rules.push({
      test: /\.(ts|tsx)$/,
      include: [
        /app[/\\]components/,
        /app[/\\]lib/,
        /app[/\\]types/,
        /app[/\\]scripts/,
        /app[/\\]tests/,
      ],
      loader: 'ignore-loader',
    });

    // Ignore stale type files from the standalone project's build output
    config.module.rules.push({
      test: /\.(ts|tsx)$/,
      include: [/app[/\\]\.next/],
      loader: 'ignore-loader',
    });
    return config;
  },
};

module.exports = nextConfig;
