import { Prisma, TeamMemberStatus } from "@prisma/client";

/**
 * A user with the teams they are actually on.
 *
 * APPROVED memberships only, and that filter is the rule: a join request an
 * officer has not decided is not a membership. The review queue reads pending
 * requests through pendingUserArgs below, which deliberately does not filter.
 */
export const userWithTeamsArgs = Prisma.validator<Prisma.UserDefaultArgs>()({
  select: {
    id: true,
    email: true,
    name: true,
    role: true,
    status: true,
    createdAt: true,
    updatedAt: true,
    teamMemberships: {
      where: { status: TeamMemberStatus.APPROVED },
      select: {
        id: true,
        role: true,
        status: true,
        team: { select: { id: true, name: true } },
      },
      orderBy: { team: { name: "asc" } },
    },
  },
});

export type UserWithTeams = Prisma.UserGetPayload<typeof userWithTeamsArgs>;

/**
 * A user in the officer review queue, with the onboarding answers an officer
 * needs to decide.
 *
 * Every membership, not just approved ones -- the whole point of this shape is
 * showing which teams the person asked to join so each request can be decided.
 */
export const pendingUserArgs = Prisma.validator<Prisma.UserDefaultArgs>()({
  select: {
    id: true,
    email: true,
    name: true,
    status: true,
    preferredName: true,
    pronouns: true,
    gradYear: true,
    major: true,
    submittedAt: true,
    createdAt: true,
    teamMemberships: {
      select: {
        id: true,
        status: true,
        team: { select: { id: true, name: true } },
      },
      // Ordered so the badges on a queue row do not shuffle between renders.
      // The old query had none, so the order was whatever Postgres returned.
      orderBy: { team: { name: "asc" } },
    },
  },
});

export type PendingUserPayload = Prisma.UserGetPayload<typeof pendingUserArgs>;
