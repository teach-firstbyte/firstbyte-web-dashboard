import { AccountStatus } from "@prisma/client";
import { redirect } from "next/navigation";

/**
 * The one place a status maps to a destination.
 *
 * Typed as a total Record over AccountStatus so adding a status later is a
 * compile error here rather than a silent fall-through to "/".
 */
export const STATUS_HOME: Record<AccountStatus, string> = {
  [AccountStatus.ONBOARDING]: "/onboarding",
  [AccountStatus.PENDING]: "/pending",
  // Denied users land on the same page, which renders a denied variant.
  [AccountStatus.DENIED]: "/pending",
  [AccountStatus.APPROVED]: "/",
  // No session can reach a deleted row: deleteOwnAccount replaces its email,
  // and every session is looked up by email. Listed only to keep the Record
  // total. /login has no status gate, so this cannot loop either.
  [AccountStatus.DELETED]: "/login",
};

export function isApproved(user: { status: AccountStatus }): boolean {
  return user.status === AccountStatus.APPROVED;
}

/**
 * Redirect a user away from the page they are on unless their status is one the
 * page accepts. For the gate pages themselves (/onboarding, /pending).
 *
 * Loop-freedom: STATUS_HOME sends each status to exactly one path, and that
 * path's `allowed` set contains that status --
 *   ONBOARDING -> /onboarding (allowed there)
 *   PENDING    -> /pending    (allowed there, and on /onboarding for edits)
 *   DENIED     -> /pending    (allowed there)
 *   APPROVED   -> /           (requireApprovedUser lets it through)
 *   DELETED    -> /login      (no gate there)
 * so every redirect lands somewhere that accepts the user, in exactly one hop.
 * Breaking that pairing is the only way to reintroduce a loop.
 */
export function assertStatusAllowed(
  user: { status: AccountStatus },
  allowed: AccountStatus[],
): void {
  if (!allowed.includes(user.status)) {
    redirect(STATUS_HOME[user.status]);
  }
}
