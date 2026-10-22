import { notFound } from "next/navigation";

import { BackLink } from "@/components/BackLink";
import { PageHeader, Section } from "@/components/common/Section";
import { AppShell } from "@/components/layout/AppShell";
import { SafeguardSummary } from "@/components/newsletter/SafeguardSummary";
import { UpdateStatusBadge } from "@/components/newsletter/StatusBadges";
import { UpdateEditor } from "@/components/newsletter/UpdateEditor";
import { Banner } from "@/components/ui/banner";
import { requireApprovedUser } from "@/lib/auth/requireApprovedUser";
import { getViewMode } from "@/lib/auth/viewMode";
import { isNewsletterEnabled } from "@/lib/newsletter/enabled";
import { samplePhotoOptions } from "@/lib/newsletter/photos";
import { sourcesForTeam } from "@/lib/newsletter/sources";
import { formatWeekOf } from "@/lib/newsletter/week";
import { ServiceError } from "@/server/errors";
import { canEditTeam, getIssue } from "@/server/newsletter/queries";
import { parseId } from "@/server/validation";

/** A team lead's review of their team's AI draft. */
export default async function TeamUpdatePage({
  params,
}: {
  params: Promise<{ issueId: string; teamId: string }>;
}) {
  if (!isNewsletterEnabled()) notFound();
  const { issueId, teamId } = await params;
  const iid = parseId(issueId);
  const tid = parseId(teamId);
  if (iid === null || tid === null) notFound();

  const user = await requireApprovedUser(
    `/newsletter/${issueId}/teams/${teamId}`,
  );
  if (!(await canEditTeam(user, tid))) notFound();

  const issue = await getIssue(iid).catch((e) => {
    if (e instanceof ServiceError) notFound();
    throw e;
  });
  const update = issue.updates.find((u) => u.teamId === tid);
  if (!update) notFound();

  const editable = issue.status === "COLLECTING" || issue.status === "READY";
  const sources = sourcesForTeam(update.teamName);

  return (
    <AppShell viewer={user} mode={await getViewMode(user)}>
      <PageHeader
        back={<BackLink href="/newsletter" label="Newsletter" />}
        title={`${update.teamName}: update for the week of ${formatWeekOf(issue.weekOf)}`}
        description="The AI drafted this from this week's activity. Fix anything that's off, then approve it."
        action={<UpdateStatusBadge status={update.status} />}
      />

      {update.aiError && <Banner variant="warning">{update.aiError}</Banner>}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Section title="Draft">
          <UpdateEditor
            update={update}
            editable={editable}
            photos={samplePhotoOptions()}
          />
        </Section>

        <div className="flex min-w-0 flex-col gap-5">
          <Section title="Where this came from">
            <ul className="flex flex-col gap-2 text-sm">
              {sources.github.map((r) => (
                <li key={r}>
                  <span className="font-semibold">GitHub</span> · merged pull
                  requests in {r}, read-only{" "}
                  <span className="text-muted-foreground">
                    (sample pull requests in the prototype)
                  </span>
                </li>
              ))}
              {sources.slack.map((c) => (
                <li key={c}>
                  <span className="font-semibold">Slack</span> · {c}{" "}
                  <span className="text-muted-foreground">
                    (sample messages in the prototype)
                  </span>
                </li>
              ))}
              <li>
                <span className="font-semibold">Dashboard</span> · this
                team&apos;s meetings and how many came (totals only, from the
                test data on previews)
              </li>
            </ul>
            <p className="text-xs text-muted-foreground">
              Every line shows which of these it came from.
            </p>
          </Section>
          <Section title="Safeguards">
            <SafeguardSummary checks={update.checks} />
          </Section>
        </div>
      </div>
    </AppShell>
  );
}
