import type { NextConfig } from 'next';

const githubPages = process.env.GITHUB_PAGES === 'true';

const nextConfig: NextConfig = githubPages
  ? {
      output: 'export',
      basePath: '/automates',
      assetPrefix: '/automates',
      trailingSlash: true,
    }
  : {};

export default nextConfig;
