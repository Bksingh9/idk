/**
 * Standalone config validation. Exits 0 if valid, 1 with a formatted report
 * otherwise. Used to PROVE Layer 1 (refuse-to-boot) without starting the server:
 *
 *   pnpm check:env        # with a missing var → exits 1, prints what's wrong
 */
import { loadEnv } from "@/lib/config/env";

try {
  const env = loadEnv();
  // eslint-disable-next-line no-console
  console.log(
    `✓ environment is valid (NODE_ENV=${env.NODE_ENV}, base_url=${env.APP_BASE_URL})`
  );
  process.exit(0);
} catch {
  // loadEnv already printed the formatted report.
  process.exit(1);
}
