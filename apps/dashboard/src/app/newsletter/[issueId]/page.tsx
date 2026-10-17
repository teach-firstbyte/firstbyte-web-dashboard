import Link from "next/link";
import { notFound } from "next/navigation";

import { BackLink } from "@/components/BackLink";
import { PageHeader, RowList, Section } from "@/components/common/Section";
import { AppShell } from "@/components/layout/AppShell";
import { ApprovePanel } from "@/components/newsletter/ApprovePanel";
import { IssueBody } from "@/components/newsletter/IssueBody";
import { SendNowButton } from "@/components/newsletter/JobButtons";
import { MarkRead } from "@/components/newsletter/SmallActions";
import {
  IssueStatusBadge,
  UpdateStatusBadge,
} from "@/components/newsletter/StatusBadges";
import { Button } from "@/components/ui/button";
import { requireApprovedUser } from "@/lib/auth/requireApprovedUser";
import { isOfficer } from "@/lib/auth/roles";
import { getViewMode } from "@/lib/auth/viewMode";
import { formatShortDate } from "@/lib/format";
import {
  canRunJobsByHand,
  isNewsletterEnabled,
} from "@/lib/newsletter/enabled";
import { formatWeekOf } from "@/lib/newsletter/week";
import { ServiceError } from "@/server/errors";
import {
  canViewIssue,
  countReads,
  getIssue,
  listUpcomingForIssue,
} from "@/server/newsletter/queries";
import { parseId } from "@/server/validation";

export const maxDuration = 60;

/**
 * One issue. Members read sent issues here (the email's "Read it" link lands
 * here, tagged ?via=email). Before it's sent, officers, leads and final
 * approvers see it as a preview, and final approvers approve it here.
 */
export default async function IssuePage({
  params,
  searchParams,
}: {
  params: Promise<{ issueId: string }>;
  searchParams: Promise<{ via?: string }>;
}) {
  if (!isNewsletterEnabled()) notFound();
  const { issueId } = await params;
  const { via } = await searchParams;
  const id = parseId(issueId);
  if (id === null) notFound();

  const user = await requireApprovedUser(`/newsletter/${issueId}`);
  const issue = await getIssue(id).catch((e) => {
    if (e instanceof ServiceError) notFound();
    throw e;
  });
  if (!(await canViewIssue(user, issue))) notFound();

  const sent = issue.status === "SENT";
  const open = issue.status === "COLLECTING" || issue.status === "READY";
  const [upcoming, reads] = await Promise.all([
    listUpcomingForIssue(new Date()),
    sent && isOfficer(user) ? countReads(issue.id) : Promise.resolve(null),
  ]);
  const included = issue.updates.filter(
    (u) => u.status === "APPROVED" && u.lines.length > 0,
  );
  const draftsWaiting = issue.updates.filter(
    (u) => u.status === "DRAFT",
  ).length;

  return (
    <AppShell viewer={user} mode={await getViewMode(user)}>
      {sent && (
        <MarkRead
          issueId={issue.id}
          via={via === "email" ? "email" : "dashboard"}
        />
      )}
      <PageHeader
        back={<BackLink href="/newsletter" label="Newsletter" />}
        title="This week at FirstByte"
        description={
          sent && issue.sentAt
            ? `Week of ${formatWeekOf(issue.weekOf)} · sent ${formatShortDate(issue.sentAt)}`
            : `Week of ${formatWeekOf(issue.weekOf)} · preview of what members will see`
        }
        action={!sent && <IssueStatusBadge status={issue.status} />}
      />

      {!sent && (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <Section title="Teams">
            <RowList>
              {issue.updates.map((u) => (
                <li key={u.id} className="flex items-center gap-3 py-2.5">
                  <span className="min-w-0 flex-1 font-semibold">
                    {u.teamName}
                  </span>
                  <UpdateStatusBadge status={u.status} />
                  {open && (
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/newsletter/${issue.id}/teams/${u.teamId}`}>
                        Open
                      </Link>
                    </Button>
                  )}
                </li>
              ))}
            </RowList>
          </Section>
          <Section title="Final approval">
            {user.newsletterApprover &&
            (open || issue.status === "APPROVED") ? (
              <ApprovePanel
                issueId={issue.id}
                status={issue.status}
                note={issue.note}
                draftsWaiting={draftsWaiting}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                {issue.status === "APPROVED"
                  ? `Approved${issue.approvedByName ? ` by ${issue.approvedByName}` : ""}. It goes out at the next send.`
                  : issue.status === "NOT_SENT"
                    ? "This issue never got final approval, so it was not sent."
                    : "Waiting on the Brand and Marketing lead, the President or the VP."}
              </p>
            )}
            {issue.status === "APPROVED" &&
              isOfficer(user) &&
              canRunJobsByHand() && (
                <div className="border-t pt-3">
                  <SendNowButton issueId={issue.id} />
                </div>
              )}
          </Section>
        </div>
      )}

      <IssueBody upcoming={upcoming} updates={included} note={issue.note} />

      {reads && (
        <p className="text-sm text-muted-foreground">
          Sent to {issue.sentCount ?? 0}. Opened on the dashboard by{" "}
          {reads.email + reads.dashboard}: {reads.email} from the email,{" "}
          {reads.dashboard} from the dashboard.
        </p>
      )}
    </AppShell>
  );
}
