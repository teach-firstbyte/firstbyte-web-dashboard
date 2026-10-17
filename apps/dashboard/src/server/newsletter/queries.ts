import {
  AccountStatus,
  MeetingType,
  NewsletterIssueStatus,
  TeamMemberStatus,
  TeamRole,
} from "@prisma/client";

import { isOfficer } from "@/lib/auth/roles";
import {
  homeCardCutoff,
  upcomingWindowEnd,
  weekOf,
} from "@/lib/newsletter/week";
import { prisma } from "@/server/db";
import { ServiceError } from "@/server/errors";
import type { Viewer } from "@/server/viewer";
import type { IssueView, UpcomingEvent } from "@/types/newsletter";
import { issueWithUpdatesArgs, toIssueView } from "./select";

/** This week's issue, or null if the draft job hasn't run this week. */
export async function getCurrentIssue(now: Date): Promise<IssueView | null> {
  const issue = await prisma.newsletterIssue.findUnique({
    where: { weekOf: weekOf(now) },
    ...issueWithUpdatesArgs,
  });
  return issue ? toIssueView(issue) : null;
}

/** Throws NOT_FOUND. */
export async function getIssue(issueId: number): Promise<IssueView> {
  const issue = await prisma.newsletterIssue.findUnique({
    where: { id: issueId },
    ...issueWithUpdatesArgs,
  });
  if (!issue) throw new ServiceError("NOT_FOUND", "Issue not found");
  return toIssueView(issue);
}

/**
 * Whether this viewer may read an issue. Sent issues are for every approved
 * member; anything not yet sent is for officers, final approvers, and the
 * leads of a team in it.
 */
export async function canViewIssue(
  viewer: Viewer,
  issue: IssueView,
): Promise<boolean> {
  if (issue.status === NewsletterIssueStatus.SENT) return true;
  if (isOfficer(viewer) || viewer.newsletterApprover) return true;
  const leads = await listLeadTeamIds(viewer.id);
  return issue.updates.some((u) => leads.includes(u.teamId));
}

/** Sent issues, newest first, for the archive. */
export async function listSentIssues(limit = 20) {
  return prisma.newsletterIssue.findMany({
    where: { status: NewsletterIssueStatus.SENT },
    orderBy: { sentAt: "desc" },
    take: limit,
    select: {
      id: true,
      weekOf: true,
      sentAt: true,
      _count: { select: { updates: { where: { status: "APPROVED" } } } },
    },
  });
}

/** Teams this person leads. APPROVED only, like every membership read. */
export async function listLeadTeamIds(userId: number): Promise<number[]> {
  const rows = await prisma.teamMember.findMany({
    where: {
      userId,
      role: TeamRole.LEAD,
      status: TeamMemberStatus.APPROVED,
    },
    select: { teamId: true },
  });
  return rows.map((r) => r.teamId);
}

/** Officers can edit any team's draft; a lead only their own team's. */
export async function canEditTeam(
  viewer: Viewer,
  teamId: number,
): Promise<boolean> {
  if (isOfficer(viewer)) return true;
  return (await listLeadTeamIds(viewer.id)).includes(teamId);
}

/**
 * "Coming up" in an issue: club-wide meetings in the next 14 days. Team-only
 * meetings and e-board meetings stay out, because the email goes to everyone.
 */
export async function listUpcomingForIssue(
  now: Date,
): Promise<UpcomingEvent[]> {
  const meetings = await prisma.meeting.findMany({
    where: {
      teamId: null,
      type: { not: MeetingType.EBOARD_MEETING },
      scheduledAt: { gte: now, lte: upcomingWindowEnd(now) },
    },
    orderBy: { scheduledAt: "asc" },
    select: {
      id: true,
      title: true,
      scheduledAt: true,
      location: true,
      isRequired: true,
      type: true,
    },
  });
  return meetings.map((m) => ({
    ...m,
    scheduledAt: m.scheduledAt.toISOString(),
  }));
}

/**
 * A team's meetings in the draft window, with how many came. Totals only:
 * who came is never passed to the AI.
 */
export async function listTeamMeetingsSince(teamId: number, since: Date) {
  const meetings = await prisma.meeting.findMany({
    where: { teamId, scheduledAt: { gte: since, lte: new Date() } },
    select: {
      id: true,
      title: true,
      scheduledAt: true,
      _count: { select: { attendance: { where: { status: "PRESENT" } } } },
    },
  });
  return meetings.map((m) => ({
    id: m.id,
    title: m.title,
    scheduledAt: m.scheduledAt,
    present: m._count.attendance,
  }));
}

/** Teams that get an update: active and OPEN. The e-board does not. */
export function listNewsletterTeams() {
  return prisma.team.findMany({
    where: { isActive: true, joinPolicy: "OPEN" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

/**
 * Lowercased names of everyone in the club, for the cleaning step: a Slack
 * mention of anyone not on this list becomes "someone".
 */
export async function memberNameSet(): Promise<Set<string>> {
  const users = await prisma.user.findMany({
    where: { status: AccountStatus.APPROVED },
    select: { name: true, preferredName: true },
  });
  return new Set(
    users
      .flatMap((u) => [u.name, u.preferredName])
      .filter((n): n is string => Boolean(n))
      .map((n) => n.trim().toLowerCase()),
  );
}

/** Who receives the email when sending to members is switched on. */
export function listNewsletterRecipients() {
  return prisma.user.findMany({
    where: { status: AccountStatus.APPROVED, newsletterOptOut: false },
    select: { email: true },
  });
}

/**
 * The newest sent issue this member hasn't opened or dismissed, if it went
 * out in the last two weeks. Drives the card on the member home.
 */
export async function getHomeCardIssue(viewer: Viewer, now: Date) {
  return prisma.newsletterIssue.findFirst({
    where: {
      status: NewsletterIssueStatus.SENT,
      sentAt: { gte: homeCardCutoff(now) },
      reads: {
        none: {
          userId: viewer.id,
          OR: [{ readAt: { not: null } }, { dismissedAt: { not: null } }],
        },
      },
    },
    orderBy: { sentAt: "desc" },
    select: {
      id: true,
      sentAt: true,
      updates: {
        where: { status: "APPROVED" },
        select: { team: { select: { name: true } } },
      },
    },
  });
}

/** How many members opened an issue, and from where. */
export async function countReads(issueId: number) {
  const rows = await prisma.newsletterRead.groupBy({
    by: ["via"],
    where: { issueId, readAt: { not: null } },
    _count: true,
  });
  const count = (via: string) => rows.find((r) => r.via === via)?._count ?? 0;
  return { email: count("email"), dashboard: count("dashboard") };
}

/** Officers, with whether each can give final approval. For super admins. */
export function listApproverCandidates() {
  return prisma.user.findMany({
    where: {
      status: AccountStatus.APPROVED,
      OR: [
        { role: { in: ["NORTHEASTERN_ADMIN", "SUPER_ADMIN"] } },
        { newsletterApprover: true },
      ],
    },
    select: {
      id: true,
      name: true,
      preferredName: true,
      email: true,
      newsletterApprover: true,
    },
    orderBy: { name: "asc" },
  });
}
