import { BackLink } from "@/components/BackLink";
import { PageHeader, Section } from "@/components/common/Section";
import { AppShell } from "@/components/layout/AppShell";
import { requireSlackSetupAccess } from "@/lib/auth/requireSlackSetupAccess";
import { getViewMode } from "@/lib/auth/viewMode";
import { listSlackSetup } from "@/server/tasks/slack-links";
import { getSummarySetup } from "@/server/tasks/weekly-summary";
import { SlackLinksTable, type SlackLinkRow } from "./SlackLinksTable";
import { SummaryScheduleForm } from "./SummaryScheduleForm";

/**
 * Slack setup: a super admin links each e-board member to their Slack account
 * by hand, so the FirstByte Tasks bot can DM them. Nothing is matched by
 * email. Anyone who isn't a super admin is sent to Home.
 *
 * The weekly summary's day and time live here too (#139): one setting for
 * the club, with when the next one goes out.
 */
export default async function SlackSetupPage() {
  const user = await requireSlackSetupAccess();
  const [mode, setup, summary] = await Promise.all([
    getViewMode(user),
    listSlackSetup(user),
    getSummarySetup(user),
  ]);

  const rows: SlackLinkRow[] = setup.map((r) => ({
    userId: r.userId,
    name: r.preferredName || r.name || r.email,
    email: r.email,
    slackUserId: r.slackUserId,
  }));
  const unlinked = rows.filter((r) => !r.slackUserId).length;
  // A boolean only. The token itself never leaves the server.
  const botConfigured = Boolean(process.env.TASKS_SLACK_BOT_TOKEN);

  return (
    <AppShell viewer={user} mode={mode}>
      <PageHeader
        back={<BackLink href="/tasks" label="Back to Tasks" />}
        title="Slack setup"
        description="Who gets DMs from the FirstByte Tasks bot. Only the president, VP and website lead see this page."
      />
      <div className="flex max-w-4xl flex-col gap-5">
        {!botConfigured && (
          <p
            role="status"
            className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm"
          >
            The bot token (<code>TASKS_SLACK_BOT_TOKEN</code>) isn&apos;t set
            here, so no DMs go out yet. You can still link people.
          </p>
        )}
        <Section title="E-board Slack accounts" count={unlinked}>
          <p className="-mt-1 text-sm text-muted-foreground">
            Linked by hand. Nothing is matched by email. The IDs are for the
            workspace the bot is installed in, the FirstByte Slack Dev Sandbox
            for now. People who aren&apos;t linked show &ldquo;Not connected to
            Slack&rdquo; on the board and get no reminders.
          </p>
          <SlackLinksTable rows={rows} />
        </Section>
        <Section title="Weekly summary">
          <SummaryScheduleForm
            key={`${summary.schedule.day}-${summary.schedule.hour}`}
            {...summary}
          />
        </Section>
      </div>
    </AppShell>
  );
}
