/**
 * Vitest setup — load .env.local into process.env before the validated config
 * module is imported, so tests run against the same configuration as the app.
 */
import { readFileSync } from "node:fs";

try {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
} catch {
  /* rely on ambient env (CI) */
}

// Tests should be quiet unless something is wrong.
process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? "warn";
