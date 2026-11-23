-- CreateTable
CREATE TABLE "task_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "summary_day" INTEGER NOT NULL DEFAULT 1,
    "summary_hour" INTEGER NOT NULL DEFAULT 9,
    "updated_by_id" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_summaries" (
    "id" SERIAL NOT NULL,
    "recipient_id" INTEGER NOT NULL,
    "week_of" DATE NOT NULL,
    "text" TEXT NOT NULL,
    "status" "task_reminder_status" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "first_attempt_at" TIMESTAMP(3),
    "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimed_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_settings_updated_by_id_idx" ON "task_settings"("updated_by_id");

-- CreateIndex
CREATE INDEX "task_summaries_status_next_attempt_at_idx" ON "task_summaries"("status", "next_attempt_at");

-- CreateIndex
CREATE INDEX "task_summaries_week_of_idx" ON "task_summaries"("week_of");

-- CreateIndex
CREATE UNIQUE INDEX "task_summaries_recipient_id_week_of_key" ON "task_summaries"("recipient_id", "week_of");

-- AddForeignKey
ALTER TABLE "task_settings" ADD CONSTRAINT "task_settings_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_summaries" ADD CONSTRAINT "task_summaries_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Checks
-- Prisma doesn't model CHECK constraints, so these were added by hand. The
-- same rules as isSummarySchedule and weekOf (src/lib/tasks/weekly-summary.ts),
-- so a write that skipped the app's checks still can't store a bad setting.
-- One row of settings for the whole club.
ALTER TABLE "task_settings" ADD CONSTRAINT "task_settings_single_row"
    CHECK ("id" = 1);
ALTER TABLE "task_settings" ADD CONSTRAINT "task_settings_summary_day_range"
    CHECK ("summary_day" BETWEEN 0 AND 6);
ALTER TABLE "task_settings" ADD CONSTRAINT "task_settings_summary_hour_range"
    CHECK ("summary_hour" BETWEEN 0 AND 23);
-- A summary's week is keyed by its Monday, so the same week can't be
-- recorded under two different days.
ALTER TABLE "task_summaries" ADD CONSTRAINT "task_summaries_week_of_monday"
    CHECK (EXTRACT(ISODOW FROM "week_of") = 1);

-- DefaultSettings
-- The spec's default, Mondays at 9am Boston time, written out so the row is
-- there from the start. The code falls back to the same values if it isn't.
INSERT INTO "task_settings" ("id", "summary_day", "summary_hour", "updated_at")
VALUES (1, 1, 9, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- EnableRLS
-- RLS on with no policies, like every other table: the Supabase Data API
-- can't read or change the settings or the summaries, and Prisma (which skips
-- RLS) works as before. See "Adding a new table?" in the README.
ALTER TABLE "task_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "task_summaries" ENABLE ROW LEVEL SECURITY;
