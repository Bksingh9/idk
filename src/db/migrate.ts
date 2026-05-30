/**
 * Migration runner. Applies all generated SQL migrations in src/db/migrations.
 *   pnpm db:generate   # create migration from schema changes
 *   pnpm db:migrate    # apply migrations
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required to run migrations");
  const migrationClient = postgres(url, { max: 1 });
  const db = drizzle(migrationClient);
  // eslint-disable-next-line no-console
  console.log("running migrations…");
  await migrate(db, { migrationsFolder: "./src/db/migrations" });
  // eslint-disable-next-line no-console
  console.log("✓ migrations applied");
  await migrationClient.end();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("migration failed:", err);
  process.exit(1);
});
