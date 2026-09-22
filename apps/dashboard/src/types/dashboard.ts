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
  startedAt: Date | null;
  endedAt: Date | null;
  location: string | null;
  isRequired: boolean;
  maxCapacity: number | null;
  createdAt: Date;
  // Nullable, not optional: `include: { team: { select: { name: true } } }`
  // yields `{ name } | null` for a club-wide meeting, and `| undefined` is not
  // the same type. Making it optional is what let OfficerDashboard ship a query
  // with no team include at all, so the Team column rendered "N/A" for every
  // meeting including team ones.
  team: {
    name: string;
  } | null;
  // The dashboard's Prisma query already selects whole Attendance rows, so the
  // check-in/out timestamps and notes come along for free -- the detail panel's
  // roster reads them from here rather than issuing its own query.
  attendance: Array<{
    id: number;
    user: {
      name: string | null;
      email: string;
    };
    status: string;
    checkedInAt: Date | null;
    checkedOutAt: Date | null;
    notes: string | null;
  }>;
}

export interface Attendance {
  id: number;
  userId: number;
  meetingId: number;
  status: string;
  checkedInAt: Date | null;
  checkedOutAt: Date | null;
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
