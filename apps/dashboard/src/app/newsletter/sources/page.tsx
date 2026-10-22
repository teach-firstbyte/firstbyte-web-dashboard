import { notFound } from "next/navigation";
import { Ban, Eye } from "lucide-react";

import { BackLink } from "@/components/BackLink";
import { PageHeader, RowList, Section } from "@/components/common/Section";
import { AppShell } from "@/components/layout/AppShell";
import { requireApprovedUser } from "@/lib/auth/requireApprovedUser";
import { getViewMode } from "@/lib/auth/viewMode";
import { isNewsletterEnabled } from "@/lib/newsletter/enabled";
import { SOURCES_ARE_SAMPLE, sourcesForTeam } from "@/lib/newsletter/sources";
import { listNewsletterTeams } from "@/server/newsletter/queries";

/**
 * "What the AI can see": everything the draft job is allowed to read, per
 * team, and what it can never read. Open to every member, because the people
 * whose messages are summarized should be able to check.
 */
export default async function NewsletterSourcesPage() {
  const user = await requireApprovedUser("/newsletter/sources");
  if (!isNewsletterEnabled()) notFound();
  const teams = await listNewsletterTeams();

  return (
    <AppShell viewer={user} mode={await getViewMode(user)}>
      <PageHeader
        back={<BackLink href="/newsletter" label="Newsletter" />}
        title="What the AI can see"
        description="Everything the newsletter's AI is allowed to read, team by team. If it isn't listed here, the AI can't read it."
      />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Section title="Switched on, by team">
          <RowList>
            {teams.map((t) => {
              const s = sourcesForTeam(t.name);
              return (
                <li key={t.id} className="flex flex-col gap-1.5 py-3">
                  <p className="font-semibold">{t.name}</p>
                  <ul className="flex flex-col gap-1 text-sm">
                    {s.github.map((r) => (
                      <li key={r}>
                        GitHub: merged pull requests in <code>{r}</code>
                        <span className="text-muted-foreground">
                          {" "}
                          · read-only
                          {SOURCES_ARE_SAMPLE &&
                            ", sample pull requests for now"}
                        </span>
                      </li>
                    ))}
                    {s.slack.map((c) => (
                      <li key={c}>
                        Slack: {c}
                        {SOURCES_ARE_SAMPLE && (
                          <span className="text-muted-foreground">
                            {" "}
                            · sample messages for now
                          </span>
                        )}
                      </li>
                    ))}
                    <li>
                      Dashboard: this team&apos;s meetings and how many came
                      <span className="text-muted-foreground">
                        {" "}
                        · totals only
                      </span>
                    </li>
                  </ul>
                </li>
              );
            })}
          </RowList>
        </Section>

        <div className="flex min-w-0 flex-col gap-5">
          <Section title="Never">
            <ul className="flex flex-col gap-2 text-sm">
              {[
                "Direct messages and private Slack channels",
                "Any channel or repo not listed here",
                "Photos (leads pick photos themselves)",
                "Who came to a meeting, or anyone's grades",
                "Phone numbers, emails and Google Docs links (removed before the AI sees anything)",
              ].map((t) => (
                <li key={t} className="flex gap-2">
                  <Ban
                    className="mt-0.5 size-4 shrink-0 text-destructive"
                    aria-hidden="true"
                  />
                  {t}
                </li>
              ))}
            </ul>
          </Section>
          <Section title="And before anything is sent">
            <ul className="flex flex-col gap-2 text-sm">
              {[
                "Every line has to point to a real pull request, message or meeting. Lines that don't are deleted by plain code, not by the AI.",
                "The team lead reads, edits and approves their team's part.",
                "The Brand and Marketing lead, the President or the VP gives final approval.",
                "Slack messages are read to write the draft and are not stored.",
              ].map((t) => (
                <li key={t} className="flex gap-2">
                  <Eye
                    className="mt-0.5 size-4 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  {t}
                </li>
              ))}
            </ul>
          </Section>
        </div>
      </div>
    </AppShell>
  );
}
