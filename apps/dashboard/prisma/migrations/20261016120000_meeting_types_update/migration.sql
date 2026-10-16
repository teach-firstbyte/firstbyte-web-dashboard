-- Meeting types: BOARD_MEETING becomes EBOARD_MEETING, and SOCIAL_EVENT and
-- CHV_WORKSHOP are removed.
--
-- Postgres cannot drop a value from an enum, so we build a new enum, point the
-- column at it, and drop the old one. If any meeting still uses SOCIAL_EVENT or
-- CHV_WORKSHOP, the ALTER COLUMN below fails and the whole migration rolls back.
-- That is on purpose: move those meetings to another type first.

CREATE TYPE "public"."meeting_type_new" AS ENUM ('GENERAL_MEETING', 'EBOARD_MEETING', 'FIRSTBITES', 'WORKSHOP');

ALTER TABLE "public"."meetings"
  ALTER COLUMN "type" TYPE "public"."meeting_type_new"
  USING (
    CASE "type"::text
      WHEN 'BOARD_MEETING' THEN 'EBOARD_MEETING'
      ELSE "type"::text
    END
  )::"public"."meeting_type_new";

DROP TYPE "public"."meeting_type";
ALTER TYPE "public"."meeting_type_new" RENAME TO "meeting_type";
