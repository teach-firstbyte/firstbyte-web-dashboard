import { after, NextResponse } from "next/server";
import { requireSlackSetupApi } from "@/lib/auth/requireSlackSetupApi";
import { welcomeDmFor } from "@/lib/tasks/slack-welcome";
import { parseJsonBody, toErrorResponse } from "@/server/http";
import { slackLinkSchema } from "@/server/tasks/schema";
import { removeSlackLink, setSlackLink } from "@/server/tasks/slack-links";
import { sendWelcomeDm } from "@/server/tasks/slack-welcome";
import { requireId } from "@/server/validation";

type RouteContext = { params: Promise<{ userId: string }> };

/**
 * Links an e-board member to Slack, or changes their member ID. Super admins
 * only. Body: { slackUserId: "U07ABC1234" }.
 *
 * 400 for an ID that isn't one or a person who isn't on the e-board, 409 for
 * an ID already linked to someone else.
 *
 * A new link or a changed ID also sends that person the bot's welcome DM,
 * after the response (sendWelcomeDm). The answer's `welcomeDm` says what
 * happened about it: "sending", "no_bot_token" or "not_needed" (the same ID
 * again).
 */
export async function PUT(request: Request, { params }: RouteContext) {
  const { user, error } = await requireSlackSetupApi();
  if (error) return error;

  try {
    const { userId } = await params;
    const id = requireId(userId, "user");
    const { slackUserId } = await parseJsonBody(request, slackLinkSchema);
    const { previousSlackUserId, ...row } = await setSlackLink(
      user,
      id,
      slackUserId,
    );
    const welcomeDm = welcomeDmFor({
      before: previousSlackUserId,
      after: row.slackUserId,
      // A boolean only. The token itself never leaves the server.
      botConfigured: Boolean(process.env.TASKS_SLACK_BOT_TOKEN),
    });
    // Sent once the response has gone, so linking never waits on Slack. It
    // never throws, so a failed send can't touch the saved link.
    if (welcomeDm === "sending") after(() => sendWelcomeDm(id));
    return NextResponse.json({ ...row, welcomeDm }, { status: 200 });
  } catch (e) {
    return toErrorResponse(
      e,
      "PUT /api/tasks/slack/[userId]",
      "Failed to save the Slack link",
    );
  }
}

/** Unlinks someone. Super admins only. Not an error if they weren't linked. */
export async function DELETE(request: Request, { params }: RouteContext) {
  const { user, error } = await requireSlackSetupApi();
  if (error) return error;

  try {
    const { userId } = await params;
    await removeSlackLink(user, requireId(userId, "user"));
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return toErrorResponse(
      e,
      "DELETE /api/tasks/slack/[userId]",
      "Failed to remove the Slack link",
    );
  }
}
