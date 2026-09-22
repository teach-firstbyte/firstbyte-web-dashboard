import { prisma } from "@/server/db";
import type { Viewer } from "@/server/viewer";
import { assertCanEditTeam, assertCanSetJoinPolicy } from "./policy";
import { getTeamById } from "./queries";
import type { CreateTeamInput, UpdateTeamInput } from "./schema";

export function createTeam(input: CreateTeamInput) {
  return prisma.team.create({ data: input });
}

/**
 * Two checks, because there are two teams involved: the one being edited and the
 * one it would become. The first alone already stops a regular officer
 * un-restricting an invite-only team -- that edit is refused before joinPolicy
 * is read -- so the second is for the other direction, and so nobody has to work
 * out which check covers which case.
 */
export async function updateTeam(
  officer: Viewer,
  teamId: number,
  input: UpdateTeamInput,
) {
  const team = await getTeamById(teamId);
  assertCanEditTeam(officer, team);
  if (input.joinPolicy !== undefined) assertCanSetJoinPolicy(officer);

  return prisma.team.update({ where: { id: teamId }, data: input });
}

/**
 * Deletes a team. Its team_member rows cascade; its meetings do not.
 *
 * Gated for the same reason as deleteTeamMember, only more so: because the
 * memberships cascade, deleting an invite-only team is a strict superset of
 * removing everyone from it. No UI calls this today, which is exactly why the
 * guard is easy to leave off and the omission would be hard to notice.
 */
export async function deleteTeam(officer: Viewer, teamId: number) {
  const team = await getTeamById(teamId);
  assertCanEditTeam(officer, team);

  await prisma.team.delete({ where: { id: teamId } });
  return team;
}
