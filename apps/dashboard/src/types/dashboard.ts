import type { MemberAttendanceKey } from "@/lib/attendance/member-status";

export interface User {
  id: number;
  email: string;
  name: string | null;
  role: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  teamMemberships: Array<{
    id: number;
    team: {
      id: number;
      name: string;
    };
    role: string;
    status: string;
  }>;
}

/**
 * A user in the officer review queue. Carries the onboarding answers the
 * officer needs to make a decision, which the plain User shape doesn't.
 */
export interface PendingUser {
  id: number;
  email: string;
  name: string | null;
  status: string;
  preferredName: string | null;
  pronouns: string | null;
  gradYear: number | null;
  major: string | null;
  submittedAt: Date | null;
  createdAt: Date;
  teamMemberships: Array<{
    id: number;
    status: string;
    team: {
      id: number;
      name: string;
      // The TeamJoinPolicy. Decides whether this row gets Approve/Reject
      // buttons, since only a super admin can decide an invite-only request.
      joinPolicy: string;
    };
  }>;
}

export interface Team {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
  // The TeamJoinPolicy: OPEN teams are what onboarding offers, INVITE_ONLY
  // teams are handed out by a super admin.
  joinPolicy: string;
  createdAt: Date;
  updatedAt: Date;
  members: Array<{
    user: {
      name: string | null;
      email: string;
      // The club-wide Role, not the team role below -- it drives the officer
      // badge on the roster. Already selected by the dashboard's team query,
      // which includes the whole user row.
      role: string;
    };
    // The TeamRole (LEAD / MEMBER) for this membership.
    role: string;
  }>;
}

export interface Meeting {
  id: number;
  title: string;
  description: string | null;
  type: string;
  teamId: number | null;
  scheduledAt: Date;
  location: string | null;
  isRequired: boolean;
  maxCapacity: number | null;
  // Set by Close attendance, by an officer or automatically. Null = still open.
  attendanceClosedAt: Date | null;
  createdAt: Date;
  // How many people the meeting is for right now: every approved member, or
  // the team's approved members. Worked out on each read, not stored.
  expectedCount: number;
  // Nullable, not optional: `include: { team: { select: { name: true } } }`
  // yields `{ name } | null` for a club-wide meeting, and `| undefined` is not
  // the same type. Making it optional is what let OfficerDashboard ship a query
  // with no team include at all, so the Team column rendered "N/A" for every
  // meeting including team ones.
  team: {
    name: string;
  } | null;
  // The real records only: Present, Excused or Absent. Nobody gets a record
  // just for being expected, so before a meeting this is mostly excuses.
  // A member reading their own meetings gets only their own row.
  attendance: Array<{
    id: number;
    userId: number;
    user: {
      name: string | null;
      email: string;
    };
    status: string;
    checkedInAt: Date | null;
    notes: string | null;
    // Who set the status. Equal to userId when the member did it themselves.
    markedById: number | null;
  }>;
}

export interface Attendance {
  id: number;
  userId: number;
  meetingId: number;
  status: string;
  checkedInAt: Date | null;
  notes: string | null;
  createdAt: Date;
  user: {
    name: string | null;
    email: string;
  };
  meeting: {
    title: string;
    scheduledAt: Date;
  };
}

export type RosterStatus = "PRESENT" | "EXCUSED" | "ABSENT";

/** One person on a meeting's officer roster, marked or not. */
export interface RosterRow {
  userId: number;
  name: string | null;
  email: string;
  // Null = not marked yet: no record.
  status: RosterStatus | null;
  checkedInAt: Date | null;
  // The reason a member gave when they excused themselves.
  notes: string | null;
  // The member set this themselves (QR check-in or "I can't make it").
  selfMarked: boolean;
  // False for a walk-in the meeting wasn't for.
  expected: boolean;
}

export interface MeetingRoster {
  closed: boolean;
  closedAt: Date | null;
  rows: RosterRow[];
}

export interface Feedback {
  id: number;
  meetingId: number;
  authorId: number | null;
  rating: number | null;
  comment: string | null;
  category: string | null;
  isAnonymous: boolean;
  createdAt: Date;
  meeting: {
    title: string;
    scheduledAt: Date;
  };
  author: {
    name: string | null;
    email: string | null;
  };
}

export interface MemberAttendanceRow {
  id: number;
  meetingId: number;
  displayStatus: MemberAttendanceKey;
  hasFeedback: boolean;
  meeting: {
    title: string;
    scheduledAt: Date;
  };
}

/**
 * One approved member as the CSV export reads them. Arrives as JSON from
 * GET /api/users/export, so the dates are ISO strings by then -- the export
 * only ever passes them to the date formatters, which take either.
 */
export interface MemberExportRecord {
  id: number;
  email: string;
  name: string | null;
  preferredName: string | null;
  pronouns: string | null;
  gradYear: number | null;
  major: string | null;
  // The club-wide Role, for the Officer column.
  role: string;
  createdAt: Date | string;
  teamMemberships: Array<{
    // The TeamRole (LEAD / MEMBER).
    role: string;
    joinedAt: Date | string;
    team: { id: number; name: string };
  }>;
}
