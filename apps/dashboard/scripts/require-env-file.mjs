/**
 * Fails if the env file a `db:*:<environment>` script needs is missing.
 *
 * Those scripts load the file with dotenv-cli, which says nothing when the
 * file doesn't exist. Prisma then falls back to .env and quietly runs against
 * the local database, so `npm run db:migrate:production` would look like it
 * worked while production was never touched.
 *
 * Usage: node scripts/require-env-file.mjs .env.production
 */
import { existsSync } from "node:fs";

const file = process.argv[2];

if (!file || !existsSync(file)) {
  console.error(
    `Missing apps/dashboard/${file}. Copy ${file}.example to ${file} and fill it in.`,
  );
  process.exit(1);
}
