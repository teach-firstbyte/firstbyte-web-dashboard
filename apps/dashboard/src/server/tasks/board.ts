import { MeetingType, TeamJoinPolicy } from "@prisma/client";
import { prisma } from "@/server/db";
import type { Viewer } from "@/server/viewer";
import { ownerRole } from "@/lib/tasks/owners";
import {
  assertTaskAccess,
  clubToday,
  listTaskOwnerOptions,
  listTasks,
  type TaskOwnerChoice,
  type TaskView,
} from "./queries";

/**
 * An e-board member as the board's group headers and owner picker show them:
 * the person, their Slack status, and the teams they lead.
 */
export type BoardOwner = TaskOwnerChoice & {
  /** "Events lead", or "E-board" when they lead no team. */
  subtitle: string;
};

/** A team a task can be labelled with. */
export type BoardTeam = { id: number; name: string };

/** An e-board meeting a task can link to. */
export type BoardMeeting = {
  id: number;
  title: string;
  scheduledAt: Date;
};

export type TaskBoardData = {
  tasks: TaskView[];
  owners: BoardOwner[];
  teams: BoardTeam[];
  meetings: BoardMeeting[];
  /** Today in Boston, "YYYY-MM-DD", so the browser counts days the same way. */
  today: string;
};

// The meeting picker offers the latest few. A task linked to an older one
// still shows it: the panel adds the task's own meeting to the list.
const MEETING_OPTIONS = 12;
// Meetings already scheduled months out would push the recent ones off the
// list, so it looks no further ahead than two weeks.
const UPCOMING_MS = 14 * 86_400_000;

/**
 * Everything the Tasks board renders, in one call: every task (Done
 * included, so "Show done" needs no reload), the e-board for the group
 * headers and owner picker, and the team and meeting options.
 */
export async function getTaskBoard(viewer: Viewer): Promise<TaskBoardData> {
  await assertTaskAccess(viewer);

  // Owners come with the teams they lead, for the "Events lead" line.
  const [tasks, owners, teams, meetings] = await Promise.all([
    listTasks(viewer, { includeDone: true }),
    listTaskOwnerOptions(viewer),
    // The e-board team itself isn't a label: every task is e-board work.
    prisma.team.findMany({
      where: { isActive: true, joinPolicy: TeamJoinPolicy.OPEN },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.meeting.findMany({
      where: {
        type: MeetingType.EBOARD_MEETING,
        scheduledAt: { lte: new Date(Date.now() + UPCOMING_MS) },
      },
      select: { id: true, title: true, scheduledAt: true },
      orderBy: { scheduledAt: "desc" },
      take: MEETING_OPTIONS,
    }),
  ]);

  return {
    tasks,
    owners: owners.map((o) => ({ ...o, subtitle: ownerRole(o) })),
    teams,
    meetings,
    today: clubToday(),
  };
}
