-- Attendance rework, part 1 of 2 ("expand"). Issue #111.
--
-- This only adds things. The code that is live now does not know about any of
-- them and keeps working: it never writes EXCUSED, and it never reads the two
-- new columns, because Prisma only selects the columns it knows about.
--
-- Part 2 ("contract") ships after the new code is live. It deletes the
-- remaining REGISTERED rows and drops REGISTERED and checked_out_at.
--
-- REGISTERED rows for future meetings are NOT deleted here, although the issue
-- suggested it. The live officer roster is built only from attendance rows,
-- so deleting them would empty the roster of every upcoming meeting until the
-- new code ships, and "Mark the rest absent" would have nobody to mark. The
-- live code also keeps creating REGISTERED rows for new meetings until then,
-- so the new code has to ignore REGISTERED rows anyway. Part 2 deletes them.
--
-- Postgres can't use a new enum value in the same transaction that added it.
-- Nothing below uses EXCUSED, so this file is safe to run as one transaction.

-- AlterEnum
ALTER TYPE "attendance_status" ADD VALUE 'EXCUSED';

-- Who last set the status. Null for every row that exists today.
-- AlterTable
ALTER TABLE "attendance" ADD COLUMN     "marked_by_id" INTEGER;

-- When attendance was closed. Null means still open.
-- AlterTable
ALTER TABLE "meetings" ADD COLUMN     "attendance_closed_at" TIMESTAMP(3);

-- Deleting a user sets marked_by_id to null on the rows they marked, and this
-- index lets Postgres find those rows without reading the whole table.
-- CreateIndex
CREATE INDEX "attendance_marked_by_id_idx" ON "attendance"("marked_by_id");

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_marked_by_id_fkey" FOREIGN KEY ("marked_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
