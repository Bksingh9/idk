/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // instrumentation.ts runs on startup by default in Next 15 (Layer 1 config
  // validation + Layer 7 Sentry/metrics init) — no experimental flag needed.
  // ioredis/postgres are server-only; never bundle them for the client.
  serverExternalPackages: ["ioredis", "mongodb", "pino", "pino-pretty"],
};

export default nextConfig;
