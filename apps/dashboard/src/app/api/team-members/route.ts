import { NextResponse } from "next/server";
import { requireOfficerApi } from "@/lib/auth/requireOfficerApi";
import { parseJsonBody, toErrorResponse } from "@/server/http";
import { assignTeamMember } from "@/server/teamMembers/mutations";
import { listTeamMembers } from "@/server/teamMembers/queries";
import { assignTeamMemberSchema } from "@/server/teamMembers/schema";

/**
 * Gets every membership, in any state.
 */
export async function GET(): Promise<NextResponse> {
  const { error } = await requireOfficerApi();
  if (error) return error;

  try {
    return NextResponse.json(await listTeamMembers(), { status: 200 });
  } catch (e) {
    return toErrorResponse(
      e,
      "GET /api/team-members",
      "Failed to get team members",
    );
  }
}

/**
 * Puts a user on a team.
 *
 * 201 for a membership that did not exist, 200 when an existing pending or
 * rejected request was approved instead -- the same distinction the old
 * handler drew, now decided by the service.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const { user: officer, error } = await requireOfficerApi();
  if (error) return error;

  try {
    const input = await parseJsonBody(request, assignTeamMemberSchema);
    const { membership, created } = await assignTeamMember(officer, input);
    return NextResponse.json(membership, { status: created ? 201 : 200 });
  } catch (e) {
    return toErrorResponse(
      e,
      "POST /api/team-members",
      "Failed to create team member",
    );
  }
}
