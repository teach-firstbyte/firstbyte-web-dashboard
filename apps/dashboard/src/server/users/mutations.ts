import { AccountStatus } from "@prisma/client";
import { prisma } from "@/server/db";
import { isOfficer } from "@/lib/auth/roles";
import { ServiceError } from "@/server/errors";
import type { Viewer } from "@/server/viewer";
import { getUserById, isLastApprovedOfficer } from "./queries";
import type {
  CreateUserInput,
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

/** Deletes a user. Memberships, attendance and feedback cascade. */
export async function deleteUser(userId: number) {
  const user = await getUserById(userId);
  await prisma.user.delete({ where: { id: userId } });
  return user;
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
