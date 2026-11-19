import { NextResponse } from "next/server";
import { requireSlackSetupApi } from "@/lib/auth/requireSlackSetupApi";
import { parseJsonBody, toErrorResponse } from "@/server/http";
import { slackLinkSchema } from "@/server/tasks/schema";
import { removeSlackLink, setSlackLink } from "@/server/tasks/slack-links";
import { requireId } from "@/server/validation";

type RouteContext = { params: Promise<{ userId: string }> };

/**
 * Links an e-board member to Slack, or changes their member ID. Super admins
 * only. Body: { slackUserId: "U07ABC1234" }.
 *
 * 400 for an ID that isn't one or a person who isn't on the e-board, 409 for
 * an ID already linked to someone else.
 */
export async function PUT(request: Request, { params }: RouteContext) {
  const { user, error } = await requireSlackSetupApi();
  if (error) return error;

  try {
    const { userId } = await params;
    const id = requireId(userId, "user");
    const { slackUserId } = await parseJsonBody(request, slackLinkSchema);
    const row = await setSlackLink(user, id, slackUserId);
    return NextResponse.json(row, { status: 200 });
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
