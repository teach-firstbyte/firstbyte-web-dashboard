import Link from "next/link";
import { notFound } from "next/navigation";

import {
  EmptyState,
  PageHeader,
  RowList,
  Section,
} from "@/components/common/Section";
import { AppShell } from "@/components/layout/AppShell";
import {
  DeleteIssueButton,
  RunDraftJobButton,
  SendNowButton,
} from "@/components/newsletter/JobButtons";
import { ApproverSwitch } from "@/components/newsletter/SmallActions";
import {
  IssueStatusBadge,
  UpdateStatusBadge,
} from "@/components/newsletter/StatusBadges";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { requireApprovedUser } from "@/lib/auth/requireApprovedUser";
import { isOfficer, isSuperAdmin } from "@/lib/auth/roles";
import { getViewMode } from "@/lib/auth/viewMode";
import { formatShortDate } from "@/lib/format";
import {
  canRunJobsByHand,
  isNewsletterEnabled,
  mayEmailMembers,
  testRecipients,
} from "@/lib/newsletter/enabled";
import { formatWeekOf } from "@/lib/newsletter/week";
import {
  getCurrentIssue,
  listApproverCandidates,
  listLeadTeamIds,
  listSentIssues,
} from "@/server/newsletter/queries";
import type { IssueView } from "@/types/newsletter";

// The draft job runs from this page on previews, and the AI calls for every
// team run in parallel. 60 seconds is the most every Vercel plan allows, and
// five drafts at once fit well inside it.
export const maxDuration = 60;

type Approver = Awaited<ReturnType<typeof listApproverCandidates>>[number];

/**
 * The newsletter hub. Everyone sees past issues. Team leads see their team's
 * draft for this week, officers see every team's status, final approvers get
 * the approval link, and super admins choose who the final approvers are.
 */
export default async function NewsletterPage() {
  const user = await requireApprovedUser("/newsletter");
  if (!isNewsletterEnabled()) notFound();
  const officer = isOfficer(user);

  let current: IssueView | null = null;
  let sent: Awaited<ReturnType<typeof listSentIssues>> = [];
  let leadTeamIds: number[] = [];
  let approvers: Approver[] = [];
  let dbUnavailable = false;
  try {
    [current, sent, leadTeamIds, approvers] = await Promise.all([
      getCurrentIssue(new Date()),
      listSentIssues(),
      listLeadTeamIds(user.id),
      isSuperAdmin(user) ? listApproverCandidates() : Promise.resolve([]),
    ]);
  } catch (error) {
    dbUnavailable = true;
    console.error("Newsletter query failed:", error);
  }

  const staff = officer || user.newsletterApprover || leadTeamIds.length > 0;
  const myUpdates =
    current?.updates.filter((u) => officer || leadTeamIds.includes(u.teamId)) ??
    [];
  const byHand = officer && canRunJobsByHand();
  const draftsWaiting =
    current?.updates.filter((u) => u.status === "DRAFT").length ?? 0;
  const recipients = testRecipients();

  return (
    <AppShell viewer={user} mode={await getViewMode(user)}>
      {dbUnavailable && (
        <Banner variant="warning">
          Could not load the newsletter right now. Showing an empty page until
          the connection is restored.
        </Banner>
      )}
      {byHand && (
        <Banner variant="success">
          <strong>Prototype.</strong> Everything the AI reads is sample data:
          made-up Slack messages and pull requests, and the test meetings.
          Emails go only to{" "}
          {mayEmailMembers()
            ? "members"
            : recipients.length
              ? recipients.join(", ")
              : "nobody yet (set NEWSLETTER_TEST_RECIPIENTS)"}
          .
        </Banner>
      )}

      <PageHeader
        title="Newsletter"
        description="This week at FirstByte: what's coming up and what each team is working on."
        action={
          <Button asChild variant="link" size="sm" className="h-auto p-0">
            <Link href="/newsletter/sources">What the AI can see →</Link>
          </Button>
        }
      />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          {staff && (
            <Section
              title={
                current
                  ? `This week's issue · week of ${formatWeekOf(current.weekOf)}`
                  : "This week's issue"
              }
              action={current && <IssueStatusBadge status={current.status} />}
            >
              {!current ? (
                <EmptyState title="No drafts yet this week">
                  {byHand
                    ? "Run the draft job to have the AI write each team's first draft."
                    : "Drafts appear here when the weekly draft job runs."}
                </EmptyState>
              ) : (
                <>
                  <RowList>
                    {myUpdates.map((u) => (
                      <li
                        key={u.id}
                        className="flex flex-wrap items-center gap-3 py-2.5"
                      >
                        <span className="min-w-0 flex-1 font-semibold">
                          {u.teamName}
                          {u.aiError && (
                            <span className="block text-xs font-normal text-warning-foreground">
                              {u.aiError}
                            </span>
                          )}
                        </span>
                        <UpdateStatusBadge status={u.status} />
                        <Button asChild variant="outline" size="sm">
                          <Link
                            href={`/newsletter/${current.id}/teams/${u.teamId}`}
                          >
                            {u.status === "DRAFT" ? "Review" : "Open"}
                          </Link>
                        </Button>
                      </li>
                    ))}
                  </RowList>
                  {!officer && myUpdates.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      None of your teams have a draft this week.
                    </p>
                  )}
                  {(officer || user.newsletterApprover) && (
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                      <p className="text-sm text-muted-foreground">
                        {draftsWaiting > 0
                          ? `${draftsWaiting} team${draftsWaiting === 1 ? "" : "s"} still editing.`
                          : "Every team has approved or skipped."}
                      </p>
                      <Button asChild size="sm">
                        <Link href={`/newsletter/${current.id}`}>
                          {user.newsletterApprover &&
                          (current.status === "COLLECTING" ||
                            current.status === "READY")
                            ? "Preview and approve"
                            : "Preview issue"}
                        </Link>
                      </Button>
                    </div>
                  )}
                </>
              )}
              {byHand && (
                <div className="flex flex-wrap gap-2 border-t pt-3">
                  {(!current ||
                    current.status === "COLLECTING" ||
                    current.status === "READY") && (
                    <RunDraftJobButton
                      label={
                        current ? "Redraft open teams" : "Run draft job now"
                      }
                    />
                  )}
                  {current?.status === "APPROVED" && (
                    <SendNowButton issueId={current.id} />
                  )}
                  {current && <DeleteIssueButton issueId={current.id} />}
                </div>
              )}
            </Section>
          )}

          <Section title="Past issues">
            {sent.length === 0 ? (
              <EmptyState title="No issues yet">
                Sent issues show up here.
              </EmptyState>
            ) : (
              <RowList>
                {sent.map((i) => (
                  <li key={i.id} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">
                        Week of {formatWeekOf(i.weekOf)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {i.sentAt ? `Sent ${formatShortDate(i.sentAt)} · ` : ""}
                        {i._count.updates} team update
                        {i._count.updates === 1 ? "" : "s"}
                      </p>
                    </div>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/newsletter/${i.id}`}>Read</Link>
                    </Button>
                  </li>
                ))}
              </RowList>
            )}
          </Section>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <Section title="How it works">
            <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm">
              <li>
                Monday, the AI drafts each team&apos;s update from that
                week&apos;s GitHub, Slack and meetings.
              </li>
              <li>Each team lead edits it, then approves or skips the week.</li>
              <li>
                The Brand and Marketing lead, the President or the VP gives
                final approval.
              </li>
              <li>
                Thursday, it&apos;s emailed to members and shows on the
                dashboard.
              </li>
            </ol>
            <p className="text-sm text-muted-foreground">
              Nothing goes out without that final approval.{" "}
              <Link
                href="/newsletter/unsubscribe"
                className="text-primary hover:underline"
              >
                Email settings
              </Link>
            </p>
          </Section>

          {isSuperAdmin(user) && (
            <Section title="Final approvers">
              <p className="text-sm text-muted-foreground">
                Who can give an issue final approval. You can&apos;t change your
                own setting.
              </p>
              <RowList>
                {approvers.map((a) => {
                  const name = a.preferredName || a.name || a.email;
                  return (
                    <li key={a.id} className="flex items-center gap-3 py-2.5">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">
                          {name}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {a.email}
                        </span>
                      </span>
                      <ApproverSwitch
                        userId={a.id}
                        name={name}
                        approver={a.newsletterApprover}
                        isSelf={a.id === user.id}
                      />
                    </li>
                  );
                })}
              </RowList>
            </Section>
          )}
        </div>
      </div>
    </AppShell>
  );
}
