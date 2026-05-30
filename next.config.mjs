/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Next.js runs instrumentation.ts on startup (Layer 1 config validation +
  // Layer 7 Sentry/metrics init). Stable in Next 15, but set explicitly.
  experimental: {
    instrumentationHook: true,
  },
  // ioredis/postgres are server-only; never bundle them for the client.
  serverExternalPackages: ["ioredis", "postgres", "pino", "pino-pretty"],
};

export default nextConfig;
