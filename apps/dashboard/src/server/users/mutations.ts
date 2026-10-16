import { AccountStatus, Role } from "@prisma/client";
import { prisma } from "@/server/db";
import { canDeleteAccount } from "@/lib/auth/accountPolicy";
import { isOfficer } from "@/lib/auth/roles";
import { ServiceError } from "@/server/errors";
import type { Viewer } from "@/server/viewer";
import { approvePendingMemberships } from "@/server/teamMembers/mutations";
import { getUserById, isLastApprovedOfficer } from "./queries";
import type {
  CreateUserInput,
  DeleteAccountInput,
  UpdateProfileInput,
  UpdateUserInput,
} from "./schema";

/**
 * The email column is unique. Checking first turns a P2002 into a sentence the
 * officer can act on.
 */
async function assertEmailFree(email: string, exceptUserId?: number) {
  const owner = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (owner && owner.id !== exceptUserId) {
    throw new ServiceError(
      "CONFLICT",
      exceptUserId === undefined
        ? "User already exists"
        : "A user with that email already exists",
    );
  }
}

export async function createUser(input: CreateUserInput) {
  await assertEmailFree(input.email);
  return prisma.user.create({ data: input });
}

/** Updates a user's name and/or email. The caller decides who the target is. */
export async function updateUser(userId: number, input: UpdateUserInput) {
  const existing = await getUserById(userId);

  if (input.email !== undefined && input.email !== existing.email) {
    await assertEmailFree(input.email, userId);
  }

  return prisma.user.update({ where: { id: userId }, data: input });
}

/** What a deleted account shows wherever its name used to be. */
export const FORMER_MEMBER_NAME = "Former member";

/**
 * Turns an account into an anonymous "Former member". Both ways to delete an
 * account end here: deleteOwnAccount and deleteAccountAsOfficer.
 *
 * Not a real delete. Attendance and feedback rows cascade with the user (see
 * prisma/schema.prisma), so removing the row would change past numbers: a
 * meeting with 30 of 40 present could later read 27 of 36. Instead the row
 * stays and only what is about the person goes:
 *
 *   personal fields   cleared; the email becomes a placeholder, so the real
 *                     one is free for a new sign-up
 *   team memberships  deleted, pending requests included
 *   future meetings   attendance rows deleted, so they leave those rosters
 *   past meetings     attendance and feedback kept, now on the anonymous row
 *
 * Status DELETED keeps the row out of every list that filters on APPROVED:
 * Members, rosters for new meetings, missed meetings, the member count.
 *
 * This does not remove the Supabase login -- a service has no admin client.
 * The caller does that after this returns.
 *
 * Not exported: it checks nothing. The two functions below are where the
 * rules about who may delete whom live.
 */
async function anonymizeAccount(userId: number) {
  const now = new Date();

  await prisma.$transaction([
    prisma.teamMember.deleteMany({ where: { userId } }),
    prisma.attendance.deleteMany({
      where: { userId, meeting: { scheduledAt: { gt: now } } },
    }),
    prisma.user.update({
      where: { id: userId },
      data: {
        status: AccountStatus.DELETED,
        deletedAt: now,
        // The .invalid top-level domain is reserved, so this can never be a
        // real address that someone signs up with.
        email: `deleted-${userId}@deleted.invalid`,
        name: FORMER_MEMBER_NAME,
        preferredName: null,
        pronouns: null,
        gradYear: null,
        major: null,
        // An anonymous row should not keep officer rights.
        role: Role.NORTHEASTERN_STUDENT,
      },
    }),
  ]);
}

/** The typed confirmation must be the account's own email. */
function assertConfirmed(input: DeleteAccountInput, email: string) {
  if (input.confirmEmail.toLowerCase() !== email.toLowerCase()) {
    throw new ServiceError(
      "INVALID",
      "That email does not match the account. Nothing was deleted.",
    );
  }
}

/**
 * Deletes the viewer's own account, for the Settings page.
 *
 * Takes only the Viewer, never a target id, so nobody can delete someone else
 * through it.
 */
export async function deleteOwnAccount(
  viewer: Viewer,
  input: DeleteAccountInput,
) {
  assertConfirmed(input, viewer.email);

  // Unlike in setAccountStatus, this guard can fire: here the caller *is* the
  // target, so the last officer is not counted among the ones who remain.
  if (isOfficer(viewer) && (await isLastApprovedOfficer(viewer.id))) {
    throw new ServiceError(
      "CONFLICT",
      "You are the last officer. Make someone else an officer before you delete your account.",
    );
  }

  await anonymizeAccount(viewer.id);
}

/**
 * Deletes someone else's account, for an officer on the Members page.
 *
 * Who may delete whom is canDeleteAccount (lib/auth/accountPolicy.ts), the
 * same function that decides whether the Members panel shows the button:
 * officers delete members, only a super admin deletes another officer, and
 * nobody uses this on themselves.
 *
 * Returns the person's real email, read before it is replaced, so the caller
 * can find and remove their Supabase login.
 */
export async function deleteAccountAsOfficer(
  officer: Viewer,
  targetUserId: number,
  input: DeleteAccountInput,
): Promise<{ email: string }> {
  if (targetUserId === officer.id) {
    throw new ServiceError(
      "INVALID",
      "Delete your own account from Settings instead.",
    );
  }

  const target = await getUserById(targetUserId);

  // Already anonymous. Same answer as a row that is not there.
  if (target.status === AccountStatus.DELETED) {
    throw new ServiceError("NOT_FOUND", "User not found");
  }

  if (!canDeleteAccount(officer, target)) {
    throw new ServiceError(
      "FORBIDDEN",
      isOfficer(officer)
        ? "Only a super admin can delete another officer's account."
        : "Only officers can delete other people's accounts.",
    );
  }

  assertConfirmed(input, target.email);

  // Cannot fire today, for the reason given on setAccountStatus: the caller is
  // an approved officer who is not the target, so one officer always remains.
  // It stays so the invariant holds if that ever stops being true.
  if (isOfficer(target) && (await isLastApprovedOfficer(target.id))) {
    throw new ServiceError(
      "CONFLICT",
      "Cannot delete the last approved officer",
    );
  }

  await anonymizeAccount(target.id);
  return { email: target.email };
}

/**
 * Decides an account: approve it, deny it, or put it back in the queue.
 *
 * Three rules live here, and all three used to sit inside the route handler:
 *
 *   you cannot decide your own account -- never legitimate, and it is how an
 *     officer locks themselves out with one misclick
 *   you cannot remove the last approved officer -- see the note below
 *   going back to PENDING clears the decision -- otherwise the row keeps a
 *     stale officer and timestamp that read as though it were still decided
 *
 * On the last-officer guard: it cannot fire through the API today, and that is
 * worth knowing rather than discovering. requireOfficerApi guarantees the
 * caller is an APPROVED officer, and the self-check above guarantees they are
 * not the target -- so the caller is always counted among the "remaining"
 * officers and the count is never zero. The self-check is what actually
 * prevents a lockout: the last officer standing cannot deny themselves.
 *
 * The guard stays because it stops being redundant the moment anything can
 * change a role, demote in bulk, or act without an officer session -- a
 * migration, a script, or an admin endpoint. Deleting it would move the
 * invariant into a comment.
 *
 * Deliberately separate from deciding team requests. Approving a person and
 * approving each team they asked to join are independent calls, so an officer
 * can let someone in without granting every team they picked.
 */
export async function setAccountStatus(
  officer: Viewer,
  targetUserId: number,
  status: AccountStatus,
) {
  if (targetUserId === officer.id) {
    throw new ServiceError(
      "INVALID",
      "You cannot change your own account status",
    );
  }

  const target = await getUserById(targetUserId);

  // Approving a deleted row would put a nameless "Former member" back on the
  // roster. The person signs up again instead, as a new account.
  if (target.status === AccountStatus.DELETED) {
    throw new ServiceError("CONFLICT", "This account was deleted");
  }

  const losingAnOfficer =
    status !== AccountStatus.APPROVED && isOfficer(target);
  if (losingAnOfficer && (await isLastApprovedOfficer(target.id))) {
    throw new ServiceError("CONFLICT", "Cannot deny the last approved officer");
  }

  const decided = status !== AccountStatus.PENDING;

  return prisma.user.update({
    where: { id: targetUserId },
    data: {
      status,
      decidedAt: decided ? new Date() : null,
      decidedById: decided ? officer.id : null,
    },
  });
}

/**
 * Decides several accounts at once, e.g. an officer checking off a batch of
 * known-good signups in the pending queue instead of opening each one.
 *
 * Reuses setAccountStatus per id rather than a single bulk update, so the
 * self-decision and last-officer guards apply to every target without being
 * duplicated here. Runs each decision independently (Promise.allSettled, not
 * a transaction) so one bad id -- someone else just denied it, or it's the
 * officer's own account -- doesn't roll back the rest of the batch; the
 * caller gets back exactly which ids succeeded and why any others failed.
 *
 * Approving also approves that user's pending team requests. The single-row
 * decision sheet leaves that as a separate click because it shows every
 * request and lets an officer accept some teams and reject others -- but a
 * bulk approval has no per-row moment to do that, and leaving every request
 * stuck in the queue after the account is already in would just move the
 * manual work rather than remove it.
 */
export async function setAccountStatusBulk(
  officer: Viewer,
  targetUserIds: number[],
  status: AccountStatus,
) {
  const results = await Promise.allSettled(
    targetUserIds.map(async (id) => {
      const updated = await setAccountStatus(officer, id, status);
      if (status === AccountStatus.APPROVED) {
        await approvePendingMemberships(officer, id);
      }
      return updated;
    }),
  );

  const updated: number[] = [];
  const failed: { id: number; error: string }[] = [];

  results.forEach((result, i) => {
    const id = targetUserIds[i];
    if (result.status === "fulfilled") {
      updated.push(id);
    } else {
      const message =
        result.reason instanceof ServiceError
          ? result.reason.message
          : "Failed to update account status";
      failed.push({ id, error: message });
    }
  });

  return { updated, failed };
}

/**
 * Creates the row for a Supabase account on first sign-in, or returns the
 * existing one.
 *
 * upsert rather than find-then-create: two parallel requests for a brand-new
 * OAuth user both miss the lookup and race into create, and the loser fails the
 * email unique constraint with P2002.
 */
export function upsertUserByEmail(email: string, name: string | null) {
  return prisma.user.upsert({
    where: { email },
    update: {},
    // role defaults to NORTHEASTERN_STUDENT, status to ONBOARDING
    create: { email, name },
  });
}

/**
 * Updates the account behind a Supabase-verified email with the fields the
 * user edits on their own Settings page.
 *
 * Keyed by email rather than id because the settings action knows the session,
 * not the row.
 */
export function updateProfileByEmail(email: string, input: UpdateProfileInput) {
  return prisma.user.update({ where: { email }, data: input });
}
