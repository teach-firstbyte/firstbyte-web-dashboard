import { AccountStatus, Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { isOfficer, OFFICER_ROLES } from "@/lib/auth/roles";
import { ServiceError } from "@/server/errors";
import type { Viewer } from "@/server/viewer";
import {
  memberExportArgs,
  pendingUserArgs,
  userWithTeamsArgs,
  type MemberExportPayload,
  type PendingUserPayload,
  type UserWithTeams,
} from "./select";

/**
 * Which user a request is allowed to act on.
 *
 * An officer may name anyone. Everybody else is redirected to themselves,
 * whatever id they put in the URL -- so /api/users/999 as a member edits your
 * own row rather than someone else's, and returns your own data rather than
 * confirming that user 999 exists.
 *
 * This rule was written out twice in api/users/[id]/route.ts, once in GET and
 * once in PUT, as `isOfficer(user) ? pathId : user.id`. A third handler added
 * later would have had to remember it.
 */
export function targetIdFor(viewer: Viewer, pathId: number): number {
  return isOfficer(viewer) ? pathId : viewer.id;
}

/** Columns the Users table may sort by. */
export const USER_SORT_FIELDS = ["name", "email", "createdAt"] as const;
export type UserSortField = (typeof USER_SORT_FIELDS)[number];
export type SortDirection = "asc" | "desc";

/**
 * The officer roster: approved accounts only.
 *
 * Accounts still in the review queue (ONBOARDING/PENDING) or DENIED are
 * handled by the separate approval queue (listPendingUsers) and shouldn't
 * show up here until an officer approves them.
 *
 * `search`, when given, matches a name or email substring, case-insensitive.
 * `sort`/`dir` pick the column and direction; both default to name ascending.
 * `sort` is only ever one of USER_SORT_FIELDS, so it is safe to build the
 * Prisma `orderBy` from it directly.
 */
export function listUsers(
  search?: string,
  sort: UserSortField = "name",
  dir: SortDirection = "asc",
): Promise<UserWithTeams[]> {
  const where: Prisma.UserWhereInput = {
    status: AccountStatus.APPROVED,
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const orderBy: Prisma.UserOrderByWithRelationInput[] = [
    { [sort]: dir },
    { id: "asc" },
  ];

  return prisma.user.findMany({
    where,
    ...userWithTeamsArgs,
    orderBy,
  });
}

/** How many approved accounts there are. For the officer home's numbers row. */
export function countApprovedUsers(): Promise<number> {
  return prisma.user.count({ where: { status: AccountStatus.APPROVED } });
}

/**
 * Every approved member with the fields the roster export can write, for an
 * officer.
 *
 * All members rather than one team: the export dialog lets the officer switch
 * between teams and "everyone" without a round trip per choice, and the team
 * filter is a membership lookup the browser can do on rows it already has.
 * Nothing here is new to an officer -- the Members page and the approval panel
 * already show every field.
 *
 * The route is officer-only as well. This checks again because the service is
 * what a future caller will reach for, and the export holds more about each
 * person than any single screen does.
 */
export function listMembersForExport(
  viewer: Viewer,
): Promise<MemberExportPayload[]> {
  if (!isOfficer(viewer)) {
    throw new ServiceError("FORBIDDEN", "Only officers can export members");
  }

  return prisma.user.findMany({
    ...memberExportArgs,
    where: { status: AccountStatus.APPROVED },
    orderBy: [{ name: "asc" }, { email: "asc" }],
  });
}

/** The review queue: accounts waiting on, or already refused by, an officer. */
export function listPendingUsers(): Promise<PendingUserPayload[]> {
  return prisma.user.findMany({
    ...pendingUserArgs,
    where: { status: { in: [AccountStatus.PENDING, AccountStatus.DENIED] } },
    orderBy: { submittedAt: "asc" },
  });
}

/** One user with their approved teams. Throws NOT_FOUND. */
export async function getUserWithTeams(userId: number): Promise<UserWithTeams> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    ...userWithTeamsArgs,
  });

  if (!user) throw new ServiceError("NOT_FOUND", "User not found");
  return user;
}

/** The bare row. Throws NOT_FOUND. For writes that need the current values. */
export async function getUserById(userId: number) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new ServiceError("NOT_FOUND", "User not found");
  return user;
}

/**
 * Would this change leave the club with no approved officer?
 *
 * Denying or requeueing the last one makes the review queue permanently
 * unworkable: nobody is left who can approve anyone, including the person who
 * could undo it. Counting excludes the target, since they are the one changing.
 */
export async function isLastApprovedOfficer(userId: number): Promise<boolean> {
  const remaining = await prisma.user.count({
    where: {
      role: { in: OFFICER_ROLES },
      status: AccountStatus.APPROVED,
      id: { not: userId },
    },
  });

  return remaining === 0;
}

/**
 * The account for a Supabase-verified email, or null.
 *
 * Supabase auth.users and Prisma public.users are joined by email only -- there
 * is no FK and no supabase_uid column -- so "has a session" and "has a row" are
 * genuinely independent states. Callers in lib/auth/ tell them apart; this
 * function only answers the second half.
 */
export function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}
