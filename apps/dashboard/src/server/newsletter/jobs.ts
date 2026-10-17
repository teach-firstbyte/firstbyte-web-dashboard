import {
  NewsletterIssueStatus,
  TeamUpdateStatus,
  type Prisma,
} from "@prisma/client";

import { formatShortDate } from "@/lib/format";
import { writeDraft } from "@/lib/newsletter/draft";
import { sendIssueEmails, type EmailIssue } from "@/lib/newsletter/email";
import { mayEmailMembers, testRecipients } from "@/lib/newsletter/enabled";
import { mergedPullRequests } from "@/lib/newsletter/github";
import {
  addCounts,
  checkLines,
  cleanText,
  isAboutOnePerson,
  keepSwitchedOn,
  toCountList,
  type CollectedItem,
} from "@/lib/newsletter/safeguards";
import { sampleMessagesForTeam } from "@/lib/newsletter/sampleSlack";
import { sourcesForTeam } from "@/lib/newsletter/sources";
import { draftWindowStart, weekOf } from "@/lib/newsletter/week";
import { prisma } from "@/server/db";
import { ServiceError } from "@/server/errors";
import type { DraftChecks } from "@/types/newsletter";
import {
  listNewsletterRecipients,
  listNewsletterTeams,
  listTeamMeetingsSince,
  listUpcomingForIssue,
  memberNameSet,
} from "./queries";
import { issueWithUpdatesArgs, toIssueView } from "./select";

const json = (v: unknown) => v as Prisma.InputJsonValue;

/**
 * Steps 1 and 2 for one team: collect what is switched on, then clean it.
 * Returns the items the AI may see and what the safeguards removed.
 */
async function collectForTeam(
  team: { id: number; name: string },
  since: Date,
  memberNames: ReadonlySet<string>,
) {
  const sources = sourcesForTeam(team.name);
  const items: CollectedItem[] = [];
  const removed: Record<string, number> = {};
  const dropped: Record<string, number> = {};
  const notes: string[] = [];

  // GitHub: real, read-only.
  for (const repo of sources.github) {
    const pulls = await mergedPullRequests(repo, since);
    if (pulls === null) {
      notes.push(`GitHub (${repo}) couldn't be reached`);
      continue;
    }
    for (const pr of pulls) {
      const cleaned = cleanText(pr.text, memberNames);
      addCounts(removed, cleaned.removed);
      items.push({ ...pr, text: cleaned.text });
    }
  }

  // Slack: sample messages in the prototype, through the same safeguards the
  // real messages will go through.
  const { kept, privateSkipped } = keepSwitchedOn(
    sampleMessagesForTeam(team.name),
    sources.slack,
  );
  for (const m of kept) {
    if (isAboutOnePerson(m.text)) {
      dropped["about one person's grades or attendance"] =
        (dropped["about one person's grades or attendance"] ?? 0) + 1;
      continue;
    }
    const cleaned = cleanText(m.text, memberNames);
    addCounts(removed, cleaned.removed);
    items.push({
      id: m.id,
      kind: "slack",
      label: `${m.channel} (sample)`,
      text: cleaned.text,
      finished: false,
    });
  }

  // The dashboard's own meetings: totals only, never who came.
  for (const m of await listTeamMeetingsSince(team.id, since)) {
    items.push({
      id: `meeting-${m.id}`,
      kind: "meeting",
      label: `${m.title}, ${formatShortDate(m.scheduledAt)}`,
      text: `Held "${m.title}" on ${formatShortDate(m.scheduledAt)}; ${m.present} people came.`,
      finished: true,
    });
  }

  return { items, removed, dropped, privateSkipped, notes };
}

export type DraftJobResult = {
  issueId: number;
  drafted: number;
  kept: number;
  failed: string[];
};

/**
 * The weekly draft job. Makes this week's issue if there isn't one, and writes
 * a fresh AI draft for every team whose update is still a draft. A team that
 * already approved or skipped is left alone, so running it again is safe.
 *
 * Also closes out older weeks that never got final approval: they become
 * NOT_SENT and will never go out.
 */
export async function runDraftJob(now: Date): Promise<DraftJobResult> {
  const week = weekOf(now);

  await prisma.newsletterIssue.updateMany({
    where: {
      weekOf: { lt: week },
      status: {
        in: [
          NewsletterIssueStatus.COLLECTING,
          NewsletterIssueStatus.READY,
          NewsletterIssueStatus.APPROVED,
        ],
      },
    },
    data: { status: NewsletterIssueStatus.NOT_SENT },
  });

  const issue = await prisma.newsletterIssue.upsert({
    where: { weekOf: week },
    create: { weekOf: week },
    update: {},
    include: { updates: { select: { teamId: true, status: true } } },
  });
  if (
    issue.status !== NewsletterIssueStatus.COLLECTING &&
    issue.status !== NewsletterIssueStatus.READY
  ) {
    throw new ServiceError(
      "CONFLICT",
      "This week's issue already has final approval, so drafts can't change",
    );
  }

  const decided = new Set(
    issue.updates
      .filter((u) => u.status !== TeamUpdateStatus.DRAFT)
      .map((u) => u.teamId),
  );
  const teams = (await listNewsletterTeams()).filter((t) => !decided.has(t.id));
  const memberNames = await memberNameSet();
  const since = draftWindowStart(now);

  // All teams at once: the AI calls are the slow part, and they don't depend
  // on each other.
  const results = await Promise.all(
    teams.map(async (team) => {
      const collected = await collectForTeam(team, since, memberNames);
      const draft = await writeDraft(team.name, collected.items);
      const checked = draft.ok
        ? checkLines(draft.lines, collected.items, memberNames)
        : null;
      if (checked) addCounts(collected.removed, checked.removed);

      const checks: DraftChecks = {
        privateSkipped: collected.privateSkipped,
        redactions: toCountList(collected.removed),
        messagesDropped: toCountList(collected.dropped),
        ...(checked?.checks ?? {}),
        ...(draft.ok ? { model: draft.model } : {}),
      };
      const lines = checked?.lines ?? [];
      const aiError = draft.ok
        ? collected.notes.join(". ") || null
        : [draft.error, ...collected.notes].join(" ");

      await prisma.newsletterTeamUpdate.upsert({
        where: { issueId_teamId: { issueId: issue.id, teamId: team.id } },
        create: {
          issueId: issue.id,
          teamId: team.id,
          lines: json(lines),
          aiLines: json(lines),
          checks: json(checks),
          aiError,
        },
        update: {
          status: TeamUpdateStatus.DRAFT,
          lines: json(lines),
          aiLines: json(lines),
          checks: json(checks),
          aiError,
          decidedAt: null,
          decidedById: null,
        },
      });
      return { team: team.name, ok: draft.ok, kept: lines.length };
    }),
  );

  // A fresh draft means not every team has decided any more.
  if (teams.length > 0 && issue.status === NewsletterIssueStatus.READY) {
    await prisma.newsletterIssue.update({
      where: { id: issue.id },
      data: { status: NewsletterIssueStatus.COLLECTING },
    });
  }

  return {
    issueId: issue.id,
    drafted: results.length,
    kept: results.reduce((n, r) => n + r.kept, 0),
    failed: results.filter((r) => !r.ok).map((r) => r.team),
  };
}

export type SendJobResult = {
  sent: number;
  failed: string[];
  toMembers: boolean;
};

/**
 * Sends an issue. It must have final approval and not have been sent yet --
 * this check is the gate that keeps anything unapproved from going out.
 *
 * Who it goes to: approved, subscribed members only where mayEmailMembers()
 * allows it (production, switched on). Everywhere else, only the
 * NEWSLETTER_TEST_RECIPIENTS list.
 *
 * "Coming up" is worked out now, at send time, so a late send never lists
 * meetings that already happened.
 */
export async function sendIssue(
  issueId: number,
  origin: string,
  now: Date,
): Promise<SendJobResult> {
  const issue = await prisma.newsletterIssue.findUnique({
    where: { id: issueId },
    ...issueWithUpdatesArgs,
  });
  if (!issue) throw new ServiceError("NOT_FOUND", "Issue not found");
  if (issue.status !== NewsletterIssueStatus.APPROVED) {
    throw new ServiceError(
      "CONFLICT",
      issue.status === NewsletterIssueStatus.SENT
        ? "This issue was already sent"
        : "This issue needs final approval before it can send",
    );
  }

  const toMembers = mayEmailMembers();
  const recipients = toMembers
    ? (await listNewsletterRecipients()).map((u) => u.email)
    : testRecipients();
  if (recipients.length === 0) {
    throw new ServiceError(
      "INVALID",
      toMembers
        ? "No subscribed members to send to"
        : "No test recipients. Set NEWSLETTER_TEST_RECIPIENTS in Vercel.",
    );
  }

  const view = toIssueView(issue);
  const emailIssue: EmailIssue = {
    id: issue.id,
    weekOf: issue.weekOf,
    note: issue.note,
    upcoming: await listUpcomingForIssue(now),
    teams: view.updates
      .filter((u) => u.status === TeamUpdateStatus.APPROVED && u.lines.length)
      .map((u) => ({ name: u.teamName, lines: u.lines, photo: u.photo })),
  };
  const base = `${origin}/dashboard`;
  const result = await sendIssueEmails(emailIssue, recipients, {
    issue: `${base}/newsletter/${issue.id}?via=email`,
    meetings: `${base}/meetings`,
    unsubscribe: `${base}/newsletter/unsubscribe`,
  });

  if ("error" in result) throw new ServiceError("INVALID", result.error);
  if (result.sent === 0) {
    throw new ServiceError(
      "CONFLICT",
      "No email could be sent. Check the Resend settings and try again.",
    );
  }

  await prisma.newsletterIssue.update({
    where: { id: issue.id },
    data: {
      status: NewsletterIssueStatus.SENT,
      sentAt: new Date(),
      sentCount: result.sent,
    },
  });
  return { sent: result.sent, failed: result.failed, toMembers };
}
