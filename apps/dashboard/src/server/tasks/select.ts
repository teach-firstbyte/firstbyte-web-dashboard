import {
  AccountStatus,
  Prisma,
  TeamJoinPolicy,
  TeamMemberStatus,
  TeamRole,
} from "@prisma/client";

/**
 * "This person is on the e-board": an APPROVED membership of the EBOARD team,
 * on an APPROVED account.
 *
 * The EBOARD team is found by its join policy, not its name, for the reason
 * given on Team.joinPolicy in the schema: renaming the row must not change
 * who is on the board. It is the only INVITE_ONLY team. If a second one is
 * ever added, this is the one line to narrow.
 *
 * Read by three things that must agree: who can open Tasks (getTaskActor), who
 * can own a task (assertEligibleOwner), and which tasks need a new owner.
 */
export const EBOARD_MEMBERSHIP_WHERE = {
  status: TeamMemberStatus.APPROVED,
  team: { joinPolicy: TeamJoinPolicy.INVITE_ONLY },
} satisfies Prisma.TeamMemberWhereInput;

/** The same rule from the user's side, for filtering users. */
export const EBOARD_USER_WHERE = {
  status: AccountStatus.APPROVED,
  teamMemberships: { some: EBOARD_MEMBERSHIP_WHERE },
} satisfies Prisma.UserWhereInput;

const person = {
  id: true,
  name: true,
  preferredName: true,
} satisfies Prisma.UserSelect;

/**
 * One task row as the database gives it. queries.ts turns it into a TaskView.
 *
 * The owner carries their account status and at most one e-board membership,
 * which is all it takes to tell whether the task needs a new owner. Neither
 * leaves the server.
 */
export const taskRowArgs = Prisma.validator<Prisma.TaskDefaultArgs>()({
  select: {
    id: true,
    title: true,
    status: true,
    dueDate: true,
    notes: true,
    ownerId: true,
    createdById: true,
    teamId: true,
    meetingId: true,
    createdAt: true,
    updatedAt: true,
    owner: {
      select: {
        ...person,
        status: true,
        teamMemberships: {
          where: EBOARD_MEMBERSHIP_WHERE,
          select: { id: true },
          take: 1,
        },
      },
    },
    createdBy: { select: person },
    team: { select: { id: true, name: true } },
    meeting: { select: { id: true, title: true, scheduledAt: true } },
  },
});

export type TaskRow = Prisma.TaskGetPayload<typeof taskRowArgs>;

/** Someone who can be picked as a task's owner. */
export const taskOwnerOptionArgs = Prisma.validator<Prisma.UserDefaultArgs>()({
  select: person,
});

export type TaskOwnerOption = Prisma.UserGetPayload<typeof taskOwnerOptionArgs>;

/**
 * An owner as the owner pickers get it: the person, plus the ordinary teams
 * they lead (not the e-board itself). The pickers match "events" to the Events
 * lead with it, and label a new task with the owner's team.
 */
export const taskOwnerChoiceArgs = Prisma.validator<Prisma.UserDefaultArgs>()({
  select: {
    ...person,
    teamMemberships: {
      where: {
        role: TeamRole.LEAD,
        status: TeamMemberStatus.APPROVED,
        team: { joinPolicy: TeamJoinPolicy.OPEN, isActive: true },
      },
      select: { team: { select: { id: true, name: true } } },
      orderBy: { team: { name: "asc" } },
    },
  },
});

export type TaskOwnerChoiceRow = Prisma.UserGetPayload<
  typeof taskOwnerChoiceArgs
>;
