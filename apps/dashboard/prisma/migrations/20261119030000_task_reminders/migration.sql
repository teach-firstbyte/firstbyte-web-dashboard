-- CreateEnum
CREATE TYPE "task_reminder_kind" AS ENUM ('ASSIGNED', 'DUE_DATE_CHANGED', 'REASSIGNED_AWAY', 'DUE_SOON', 'DUE_TODAY', 'OVERDUE_OWNER', 'OVERDUE_CREATOR');

-- CreateEnum
CREATE TYPE "task_reminder_status" AS ENUM ('PENDING', 'SENDING', 'SENT', 'FAILED', 'SKIPPED', 'CANCELLED');

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "reminders_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "task_reminders" (
    "id" SERIAL NOT NULL,
    "task_id" INTEGER NOT NULL,
    "kind" "task_reminder_kind" NOT NULL,
    "recipient_id" INTEGER NOT NULL,
    "due_date" DATE NOT NULL,
    "event_key" TEXT NOT NULL DEFAULT '',
    "text" TEXT NOT NULL,
    "status" "task_reminder_status" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "first_attempt_at" TIMESTAMP(3),
    "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimed_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_reminders_status_next_attempt_at_idx" ON "task_reminders"("status", "next_attempt_at");

-- CreateIndex
CREATE INDEX "task_reminders_task_id_finished_at_idx" ON "task_reminders"("task_id", "finished_at");

-- CreateIndex
CREATE INDEX "task_reminders_recipient_id_idx" ON "task_reminders"("recipient_id");

-- CreateIndex
CREATE UNIQUE INDEX "task_reminders_task_id_kind_recipient_id_due_date_event_key_key" ON "task_reminders"("task_id", "kind", "recipient_id", "due_date", "event_key");

-- AddForeignKey
ALTER TABLE "task_reminders" ADD CONSTRAINT "task_reminders_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_reminders" ADD CONSTRAINT "task_reminders_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Note on reminders_from: tasks that already exist get the time this runs.
-- So none of them gets a scheduled reminder for today or an earlier day, only
-- the ones still ahead, and nothing piles up on the first hourly run.

-- EnableRLS
-- RLS on with no policies, like every other table: the Supabase Data API
-- can't read or change reminders, and Prisma (which skips RLS) works as
-- before. See "Adding a new table?" in the README.
ALTER TABLE "task_reminders" ENABLE ROW LEVEL SECURITY;
