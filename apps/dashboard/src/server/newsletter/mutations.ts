import {
  NewsletterIssueStatus,
  TeamUpdateStatus,
  type Prisma,
} from "@prisma/client";

import { isSuperAdmin } from "@/lib/auth/roles";
import { prisma } from "@/server/db";
import { ServiceError } from "@/server/errors";
import type { Viewer } from "@/server/viewer";
import type { UpdateLine } from "@/types/newsletter";
import { canEditTeam } from "./queries";
import type {
  ApproveIssueInput,
  DecideTeamUpdateInput,
  SaveTeamUpdateInput,
} from "./schema";
import { toIssueView, issueWithUpdatesArgs } from "./select";

/** Leads can change their part only while the issue is still being put together. */
const OPEN_STATUSES: NewsletterIssueStatus[] = [
  NewsletterIssueStatus.COLLECTING,
  NewsletterIssueStatus.READY,
];

async function getEditableUpdate(viewer: Viewer, updateId: number) {
  const update = await prisma.newsletterTeamUpdate.findUnique({
    where: { id: updateId },
    include: { issue: { select: { status: true } } },
  });
  if (!update) throw new ServiceError("NOT_FOUND", "Update not found");
  if (!(await canEditTeam(viewer, update.teamId))) {
    throw new ServiceError(
      "FORBIDDEN",
      "Only this team's lead or an officer can change its update",
    );
  }
  if (!OPEN_STATUSES.includes(update.issue.status)) {
    throw new ServiceError(
      "CONFLICT",
      "This issue already has final approval, so it can't be changed",
    );
  }
  return update;
}

/**
 * COLLECTING while any team is still a draft, READY once every team has
 * approved or skipped. READY is a signal for the final approver, not a gate.
 */
async function syncIssueStatus(tx: Prisma.TransactionClient, issueId: number) {
  const issue = await tx.newsletterIssue.findUniqueOrThrow({
    where: { id: issueId },
    select: { status: true, updates: { select: { status: true } } },
  });
  if (!OPEN_STATUSES.includes(issue.status)) return;
  const allDecided =
    issue.updates.length > 0 &&
    issue.updates.every((u) => u.status !== TeamUpdateStatus.DRAFT);
  const next = allDecided
    ? NewsletterIssueStatus.READY
    : NewsletterIssueStatus.COLLECTING;
  if (next !== issue.status) {
    await tx.newsletterIssue.update({
      where: { id: issueId },
      data: { status: next },
    });
  }
}

function linesFromJson(value: Prisma.JsonValue): UpdateLine[] {
  return Array.isArray(value) ? (value as unknown as UpdateLine[]) : [];
}

/**
 * Saves a lead's edit. Sources are copied from the AI's original lines by
 * index (see saveTeamUpdateSchema), never taken from the browser.
 */
export async function saveTeamUpdate(
  viewer: Viewer,
  input: SaveTeamUpdateInput,
) {
  const update = await getEditableUpdate(viewer, input.updateId);
  if (update.status !== TeamUpdateStatus.DRAFT) {
    throw new ServiceError("CONFLICT", "Reopen this update before editing it");
  }

  const original = linesFromJson(update.aiLines);
  const lines: UpdateLine[] = input.lines.map((l) => {
    const source = l.from === null ? undefined : original[l.from];
    return source
      ? { text: l.text, sources: source.sources, flagged: source.flagged }
      : { text: l.text, sources: [], flagged: false };
  });

  return prisma.newsletterTeamUpdate.update({
    where: { id: update.id },
    data: {
      lines: lines as unknown as Prisma.InputJsonValue,
      photo: input.photo,
    },
  });
}

/** Approve, skip, or reopen (back to DRAFT) one team's update. */
export async function decideTeamUpdate(
  viewer: Viewer,
  input: DecideTeamUpdateInput,
) {
  const update = await getEditableUpdate(viewer, input.updateId);

  if (
    input.decision === TeamUpdateStatus.APPROVED &&
    linesFromJson(update.lines).length === 0
  ) {
    throw new ServiceError(
      "INVALID",
      "Add at least one line, or skip this week instead",
    );
  }

  const reopening = input.decision === TeamUpdateStatus.DRAFT;
  await prisma.$transaction(async (tx) => {
    await tx.newsletterTeamUpdate.update({
      where: { id: update.id },
      data: {
        status: input.decision,
        decidedAt: reopening ? null : new Date(),
        decidedById: reopening ? null : viewer.id,
      },
    });
    await syncIssueStatus(tx, update.issueId);
  });
}

/**
 * Final approval. Only someone with newsletterApprover may give it, and the
 * issue needs at least one approved team update. Teams still in draft are
 * left out of this issue.
 */
export async function approveIssue(viewer: Viewer, input: ApproveIssueInput) {
  if (!viewer.newsletterApprover) {
    throw new ServiceError(
      "FORBIDDEN",
      "Only a final approver can approve the newsletter",
    );
  }
  const issue = await prisma.newsletterIssue.findUnique({
    where: { id: input.issueId },
    ...issueWithUpdatesArgs,
  });
  if (!issue) throw new ServiceError("NOT_FOUND", "Issue not found");
  if (!OPEN_STATUSES.includes(issue.status)) {
    throw new ServiceError("CONFLICT", "This issue can't be approved now");
  }
  if (!issue.updates.some((u) => u.status === TeamUpdateStatus.APPROVED)) {
    throw new ServiceError(
      "INVALID",
      "At least one team needs to approve its update first",
    );
  }

  const approved = await prisma.newsletterIssue.update({
    where: { id: issue.id },
    data: {
      status: NewsletterIssueStatus.APPROVED,
      approvedAt: new Date(),
      approvedById: viewer.id,
      note: input.note,
    },
    ...issueWithUpdatesArgs,
  });
  return toIssueView(approved);
}

/** Takes back final approval before the issue is sent. */
export async function withdrawApproval(viewer: Viewer, issueId: number) {
  if (!viewer.newsletterApprover) {
    throw new ServiceError(
      "FORBIDDEN",
      "Only a final approver can change the approval",
    );
  }
  const issue = await prisma.newsletterIssue.findUnique({
    where: { id: issueId },
    select: { status: true },
  });
  if (!issue) throw new ServiceError("NOT_FOUND", "Issue not found");
  if (issue.status !== NewsletterIssueStatus.APPROVED) {
    throw new ServiceError("CONFLICT", "This issue isn't waiting to send");
  }
  await prisma.$transaction(async (tx) => {
    await tx.newsletterIssue.update({
      where: { id: issueId },
      data: {
        status: NewsletterIssueStatus.COLLECTING,
        approvedAt: null,
        approvedById: null,
      },
    });
    await syncIssueStatus(tx, issueId);
  });
}

/**
 * Gives or takes away final approval rights. Super admins only, and never on
 * themselves: SUPER_ADMIN also covers the website lead, who must not be able
 * to make themselves an approver.
 */
export async function setNewsletterApprover(
  viewer: Viewer,
  userId: number,
  approver: boolean,
) {
  if (!isSuperAdmin(viewer)) {
    throw new ServiceError(
      "FORBIDDEN",
      "Only the president, VP or website lead can change approvers",
    );
  }
  if (userId === viewer.id) {
    throw new ServiceError(
      "FORBIDDEN",
      "You can't change your own approver setting. Ask another super admin.",
    );
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!user) throw new ServiceError("NOT_FOUND", "User not found");
  await prisma.user.update({
    where: { id: userId },
    data: { newsletterApprover: approver },
  });
}

/** A member opened a sent issue. `via` is "email" or "dashboard". */
export async function recordRead(
  viewer: Viewer,
  issueId: number,
  via: "email" | "dashboard",
) {
  const now = new Date();
  await prisma.newsletterRead.upsert({
    where: { userId_issueId: { userId: viewer.id, issueId } },
    create: { userId: viewer.id, issueId, via, readAt: now },
    update: {},
  });
  // The row may exist from dismissing the home card. The first open still
  // counts; later opens don't change it, so re-reading from the dashboard
  // after clicking the email stays an email click.
  await prisma.newsletterRead.updateMany({
    where: { userId: viewer.id, issueId, readAt: null },
    data: { via, readAt: now },
  });
}

/** Hides the home page card for this issue without opening it. */
export async function dismissHomeCard(viewer: Viewer, issueId: number) {
  await prisma.newsletterRead.upsert({
    where: { userId_issueId: { userId: viewer.id, issueId } },
    create: { userId: viewer.id, issueId, dismissedAt: new Date() },
    update: { dismissedAt: new Date() },
  });
}

/** Unsubscribe or resubscribe. Account emails are not affected. */
export async function setNewsletterOptOut(viewer: Viewer, optOut: boolean) {
  await prisma.user.update({
    where: { id: viewer.id },
    data: { newsletterOptOut: optOut },
  });
}

/**
 * Deletes an issue and every team's part of it. For trying the flow again on
 * a preview; the caller checks canRunJobsByHand().
 */
export async function deleteIssue(issueId: number) {
  await prisma.newsletterIssue.delete({ where: { id: issueId } });
}
