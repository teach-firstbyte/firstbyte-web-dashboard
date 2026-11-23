-- CreateTable
CREATE TABLE "slack_links" (
    "user_id" INTEGER NOT NULL,
    "slack_user_id" TEXT NOT NULL,
    "linked_by_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "slack_links_pkey" PRIMARY KEY ("user_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "slack_links_slack_user_id_key" ON "slack_links"("slack_user_id");

-- CreateIndex
CREATE INDEX "slack_links_linked_by_id_idx" ON "slack_links"("linked_by_id");

-- AddForeignKey
ALTER TABLE "slack_links" ADD CONSTRAINT "slack_links_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slack_links" ADD CONSTRAINT "slack_links_linked_by_id_fkey" FOREIGN KEY ("linked_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- CheckFormat
-- The same rule as isSlackMemberId (src/lib/tasks/slack-member-id.ts), so a
-- write that skipped the app's check still can't store a bad ID. Prisma
-- doesn't model CHECK constraints, so it was added by hand.
ALTER TABLE "slack_links" ADD CONSTRAINT "slack_links_slack_user_id_format"
    CHECK ("slack_user_id" ~ '^[UW][A-Z0-9]{8,11}$');

-- EnableRLS
-- RLS on with no policies, like every other table: the Supabase Data API
-- can't read or change Slack links, and Prisma (which skips RLS) works as
-- before. See "Adding a new table?" in the README.
ALTER TABLE "slack_links" ENABLE ROW LEVEL SECURITY;
