import { prisma } from "@/server/db";
import { isSuperAdmin } from "@/lib/auth/roles";
import { sendSlackDm, type SlackDmResult } from "@/lib/tasks/slack";
import { greetingName, welcomeMessage } from "@/lib/tasks/slack-welcome";
import { scheduleLabel } from "@/lib/tasks/weekly-summary";
import { tasksUrl, type SendDm } from "./reminders";
import { slackMemberIdForDm } from "./slack-links";
import { getSummarySchedule } from "./weekly-summary";

/**
 * Sends the FirstByte Tasks bot's hello DM to someone a super admin just
 * linked to Slack. The PUT /api/tasks/slack/<userId> route calls it with
 * Next's after(), once the response has gone, and only for a new link or a
 * changed member ID (welcomeDmFor), so linking never waits on Slack and a
 * re-save sends nothing.
 *
 * It's a DM to that one person, nothing else: no channel posts, and nothing
 * recorded. A failed send is logged and dropped (the link is already saved),
 * and it never throws. Resolves to what Slack said, or null when there was no
 * one to send to (unlinked again, or off the e-board, by the time it ran).
 */
export async function sendWelcomeDm(
  userId: number,
  options: { send?: SendDm } = {},
): Promise<SlackDmResult | null> {
  try {
    const memberId = await slackMemberIdForDm(userId);
    if (!memberId) return null;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, preferredName: true, role: true },
    });
    if (!user) return null;

    // Super admins get the weekly summary, so theirs says when it comes.
    const weeklySummary = isSuperAdmin(user)
      ? scheduleLabel(await getSummarySchedule())
      : null;
    const message = welcomeMessage({
      firstName: greetingName(user),
      weeklySummary,
      url: tasksUrl(),
    });

    const result = await (options.send ?? sendSlackDm)(memberId, message);
    if (!result.ok) {
      console.warn(
        `[tasks/slack] The welcome DM to user ${userId} wasn't sent: ${result.error}`,
      );
    }
    return result;
  } catch (error) {
    console.error(
      `[tasks/slack] Sending user ${userId}'s welcome DM failed`,
      error,
    );
    return null;
  }
}
