-- Attendance rework, migration 2a of 3 ("contract", data only). Issue #111.
--
-- Changes rows only, not the schema, and is safe for the code that is live
-- now (#117), whichever reaches production first:
--
-- 1. Deletes every REGISTERED row. The old code made one for every expected
--    member when a meeting was created. #117 reads them as "no record"
--    everywhere, so nothing on screen changes, except that a member's past
--    "Not recorded" meetings stop being listed. Present and Absent counts
--    and rates stay the same: REGISTERED never counted.
--
-- 2. Marks every meeting that started before #117 went live
--    (2026-10-16 06:12 UTC) as closed, at its start + 3 hours. Those
--    meetings ran under the old model. Closing one now would mark today's
--    members absent at a meeting from before they joined. #117 already
--    treats them as closed by date (ATTENDANCE_CLOSING_STARTS); after this,
--    the column says so, and migration 2b's code can drop the date rule.
--
-- Times are stored in UTC without a time zone, as Prisma writes them.

-- DeleteLeftoverRegistered
DELETE FROM "attendance" WHERE "status" = 'REGISTERED';

-- CloseOldMeetings
UPDATE "meetings"
SET "attendance_closed_at" = "scheduled_at" + INTERVAL '3 hours'
WHERE "attendance_closed_at" IS NULL
  AND "scheduled_at" < TIMESTAMP '2026-10-16 06:12:00';
