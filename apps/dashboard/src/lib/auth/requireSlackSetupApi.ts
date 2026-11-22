import { NextResponse } from "next/server";
import { getTaskActor } from "@/server/tasks/queries";
import type { Viewer } from "@/server/viewer";
import { requireUserApi } from "./requireUserApi";
import { canManageSlackLinks } from "./taskPolicy";

type SlackSetupApiResult =
  { user: Viewer; error: null } | { user: null; error: NextResponse };

/**
 * requireUserApi, plus: a super admin. Anyone else gets a 403 before the body
 * is read. The services in server/tasks/slack-links.ts and
 * server/tasks/weekly-summary.ts check the same rule again, so a route that
 * forgot this gate would still refuse.
 *
 * `forbiddenMessage` is the 403's error text, for the weekly summary's route.
 */
export async function requireSlackSetupApi(
  forbiddenMessage = "Only the president, VP and website lead can manage Slack links.",
): Promise<SlackSetupApiResult> {
  const { user, error } = await requireUserApi();
  if (error) return { user: null, error };

  if (!canManageSlackLinks(await getTaskActor(user))) {
    return {
      user: null,
      error: NextResponse.json({ error: forbiddenMessage }, { status: 403 }),
    };
  }
  return { user, error: null };
}
