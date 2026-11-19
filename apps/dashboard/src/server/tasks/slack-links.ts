import { prisma } from "@/server/db";
import { ServiceError } from "@/server/errors";
import type { Viewer } from "@/server/viewer";
import { canManageSlackLinks } from "@/lib/auth/taskPolicy";
import {
  SLACK_MEMBER_ID_ERROR,
  normalizeSlackMemberId,
} from "@/lib/tasks/slack-member-id";
import { getTaskActor, isOnEboard } from "./queries";
import { EBOARD_USER_WHERE } from "./select";

/**
 * E-board members' Slack links, for DMs from the FirstByte Tasks bot.
 *
 * The only file that reads or writes slack_links.slack_user_id. Every
 * exported function but slackMemberIdForDm checks canManageSlackLinks (super
 * admins only) first, so a member ID never reaches anyone else. The board
 * gets a boolean instead (owner.slackConnected, from server/tasks/select.ts).
 */

const FORBIDDEN_MESSAGE =
  "Only the president, VP and website lead can manage Slack links.";

/** Throws FORBIDDEN unless the person is a super admin. */
async function assertSlackAdmin(viewer: Viewer): Promise<void> {
  if (!canManageSlackLinks(await getTaskActor(viewer))) {
    throw new ServiceError("FORBIDDEN", FORBIDDEN_MESSAGE);
  }
}

/** One row of the Slack setup page. */
export type SlackSetupRow = {
  userId: number;
  name: string | null;
  preferredName: string | null;
  email: string;
  /** Null until a super admin links them. */
  slackUserId: string | null;
};

/**
 * Every approved e-board member, linked or not, by name. Super admins only.
 *
 * Someone who left the e-board drops off this list. Their link stays in the
 * table until they're unlinked or their account goes, but
 * slackMemberIdForDm won't hand it out.
 */
export async function listSlackSetup(viewer: Viewer): Promise<SlackSetupRow[]> {
  await assertSlackAdmin(viewer);
  const users = await prisma.user.findMany({
    where: EBOARD_USER_WHERE,
    select: {
      id: true,
      name: true,
      preferredName: true,
      email: true,
      slackLink: { select: { slackUserId: true } },
    },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
  return users.map((u) => ({
    userId: u.id,
    name: u.name,
    preferredName: u.preferredName,
    email: u.email,
    slackUserId: u.slackLink?.slackUserId ?? null,
  }));
}

/**
 * Links an e-board member to a Slack member ID, or changes it. Super admins
 * only.
 *
 * - The ID is cleaned up (spaces, lower case, a leading "@") and checked with
 *   the same rule as the setup form. A bad one is INVALID, with a sentence
 *   saying where to find the real one.
 * - Only approved EBOARD members can be linked: anyone else is INVALID.
 * - One Slack account per person: an ID already linked to someone else is a
 *   CONFLICT that names them, so a mix-up can't send one person's reminders
 *   to another.
 */
export async function setSlackLink(
  viewer: Viewer,
  userId: number,
  rawSlackUserId: string,
): Promise<SlackSetupRow> {
  await assertSlackAdmin(viewer);

  const slackUserId = normalizeSlackMemberId(rawSlackUserId);
  if (!slackUserId) throw new ServiceError("INVALID", SLACK_MEMBER_ID_ERROR);

  if (!(await isOnEboard(userId))) {
    throw new ServiceError(
      "INVALID",
      "Only e-board members can be linked to Slack.",
    );
  }

  const taken = await prisma.slackLink.findUnique({
    where: { slackUserId },
    select: {
      userId: true,
      user: { select: { name: true, preferredName: true } },
    },
  });
  if (taken && taken.userId !== userId) {
    const who = taken.user.preferredName || taken.user.name || "someone else";
    throw new ServiceError(
      "CONFLICT",
      `${slackUserId} is already linked to ${who}. Unlink them first, or check the ID.`,
    );
  }

  const link = await prisma.slackLink.upsert({
    where: { userId },
    create: { userId, slackUserId, linkedById: viewer.id },
    update: { slackUserId, linkedById: viewer.id },
    select: {
      slackUserId: true,
      user: {
        select: { id: true, name: true, preferredName: true, email: true },
      },
    },
  });
  return {
    userId: link.user.id,
    name: link.user.name,
    preferredName: link.user.preferredName,
    email: link.user.email,
    slackUserId: link.slackUserId,
  };
}

/**
 * Removes someone's Slack link. Super admins only. They get no more DMs until
 * they're linked again. Unlinking someone who isn't linked is not an error.
 *
 * Works for anyone, on the e-board or not, so a stale link can always be
 * cleared.
 */
export async function removeSlackLink(
  viewer: Viewer,
  userId: number,
): Promise<void> {
  await assertSlackAdmin(viewer);
  await prisma.slackLink.deleteMany({ where: { userId } });
}

/**
 * The member ID to DM, or null when there's no one to send to: not linked,
 * or no longer an approved e-board member.
 *
 * For the reminder jobs (#138, #139), which run with no signed-in viewer.
 * Never call it from a route or page, and never send what it returns to a
 * browser.
 */
export async function slackMemberIdForDm(
  userId: number,
): Promise<string | null> {
  const user = await prisma.user.findFirst({
    where: { id: userId, ...EBOARD_USER_WHERE },
    select: { slackLink: { select: { slackUserId: true } } },
  });
  return user?.slackLink?.slackUserId ?? null;
}
