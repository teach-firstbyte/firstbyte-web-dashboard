import {
  getAttendanceStats,
  getAttendanceStatsForViewer,
} from "@/server/attendance/queries";
import { listFeedbackForViewer } from "@/server/feedback/queries";
import { listMeetingsForViewer } from "@/server/meetings/queries";
import { listApprovedMemberships, listTeams } from "@/server/teams/queries";
import { listPendingUsers, listUsers } from "@/server/users/queries";
import type { Viewer } from "@/server/viewer";

/**
 * Everything the officer dashboard renders, in one round of parallel queries.
 *
 * The Promise.all stays inside the service rather than being split into six
 * awaits at the call site. Six sequential queries would make the slowest page
 * in the app six times slower, and that is exactly the kind of regression a
 * refactor introduces by accident.
 *
 * No try/catch here. A database failure must reach the page, which catches it
 * to raise its warning banner -- see the header of server/errors.ts.
 */
export async function getOfficerDashboard(viewer: Viewer, userSearch?: string) {
  const [users, pending, teams, meetings, attendance, feedback] =
    await Promise.all([
      listUsers(userSearch),
      listPendingUsers(),
      listTeams(),
      listMeetingsForViewer(viewer),
      getAttendanceStats(),
      listFeedbackForViewer(viewer),
    ]);

  return { users, pending, teams, meetings, attendance, feedback };
}

/**
 * Everything the member dashboard renders.
 *
 * Note it reuses listMeetingsForViewer rather than repeating the team-scoping
 * rule. That query used to be written out here as well as in
 * api/meetings/route.ts, with a comment in each saying the APPROVED filter was
 * load-bearing. One function now answers "which meetings may this person see"
 * for the page, the API, and the dashboard alike.
 */
export async function getMemberDashboard(viewer: Viewer) {
  const [memberships, meetings, attendance] = await Promise.all([
    listApprovedMemberships(viewer.id),
    listMeetingsForViewer(viewer),
    getAttendanceStatsForViewer(viewer),
  ]);

  return { memberships, meetings, attendance };
}
