import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { assertSafeToWipe, TEST_DATABASE_URL } from "./database";

/**
 * Runs once before the db tests.
 *
 * `prisma migrate deploy` creates the test database if it is missing and
 * applies any migration it has not seen yet. Then every table is emptied, so
 * each run starts with no rows and ids from 1.
 *
 * Not `prisma migrate reset`: Prisma blocks that when an AI agent runs it, and
 * the tests should run the same way for everyone.
 */
export default async function setup() {
  assertSafeToWipe(TEST_DATABASE_URL);

  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: TEST_DATABASE_URL,
      DIRECT_URL: TEST_DATABASE_URL,
    },
  });

  const prisma = new PrismaClient({ datasourceUrl: TEST_DATABASE_URL });
  try {
    const tables = await prisma.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
    if (tables.length > 0) {
      const list = tables.map((t) => `"public"."${t.tablename}"`).join(", ");
      await prisma.$executeRawUnsafe(
        `TRUNCATE ${list} RESTART IDENTITY CASCADE`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}
