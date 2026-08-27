-- CreateEnum
CREATE TYPE "public"."team_join_policy" AS ENUM ('OPEN', 'INVITE_ONLY');

-- ---------------------------------------------------------------------------
-- teams.join_policy
--
-- Added NOT NULL DEFAULT in ONE step, unlike users.status in the previous
-- migration. That one needed the nullable/backfill/constrain dance because the
-- default was WRONG for existing rows. Here it is right: every team that exists
-- today is a team students may ask to join, which is exactly what OPEN means.
-- ---------------------------------------------------------------------------
ALTER TABLE "public"."teams"
  ADD COLUMN "join_policy" "public"."team_join_policy" NOT NULL DEFAULT 'OPEN';

-- ---------------------------------------------------------------------------
-- EBOARD is the reason this column exists, so it is restricted in the same
-- migration that creates it. Doing it in a follow-up snippet would leave a
-- window where the code is live and EBOARD is still joinable by anyone.
--
-- teams.name is NOT unique and is free text a human typed, so the match is
-- normalized: case folded and stripped of everything that is not a letter or
-- digit. That is deliberately loose, because the name in the wild is "E-Board"
-- and the plausible variants ("EBOARD", "E Board", "eboard", "E.Board") all
-- differ only in punctuation and case. It may legitimately hit more than one
-- row; restricting all of them is the safe direction.
--
-- ZERO rows is the dangerous direction: it would ship the whole feature with the
-- team still OPEN and no error anywhere. So it raises, and because Prisma wraps
-- this file in a transaction the raise rolls the migration back cleanly instead
-- of half-applying it.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  restricted  INT;
  total_teams INT;
BEGIN
  UPDATE "public"."teams" SET "join_policy" = 'INVITE_ONLY'
   WHERE upper(regexp_replace("name", '[^A-Za-z0-9]', '', 'g')) = 'EBOARD';
  GET DIAGNOSTICS restricted = ROW_COUNT;

  IF restricted = 0 THEN
    SELECT count(*) INTO total_teams FROM "public"."teams";

    -- No teams at all means a fresh database -- a new environment, or the shadow
    -- database Prisma builds to check for drift -- so there is nothing to
    -- restrict and this is not an error. Raising unconditionally here would make
    -- `prisma migrate dev` impossible for everyone, since it replays every
    -- migration against an empty shadow database.
    --
    -- Teams present but none named EBOARD is the case worth failing on: that is
    -- a populated database where the name did not match, and letting it pass
    -- would ship the feature with EBOARD still joinable and no error anywhere.
    IF total_teams > 0 THEN
      RAISE EXCEPTION
        'Teams exist but none matched the e-board name. Fix the name in the teams table, or the match in this migration, then re-run.';
    END IF;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Cleanup: join requests for a team that is now invite-only.
--
-- PENDING only. Those rows came from the onboarding form, which can no longer
-- produce them, and after this migration a NORTHEASTERN_ADMIN cannot decide
-- them either -- they would sit in the approval queue as buttons that 403.
-- APPROVED rows are the real e-board and stay. REJECTED rows are an officer's
-- decision and stay as the audit trail.
-- ---------------------------------------------------------------------------
DELETE FROM "public"."team_members" tm
 USING "public"."teams" t
 WHERE t."id" = tm."team_id"
   AND t."join_policy" = 'INVITE_ONLY'
   AND tm."status" = 'PENDING';
