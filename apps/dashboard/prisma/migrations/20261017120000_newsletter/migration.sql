-- Newsletter prototype: issues, each team's part of an issue, and who has read
-- what. Two flags on users: who may give final approval, and who has
-- unsubscribed.
--
-- Only adds things, so the code that is live now keeps working: it never
-- reads the new tables, and Prisma only selects the user columns it knows
-- about. Both new user columns are NOT NULL DEFAULT false, which is right for
-- every existing row: nobody is an approver and nobody has unsubscribed yet.

-- CreateEnum
CREATE TYPE "newsletter_issue_status" AS ENUM ('COLLECTING', 'READY', 'APPROVED', 'SENT', 'NOT_SENT');

-- CreateEnum
CREATE TYPE "team_update_status" AS ENUM ('DRAFT', 'APPROVED', 'SKIPPED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "newsletter_approver" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "newsletter_opt_out" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "newsletter_issues" (
    "id" SERIAL NOT NULL,
    "week_of" DATE NOT NULL,
    "status" "newsletter_issue_status" NOT NULL DEFAULT 'COLLECTING',
    "note" TEXT,
    "approved_at" TIMESTAMP(3),
    "approved_by_id" INTEGER,
    "sent_at" TIMESTAMP(3),
    "sent_count" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "newsletter_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "newsletter_team_updates" (
    "id" SERIAL NOT NULL,
    "issue_id" INTEGER NOT NULL,
    "team_id" INTEGER NOT NULL,
    "status" "team_update_status" NOT NULL DEFAULT 'DRAFT',
    "lines" JSONB NOT NULL DEFAULT '[]',
    "ai_lines" JSONB NOT NULL DEFAULT '[]',
    "checks" JSONB NOT NULL DEFAULT '{}',
    "ai_error" TEXT,
    "photo" TEXT,
    "decided_at" TIMESTAMP(3),
    "decided_by_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "newsletter_team_updates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "newsletter_reads" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "issue_id" INTEGER NOT NULL,
    "via" TEXT,
    "read_at" TIMESTAMP(3),
    "dismissed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "newsletter_reads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_issues_week_of_key" ON "newsletter_issues"("week_of");

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_team_updates_issue_id_team_id_key" ON "newsletter_team_updates"("issue_id", "team_id");

-- CreateIndex
CREATE INDEX "newsletter_reads_issue_id_idx" ON "newsletter_reads"("issue_id");

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_reads_user_id_issue_id_key" ON "newsletter_reads"("user_id", "issue_id");

-- AddForeignKey
ALTER TABLE "newsletter_issues" ADD CONSTRAINT "newsletter_issues_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "newsletter_team_updates" ADD CONSTRAINT "newsletter_team_updates_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "newsletter_issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "newsletter_team_updates" ADD CONSTRAINT "newsletter_team_updates_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "newsletter_team_updates" ADD CONSTRAINT "newsletter_team_updates_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "newsletter_reads" ADD CONSTRAINT "newsletter_reads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "newsletter_reads" ADD CONSTRAINT "newsletter_reads_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "newsletter_issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- EnableRLS
-- Same as every other table (see the lock_down_data_api migration): the app
-- reaches these only through Prisma, and the Data API roles get nothing. New
-- tables already start with no grants for anon and authenticated; RLS has to
-- be turned on by hand.
ALTER TABLE "newsletter_issues" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "newsletter_team_updates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "newsletter_reads" ENABLE ROW LEVEL SECURITY;
