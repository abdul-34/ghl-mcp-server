import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  // The repo root also has a lockfile (the MCP server); pin tracing to this app.
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
