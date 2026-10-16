/**
 * Drops every app table and enum in the `public` schema, including Prisma's
 * migration history, so `prisma migrate deploy` can rebuild the schema from
 * scratch. Step 1 of `npm run db:reset:preview`.
 *
 * Dropping, not just emptying, is what makes a reset match `main`: a pull
 * request may have applied a migration to the shared preview database that
 * `main` does not have. Emptying the tables would keep that migration's
 * columns.
 *
 * Supabase's own schemas (auth, storage, ...) are not touched, so login
 * accounts in auth.users survive. The schema itself is kept, too, with its
 * grants and default privileges.
 *
 * Refuses to run against anything but the local stack or the preview project.
 */
import { PrismaClient } from "@prisma/client";
import { assertSafeTarget, run } from "./guard.mjs";

run(async () => {
  const target = assertSafeTarget(["DATABASE_URL", "DIRECT_URL"]);
  // The session pooler (or a direct connection) is the safe choice for DDL.
  const prisma = new PrismaClient({
    datasourceUrl: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  });
  try {
    const tables = await prisma.$queryRaw`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1`;
    const types = await prisma.$queryRaw`
      SELECT t.typname FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public' AND t.typtype = 'e' ORDER BY 1`;

    console.log(`Wiping the ${target} database:`);
    console.log(
      `  tables: ${tables.map((t) => t.tablename).join(", ") || "(none)"}`,
    );
    console.log(
      `  enums:  ${types.map((t) => t.typname).join(", ") || "(none)"}`,
    );

    await prisma.$transaction([
      ...tables.map((t) =>
        prisma.$executeRawUnsafe(
          `DROP TABLE IF EXISTS public."${t.tablename}" CASCADE`,
        ),
      ),
      ...types.map((t) =>
        prisma.$executeRawUnsafe(
          `DROP TYPE IF EXISTS public."${t.typname}" CASCADE`,
        ),
      ),
    ]);
    console.log("✔ Wiped. Next: prisma migrate deploy.");
  } finally {
    await prisma.$disconnect();
  }
});
