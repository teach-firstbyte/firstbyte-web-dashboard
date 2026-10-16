import path from "node:path";
import { defineConfig } from "vitest/config";
import { TEST_DATABASE_URL } from "./test/database";

const alias = {
  "@": path.resolve(__dirname, "src"),
  // server-only throws when imported outside a React Server Component build.
  // Tests run in plain Node, which is the server, so it has nothing to guard.
  "server-only": path.resolve(__dirname, "test/empty.ts"),
};

/**
 * Two groups of tests:
 *
 *   unit  `*.test.ts`     pure functions, no database, runs anywhere
 *   db    `*.db.test.ts`  services against a real Postgres database
 *
 * The db group needs local Supabase running. It uses its own database,
 * `firstbyte_test`, never the `postgres` database the dev server uses, and
 * wipes it before each run. See test/globalSetup.ts.
 */
export default defineConfig({
  test: {
    // The db files share one database, so files must not run at once. Vitest
    // only takes this for the whole run, not per project.
    fileParallelism: false,
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          include: ["src/**/*.test.ts"],
          exclude: ["src/**/*.db.test.ts"],
        },
      },
      {
        resolve: { alias },
        test: {
          name: "db",
          include: ["src/**/*.db.test.ts"],
          globalSetup: ["test/globalSetup.ts"],
          env: { DATABASE_URL: TEST_DATABASE_URL },
        },
      },
    ],
  },
});
