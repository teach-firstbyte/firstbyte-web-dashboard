import { Prisma, TeamJoinPolicy, TeamMemberStatus } from "@prisma/client";

/**
 * A team with its roster.
 *
 * APPROVED memberships only. An un-decided join request belongs to the review
 * queue, not to the team -- showing it here would make a team look larger than
 * it is and imply a decision nobody made.
 *
 * `user.role` is the club-wide Role, not the team role beside it. The roster
 * uses it to draw the officer badge, which is why the two sit together and are
 * easy to confuse.
 */
export const teamWithMembersArgs = Prisma.validator<Prisma.TeamDefaultArgs>()({
  select: {
    id: true,
    name: true,
    description: true,
    isActive: true,
    joinPolicy: true,
    createdAt: true,
    updatedAt: true,
    members: {
      where: { status: TeamMemberStatus.APPROVED },
      select: {
        id: true,
        role: true,
        user: { select: { name: true, email: true, role: true } },
      },
    },
  },
});

export type TeamWithMembers = Prisma.TeamGetPayload<typeof teamWithMembersArgs>;

/**
 * "A team a member may ask to join."
 *
 * Read by listActiveTeams (what the onboarding form SHOWS) and by
 * saveOnboarding (what that form is allowed to SUBMIT). Those two are a pair,
 * which is why the clause is here and not written out twice: if they ever
 * disagree, either a team renders as a checkbox that cannot be submitted, or a
 * team hidden from the form is joinable by anyone who crafts the POST.
 */
export const JOINABLE_TEAM_WHERE = Prisma.validator<Prisma.TeamWhereInput>()({
  isActive: true,
  joinPolicy: TeamJoinPolicy.OPEN,
});
