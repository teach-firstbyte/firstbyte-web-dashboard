-- Block the Supabase Data API (REST and GraphQL) from every table.
--
-- The app only reaches the database through Prisma, connected as `postgres`,
-- which skips row-level security. The Data API instead acts as `anon` (signed
-- out) or `authenticated` (signed in), using the publishable key that ships to
-- the browser. RLS with no policies plus no grants means those roles can't
-- read or change anything, while the app keeps working as before.
--
-- Every statement is safe to run again: enabling RLS twice or revoking a
-- privilege that isn't there is not an error.

-- EnableRLS
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "teams" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "team_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "meetings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "attendance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "feedback" ENABLE ROW LEVEL SECURITY;

-- Prisma's own history table. It is missing from the throwaway "shadow"
-- database that `prisma migrate dev` replays migrations into.
DO $$
BEGIN
  IF to_regclass('public._prisma_migrations') IS NOT NULL THEN
    ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
  END IF;
END
$$;

-- RevokeDataAPIAccess
-- `anon` and `authenticated` exist only on Supabase, so skip this anywhere
-- else instead of failing the migration.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

    -- Tables and sequences that later migrations create start with no access
    -- for these roles, too. They still need RLS turned on by hand.
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
      REVOKE ALL ON TABLES FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
      REVOKE ALL ON SEQUENCES FROM anon, authenticated;
  END IF;
END
$$;
