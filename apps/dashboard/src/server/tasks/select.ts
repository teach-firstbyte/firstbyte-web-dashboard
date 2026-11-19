import {
  AccountStatus,
  Prisma,
  TaskReminderStatus,
  TeamJoinPolicy,
  TeamMemberStatus,
  TeamRole,
} from "@prisma/client";
import { UNDELIVERED_LOOKBACK } from "@/lib/tasks/reminders";

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
 * Whether someone has a Slack link, without the member ID. Selecting only the
 * link's userId (their own id) means the ID can't reach the board by mistake:
 * only server/tasks/slack-links.ts reads slackUserId.
 */
const SLACK_CONNECTED_SELECT = {
  select: { userId: true },
} satisfies Prisma.User$slackLinkArgs;

/**
 * One task row as the database gives it. queries.ts turns it into a TaskView.
 *
 * The owner carries their account status and at most one e-board membership,
 * which is all it takes to tell whether the task needs a new owner, and
 * whether they're linked to Slack. None of that leaves the server as it is:
 * queries.ts turns it into booleans, as it does the latest reminder's status.
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
        slackLink: SLACK_CONNECTED_SELECT,
      },
    },
    createdBy: { select: person },
    team: { select: { id: true, name: true } },
    meeting: { select: { id: true, title: true, scheduledAt: true } },
    // The latest reminders that finished trying, sent or given up on, for
    // "Reminder not delivered". queries.ts turns them into a boolean.
    reminders: {
      where: {
        status: { in: [TaskReminderStatus.SENT, TaskReminderStatus.FAILED] },
      },
      orderBy: [{ finishedAt: "desc" }, { id: "desc" }],
      select: { status: true, recipientId: true },
      take: UNDELIVERED_LOOKBACK,
    },
  },
});

export type TaskRow = Prisma.TaskGetPayload<typeof taskRowArgs>;

/** Someone who can be picked as a task's owner, as the database gives it. */
export const taskOwnerOptionArgs = Prisma.validator<Prisma.UserDefaultArgs>()({
  select: { ...person, slackLink: SLACK_CONNECTED_SELECT },
});

export type TaskOwnerOptionRow = Prisma.UserGetPayload<
  typeof taskOwnerOptionArgs
>;

/**
 * A task's owner, or someone who can be picked as one, as readers get it.
 *
 * `slackConnected` is false until a super admin links their Slack account on
 * /tasks/slack. The board shows "Not connected to Slack" next to them, and
 * they get no reminders. The member ID itself is never here.
 */
export type TaskOwnerOption = Prisma.UserGetPayload<{
  select: typeof person;
}> & {
  slackConnected: boolean;
};

/** Drops the link row and keeps the boolean. */
export function toTaskOwnerOption({
  slackLink,
  ...rest
}: TaskOwnerOptionRow): TaskOwnerOption {
  return { ...rest, slackConnected: slackLink !== null };
}

/**
 * An owner as the owner pickers get it: the person, whether they're linked to
 * Slack, plus the ordinary teams they lead (not the e-board itself). The
 * pickers match "events" to the Events lead with it, and label a new task with
 * the owner's team.
 */
export const taskOwnerChoiceArgs = Prisma.validator<Prisma.UserDefaultArgs>()({
  select: {
    ...person,
    slackLink: SLACK_CONNECTED_SELECT,
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
