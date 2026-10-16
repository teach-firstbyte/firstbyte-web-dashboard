-- Local test fixtures for the team join policy work (issue #88).
--
-- Deliberately NOT wired into config.toml's [db.seed] sql_paths. `supabase db
-- reset` runs seed files immediately after applying supabase/migrations, but
-- this project's schema lives in prisma/migrations -- so at seed time the tables
-- do not exist yet. Run this by hand AFTER `npx prisma migrate deploy` instead:
--
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
--        -f supabase/snippets/local-test-fixtures.sql
--
-- Teams only. The four test accounts have to be signed up through the real UI
-- so that Supabase auth.users and public.users both exist (they are joined by
-- email alone), and local auth has confirmations on -- confirm each signup from
-- Inbucket at http://localhost:54324. Then set roles with the block at the
-- bottom, since no code path writes users.role.

INSERT INTO "public"."teams" ("name", "description", "is_active", "join_policy", "updated_at")
VALUES
  ('CS Curricula',        NULL, true, 'OPEN', now()),
  ('STEM Curricula',      NULL, true, 'OPEN', now()),
  ('Software Website',    NULL, true, 'OPEN', now()),
  ('Software Events',     NULL, true, 'OPEN', now()),
  ('Brand and Marketing', NULL, true, 'OPEN', now()),
  -- The team this whole change exists for. Inserted as INVITE_ONLY directly,
  -- because on a fresh local database the migration runs before any team rows
  -- exist, so its UPDATE has nothing to match.
  ('E-Board', 'Executive board. Assigned by a super admin.', true, 'INVITE_ONLY', now())
ON CONFLICT DO NOTHING;

SELECT id, name, join_policy FROM "public"."teams" ORDER BY id;

-- Roles for the four test accounts, once they have signed up through the UI.
-- Uncomment and adjust the emails you used.
--
-- UPDATE "public"."users" SET "role" = 'NORTHEASTERN_ADMIN', "status" = 'APPROVED'
--  WHERE "email" = 'admin@example.com';
-- UPDATE "public"."users" SET "role" = 'SUPER_ADMIN', "status" = 'APPROVED'
--  WHERE "email" = 'super@example.com';

-- UI redesign test accounts (local Supabase only), created through the local
-- auth admin API with email already confirmed. Sign in at
-- http://localhost:3001/dashboard/login. Role and status are set by
-- local-ui-sample-data.sql. Passwords are kept out of the repo, in the
-- gitignored apps/dashboard/supabase/.env.test-accounts.
--
--   officer: ui-test-officer@firstbyte.test
--   member:  ui-test-member@firstbyte.test
