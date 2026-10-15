import {
  getAttendanceStatsForViewer,
  listMembersMissingMeetings,
  listRecentAttendanceForViewer,
} from "@/server/attendance/queries";
import { listFeedbackForViewer } from "@/server/feedback/queries";
import { listMeetingsForViewer } from "@/server/meetings/queries";
import { listApprovedMemberships } from "@/server/teams/queries";
import { countApprovedUsers, listPendingUsers } from "@/server/users/queries";
import type { Viewer } from "@/server/viewer";

/**
 * Everything the officer home renders, in one round of parallel queries.
 *
 * The Promise.all stays inside the service rather than being split into
 * awaits at the call site. Sequential queries would make the busiest page in
 * the app several times slower, and that is exactly the kind of regression a
 * refactor introduces by accident.
 *
 * The full Users and Teams tables are not here any more: they moved to their
 * own pages (/members, /teams), which load their own data. Home only needs
 * how many members there are.
 *
 * No try/catch here. A database failure must reach the page, which catches it
 * to raise its warning banner -- see the header of server/errors.ts.
 */
export async function getOfficerDashboard(viewer: Viewer) {
  const [pending, meetings, feedback, memberCount, missing] = await Promise.all(
    [
      listPendingUsers(),
      listMeetingsForViewer(viewer),
      listFeedbackForViewer(viewer),
      countApprovedUsers(),
      listMembersMissingMeetings(),
    ],
  );

  return { pending, meetings, feedback, memberCount, missing };
}

/**
 * Everything the member home renders.
 *
 * Note it reuses listMeetingsForViewer rather than repeating the team-scoping
 * rule. One function answers "which meetings may this person see" for the
 * page, the API, and the dashboard alike.
 */
export async function getMemberDashboard(viewer: Viewer) {
  const [memberships, meetings, attendance, recent] = await Promise.all([
    listApprovedMemberships(viewer.id),
    listMeetingsForViewer(viewer),
    getAttendanceStatsForViewer(viewer),
    listRecentAttendanceForViewer(viewer),
  ]);

  return { memberships, meetings, attendance, recent };
}
