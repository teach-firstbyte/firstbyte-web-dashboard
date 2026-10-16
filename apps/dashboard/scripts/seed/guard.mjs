/**
 * Stops the wipe and seed scripts from ever touching production.
 *
 * Both scripts delete every row the app owns, so they must only run against
 * the local Supabase stack or the shared preview project. This is an ALLOW
 * list, not a block list: a URL that is neither local nor preview (a new
 * project, a typo, production) is refused, too.
 *
 * Every connection the script will use is checked, and they must all point at
 * the same place. A mix (preview database, local auth) would create the test
 * logins in one project and their rows in another.
 */

const PRODUCTION_REF = "bohtlovxpytpylfaievn";
const PREVIEW_REF = "kszxdakaiyispmrgicim";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/** "local", "preview", or throws. */
function classify(name, value) {
  if (value.includes(PRODUCTION_REF)) {
    throw new Error(
      `${name} points at the PRODUCTION project. Refusing to run.`,
    );
  }
  let host;
  try {
    host = new URL(value).hostname;
  } catch {
    throw new Error(`${name} is not a valid URL.`);
  }
  if (LOCAL_HOSTS.has(host)) return "local";
  // Pooler URLs carry the project ref in the user name (postgres.<ref>), and
  // API URLs carry it in the host (<ref>.supabase.co).
  if (value.includes(PREVIEW_REF)) return "preview";
  throw new Error(
    `${name} is neither the local stack nor the preview project (${PREVIEW_REF}). Refusing to run.`,
  );
}

/**
 * Checks the given env vars and returns "local" or "preview".
 * Missing vars are skipped; at least one must be set.
 */
export function assertSafeTarget(names) {
  const targets = new Set();
  for (const name of names) {
    const value = process.env[name];
    if (value) targets.add(classify(name, value));
  }
  if (targets.size === 0) {
    throw new Error(`None of ${names.join(", ")} is set.`);
  }
  if (targets.size > 1) {
    throw new Error(
      `${names.join(", ")} point at different places (local and preview). Refusing to run.`,
    );
  }
  return [...targets][0];
}

/** Runs main(), printing only the message of a failure (never a URL). */
export async function run(main) {
  try {
    await main();
  } catch (error) {
    console.error(`\n✖ ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}
