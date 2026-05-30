import type { NextConfig } from 'next';
const config: NextConfig = {
  // playwright là optional dep, chỉ load runtime nodejs
  serverExternalPackages: ['playwright', 'cheerio'],
};
export default config;
