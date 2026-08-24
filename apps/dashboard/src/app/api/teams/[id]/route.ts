import { NextResponse } from "next/server";
import { requireOfficerApi } from "@/lib/auth/requireOfficerApi";
import { parseJsonBody, toErrorResponse } from "@/server/http";
import { deleteTeam, updateTeam } from "@/server/teams/mutations";
import { getTeamWithMembers } from "@/server/teams/queries";
import { updateTeamSchema } from "@/server/teams/schema";
import { requireId } from "@/server/validation";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Gets a single team with its approved members.
 */
export async function GET(request: Request, { params }: RouteContext) {
  const { error } = await requireOfficerApi();
  if (error) return error;

  try {
    const { id } = await params;
    const team = await getTeamWithMembers(requireId(id, "team"));
    return NextResponse.json(team, { status: 200 });
  } catch (e) {
    return toErrorResponse(e, "GET /api/teams/[id]", "Failed to get team");
  }
}

/**
 * Updates a team's name, description, and/or active status.
 */
export async function PUT(request: Request, { params }: RouteContext) {
  const { error } = await requireOfficerApi();
  if (error) return error;

  try {
    const { id } = await params;
    const input = await parseJsonBody(request, updateTeamSchema);
    const updated = await updateTeam(requireId(id, "team"), input);
    return NextResponse.json(updated, { status: 200 });
  } catch (e) {
    return toErrorResponse(e, "PUT /api/teams/[id]", "Failed to update team");
  }
}

/**
 * Deletes a team by id. Its team_member rows cascade.
 */
export async function DELETE(request: Request, { params }: RouteContext) {
  const { error } = await requireOfficerApi();
  if (error) return error;

  try {
    const { id } = await params;
    const team = await deleteTeam(requireId(id, "team"));
    return NextResponse.json(
      { message: "Team deleted successfully", team },
      { status: 200 },
    );
  } catch (e) {
    return toErrorResponse(
      e,
      "DELETE /api/teams/[id]",
      "Failed to delete team",
    );
  }
}
