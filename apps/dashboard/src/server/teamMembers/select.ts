import { Prisma } from "@prisma/client";

/** A membership with enough of its user and team to identify both. */
export const teamMemberWithContextArgs =
  Prisma.validator<Prisma.TeamMemberDefaultArgs>()({
    select: {
      id: true,
      userId: true,
      teamId: true,
      role: true,
      status: true,
      decidedAt: true,
      decidedById: true,
      // Named joinedAt, not createdAt, and it reads as "requested at" while
      // the row is still PENDING.
      joinedAt: true,
      user: { select: { name: true, email: true } },
      // joinPolicy, not just name: updateTeamMember and deleteTeamMember
      // authorize against it, and selecting it here means neither needs a
      // second query to find out whether the team is invite-only.
      team: { select: { name: true, joinPolicy: true } },
    },
  });

export type TeamMemberWithContext = Prisma.TeamMemberGetPayload<
  typeof teamMemberWithContextArgs
>;
