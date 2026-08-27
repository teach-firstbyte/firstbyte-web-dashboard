import { NextResponse } from "next/server";
import { requireOfficerApi } from "@/lib/auth/requireOfficerApi";
import { parseJsonBody, toErrorResponse } from "@/server/http";
import {
  deleteTeamMember,
  updateTeamMember,
} from "@/server/teamMembers/mutations";
import { getTeamMemberById } from "@/server/teamMembers/queries";
import { updateTeamMemberSchema } from "@/server/teamMembers/schema";
import { requireId } from "@/server/validation";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Gets a single membership with its user and team.
 */
export async function GET(request: Request, { params }: RouteContext) {
  const { error } = await requireOfficerApi();
  if (error) return error;

  try {
    const { id } = await params;
    const member = await getTeamMemberById(requireId(id, "team member"));
    return NextResponse.json(member, { status: 200 });
  } catch (e) {
    return toErrorResponse(
      e,
      "GET /api/team-members/[id]",
      "Failed to get team member",
    );
  }
}

/**
 * Decides a join request, or promotes a member to lead.
 */
export async function PATCH(request: Request, { params }: RouteContext) {
  const { user: officer, error } = await requireOfficerApi();
  if (error) return error;

  try {
    const { id } = await params;
    const input = await parseJsonBody(request, updateTeamMemberSchema);
    const updated = await updateTeamMember(
      officer,
      requireId(id, "team member"),
      input,
    );
    return NextResponse.json(updated, { status: 200 });
  } catch (e) {
    return toErrorResponse(
      e,
      "PATCH /api/team-members/[id]",
      "Failed to update team member",
    );
  }
}

/**
 * Removes a membership outright.
 */
export async function DELETE(request: Request, { params }: RouteContext) {
  const { user: officer, error } = await requireOfficerApi();
  if (error) return error;

  try {
    const { id } = await params;
    const teamMember = await deleteTeamMember(
      officer,
      requireId(id, "team member"),
    );
    return NextResponse.json(
      { message: "Team member deleted successfully", teamMember },
      { status: 200 },
    );
  } catch (e) {
    return toErrorResponse(
      e,
      "DELETE /api/team-members/[id]",
      "Failed to delete team member",
    );
  }
}
