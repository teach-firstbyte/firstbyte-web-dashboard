/**
 * The database the db tests use. The default is a separate database on the
 * local Supabase Postgres (port 54322, the CLI's default password), so a test
 * run never touches the data the dev server shows.
 *
 * Set TEST_DATABASE_URL to use another one. globalSetup refuses any URL that
 * is not on this machine or whose database name does not end in `_test`,
 * because it deletes everything in that database.
 */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/firstbyte_test";

export function assertSafeToWipe(url: string) {
  const { hostname, pathname } = new URL(url);
  const local = ["127.0.0.1", "localhost", "::1", "[::1]"].includes(hostname);
  if (!local || !pathname.endsWith("_test")) {
    throw new Error(
      `Refusing to reset ${hostname}${pathname}: the test database must be on this machine and its name must end in _test.`,
    );
  }
}
