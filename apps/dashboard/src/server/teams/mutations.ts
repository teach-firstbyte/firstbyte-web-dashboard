import { prisma } from "@/lib/prisma";
import { getTeamById } from "./queries";
import type { CreateTeamInput, UpdateTeamInput } from "./schema";

export function createTeam(input: CreateTeamInput) {
  return prisma.team.create({ data: input });
}

export async function updateTeam(teamId: number, input: UpdateTeamInput) {
  await getTeamById(teamId);
  return prisma.team.update({ where: { id: teamId }, data: input });
}

/** Deletes a team. Its team_member rows cascade; its meetings do not. */
export async function deleteTeam(teamId: number) {
  const team = await getTeamById(teamId);
  await prisma.team.delete({ where: { id: teamId } });
  return team;
}
