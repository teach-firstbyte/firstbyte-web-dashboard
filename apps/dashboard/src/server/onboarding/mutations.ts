import { AccountStatus, TeamMemberStatus } from "@prisma/client";
import { prisma } from "@/server/db";
import { ServiceError } from "@/server/errors";
import type { Viewer } from "@/server/viewer";
import type { OnboardingInput } from "./schema";

/**
 * Editable right up until an officer acts. PENDING stays editable so someone
 * waiting in the queue can fix a typo or change which teams they asked for.
 */
export const EDITABLE: AccountStatus[] = [
  AccountStatus.ONBOARDING,
  AccountStatus.PENDING,
];

export function isEditable(status: AccountStatus): boolean {
  return EDITABLE.includes(status);
}

/**
 * Saves an onboarding submission, and optionally enters the review queue.
 *
 * Everything that has to be atomic is inside one transaction, because a
 * half-applied submission is worse than a rejected one: teams changed but
 * answers not, or answers saved without entering the queue.
 *
 * Three rules the transaction exists to protect:
 *
 *   the account may still be edited -- re-read INSIDE the transaction, because
 *     an officer can decide it between the page gate and this write
 *   an officer's decision is not the user's to undo -- only PENDING rows are
 *     removed when a team is de-selected; APPROVED and REJECTED rows stay
 *   re-submitting does not jump the queue -- the status change to PENDING only
 *     happens from ONBOARDING, so editing while already pending keeps the
 *     original submittedAt
 */
export async function saveOnboarding(
  viewer: Viewer,
  input: OnboardingInput,
  intent: "submit" | "save",
) {
  if (!isEditable(viewer.status)) {
    throw new ServiceError(
      "FORBIDDEN",
      "This submission can no longer be edited.",
    );
  }

  if (intent === "submit" && input.teamIds.length === 0) {
    throw new ServiceError(
      "INVALID",
      "Pick at least one team you're interested in.",
    );
  }

  // The checkbox values are client input: confirm every id is a real, ACTIVE
  // team before any of them becomes a membership row. A retired team must not
  // be joinable just because someone kept an old page open.
  const validTeams = await prisma.team.findMany({
    where: { id: { in: input.teamIds }, isActive: true },
    select: { id: true },
  });

  if (validTeams.length !== input.teamIds.length) {
    throw new ServiceError(
      "INVALID",
      "One of those teams is no longer available. Reload and try again.",
    );
  }
  const validIds = validTeams.map((t) => t.id);

  return prisma.$transaction(async (tx) => {
    // Re-read inside the transaction: an officer may have decided this account
    // between the gate check above and here.
    const fresh = await tx.user.findUniqueOrThrow({ where: { id: viewer.id } });
    if (!isEditable(fresh.status)) {
      throw new ServiceError(
        "CONFLICT",
        "An officer has already reviewed your account.",
      );
    }

    // Drop de-selected teams, but only rows still PENDING. An APPROVED or
    // REJECTED row is an officer's decision and is not the user's to undo.
    await tx.teamMember.deleteMany({
      where: {
        userId: viewer.id,
        status: TeamMemberStatus.PENDING,
        teamId: { notIn: validIds },
      },
    });

    // upsert, not create: @@unique([userId, teamId]) means a double-submit
    // would otherwise throw P2002. The empty `update` is also what stops a
    // re-submit from downgrading an already-APPROVED row back to PENDING.
    for (const teamId of validIds) {
      await tx.teamMember.upsert({
        where: { userId_teamId: { userId: viewer.id, teamId } },
        update: {},
        create: { userId: viewer.id, teamId, status: TeamMemberStatus.PENDING },
      });
    }

    const entersQueue =
      intent === "submit" && fresh.status === AccountStatus.ONBOARDING;

    return tx.user.update({
      where: { id: viewer.id },
      data: {
        preferredName: input.preferredName,
        pronouns: input.pronouns,
        gradYear: input.gradYear,
        major: input.major,
        ...(entersQueue
          ? { status: AccountStatus.PENDING, submittedAt: new Date() }
          : {}),
      },
    });
  });
}
