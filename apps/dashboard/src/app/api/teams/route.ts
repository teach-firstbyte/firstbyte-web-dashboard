import { NextResponse } from "next/server";
import { requireOfficerApi } from "@/lib/auth/requireOfficerApi";
import { parseJsonBody, toErrorResponse } from "@/server/http";
import { createTeam } from "@/server/teams/mutations";
import { listTeams } from "@/server/teams/queries";
import { createTeamSchema } from "@/server/teams/schema";

/**
 * Gets every team with its approved roster.
 */
export async function GET(): Promise<NextResponse> {
  const { error } = await requireOfficerApi();
  if (error) return error;

  try {
    return NextResponse.json(await listTeams(), { status: 200 });
  } catch (e) {
    return toErrorResponse(e, "GET /api/teams", "Failed to get teams");
  }
}

/**
 * Creates a new team.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const { error } = await requireOfficerApi();
  if (error) return error;

  try {
    const input = await parseJsonBody(request, createTeamSchema);
    return NextResponse.json(await createTeam(input), { status: 201 });
  } catch (e) {
    return toErrorResponse(e, "POST /api/teams", "Failed to create team");
  }
}
