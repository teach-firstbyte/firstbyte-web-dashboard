import { NextResponse } from "next/server";
import { getTaskActor } from "@/server/tasks/queries";
import type { Viewer } from "@/server/viewer";
import { requireUserApi } from "./requireUserApi";
import { canManageSlackLinks } from "./taskPolicy";

type SlackSetupApiResult =
  { user: Viewer; error: null } | { user: null; error: NextResponse };

/**
 * requireUserApi, plus: a super admin. Anyone else gets a 403 before the body
 * is read. The services in server/tasks/slack-links.ts check the same rule
 * again, so a route that forgot this gate would still refuse.
 */
export async function requireSlackSetupApi(): Promise<SlackSetupApiResult> {
  const { user, error } = await requireUserApi();
  if (error) return { user: null, error };

  if (!canManageSlackLinks(await getTaskActor(user))) {
    return {
      user: null,
      error: NextResponse.json(
        {
          error:
            "Only the president, VP and website lead can manage Slack links.",
        },
        { status: 403 },
      ),
    };
  }
  return { user, error: null };
}
