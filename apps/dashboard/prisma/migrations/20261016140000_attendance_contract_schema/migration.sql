-- Attendance rework, migration 2c of 3 ("contract", schema). Issue #111.
--
-- Removes what the old attendance model left behind. Safe for the code that
-- is live now (#119): its Prisma schema already has none of these, so it
-- never reads or writes them.
--
-- - REGISTERED leaves attendance_status. Postgres can't drop one value from
--   an enum, so this makes a new type without it, moves the column over, and
--   drops the old type. Migration 2a deleted every REGISTERED row; if one
--   were still there, the cast would fail and nothing here would change.
-- - attendance.checked_out_at, meetings.started_at and meetings.ended_at go.
--   No code has used them since #117, and they are empty in production.
--
-- One transaction, so it all happens or none of it does.

BEGIN;

-- AlterEnum
CREATE TYPE "attendance_status_new" AS ENUM ('PRESENT', 'ABSENT', 'EXCUSED');
ALTER TABLE "attendance" ALTER COLUMN "status" TYPE "attendance_status_new" USING ("status"::text::"attendance_status_new");
ALTER TYPE "attendance_status" RENAME TO "attendance_status_old";
ALTER TYPE "attendance_status_new" RENAME TO "attendance_status";
DROP TYPE "public"."attendance_status_old";

-- AlterTable
ALTER TABLE "attendance" DROP COLUMN "checked_out_at";

-- AlterTable
ALTER TABLE "meetings" DROP COLUMN "ended_at",
DROP COLUMN "started_at";

COMMIT;
