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

INSERT INTO "public"."teams" ("name", "description", "is_active", "join_policy")
VALUES
  ('CS Curricula',        NULL, true, 'OPEN'),
  ('STEM Curricula',      NULL, true, 'OPEN'),
  ('Software Website',    NULL, true, 'OPEN'),
  ('Software Events',     NULL, true, 'OPEN'),
  ('Brand and Marketing', NULL, true, 'OPEN'),
  -- The team this whole change exists for. Inserted as INVITE_ONLY directly,
  -- because on a fresh local database the migration runs before any team rows
  -- exist, so its UPDATE has nothing to match.
  ('EBOARD', 'Executive board. Assigned by a super admin.', true, 'INVITE_ONLY')
ON CONFLICT DO NOTHING;

SELECT id, name, join_policy FROM "public"."teams" ORDER BY id;

-- Roles for the four test accounts, once they have signed up through the UI.
-- Uncomment and adjust the emails you used.
--
-- UPDATE "public"."users" SET "role" = 'NORTHEASTERN_ADMIN', "status" = 'APPROVED'
--  WHERE "email" = 'admin@example.com';
-- UPDATE "public"."users" SET "role" = 'SUPER_ADMIN', "status" = 'APPROVED'
--  WHERE "email" = 'super@example.com';
