"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { DetailSheet } from "@/components/ui/detail-sheet";
import {
  DetailEmpty,
  DetailField,
  DetailGrid,
  DetailSection,
} from "@/components/ui/detail";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { withBasePath } from "@/lib/paths";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { AccountStatusBadge, TeamRequestBadge } from "./AccountStatusBadge";
import type { PendingUser } from "@/types/dashboard";
import { isInviteOnly } from "@/lib/auth/teamPolicy";

interface ApprovalDetailSheetProps {
  user: PendingUser | null;
  /** Whether the viewer may decide requests for invite-only teams. */
  canManageRestricted: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus: (event: Event) => void;
}

async function patch(url: string, body: unknown) {
  const res = await fetch(withBasePath(url), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error ?? "That change could not be saved.");
  }
}

export function ApprovalDetailSheet({
  user,
  canManageRestricted,
  onOpenChange,
  onCloseAutoFocus,
}: ApprovalDetailSheetProps) {
  const router = useRouter();
  // Keyed per membership, so an officer working down the team list isn't
  // blocked by the previous row still being in flight.
  const action = useAsyncAction();

  // Team decisions are applied to local state rather than by calling
  // router.refresh() per click. A refresh re-runs every query behind the officer
  // dashboard and rebuilds the table underneath the open panel, which reads as
  // the whole page reloading mid-review. Deferring it to close means deciding
  // three teams is three requests and one rebuild instead of three.
  //
  // Reset on render when the panel switches to a different user, since selecting
  // another row swaps `user` without unmounting this component -- otherwise one
  // applicant's decisions would bleed onto the next.
  const [local, setLocal] = React.useState<{
    userId: number | null;
    teamStatus: Record<number, string>;
    accountStatus: string | null;
    stale: boolean;
  }>({ userId: null, teamStatus: {}, accountStatus: null, stale: false });

  if (user !== null && user.id !== local.userId) {
    // `stale` deliberately carries over: the overlay makes switching rows
    // without closing unreachable today, but if it ever becomes possible the
    // pending table refresh must not be dropped along with the decisions.
    setLocal({
      userId: user.id,
      teamStatus: {},
      accountStatus: null,
      stale: local.stale,
    });
  }

  /**
   * Flush the deferred refresh when the panel closes, so the table catches up
   * once rather than after every click.
   */
  const handleOpenChange = (open: boolean) => {
    if (!open && local.stale) {
      router.refresh();
    }
    onOpenChange(open);
  };

  const decideTeam = (membershipId: number, status: string) => {
    action.run(async () => {
      await patch(`/api/team-members/${membershipId}`, { status });
      setLocal((prev) => ({
        ...prev,
        teamStatus: { ...prev.teamStatus, [membershipId]: status },
        stale: true,
      }));
    }, membershipId);
  };

  const decideAccount = (targetId: number, status: string) => {
    action.run(async () => {
      await patch(`/api/users/${targetId}/status`, { status });

      // The queue lists PENDING *and* DENIED, so only an approval actually
      // removes this row from the table. Denying or requeueing leaves it there
      // with a different badge, so the panel stays open and updates in place --
      // closing it made a successful denial look like nothing had happened.
      if (status === "APPROVED") {
        // The row is leaving the queue, so the table must rebuild. Refresh
        // explicitly rather than relying on the deferred flush: only team
        // decisions set `stale`, and the panel is closing anyway so rebuilding
        // underneath it costs nothing.
        setLocal((prev) => ({ ...prev, stale: false }));
        router.refresh();
        onOpenChange(false);
        return;
      }

      setLocal((prev) => ({ ...prev, accountStatus: status, stale: true }));
    }, `account-${targetId}`);
  };

  return (
    <DetailSheet
      record={user}
      onOpenChange={handleOpenChange}
      onCloseAutoFocus={onCloseAutoFocus}
      title={(u) => u.preferredName ?? u.name ?? u.email}
      description={() => "Review this account"}
    >
      {(u) => {
        // Local decision wins until the deferred refresh lands, so the badge and
        // the decision buttons reflect the click immediately.
        const accountStatus = local.accountStatus ?? u.status;
        return (
          <>
            <DetailSection title="Account">
              <DetailGrid>
                <DetailField label="Status">
                  <AccountStatusBadge status={accountStatus} />
                </DetailField>
                <DetailField label="Full name" value={u.name} />
                <DetailField label="Preferred name" value={u.preferredName} />
                <DetailField label="Pronouns" value={u.pronouns} />
                <DetailField label="Email">
                  <a
                    href={`mailto:${u.email}`}
                    className="text-primary hover:underline"
                  >
                    {u.email}
                  </a>
                </DetailField>
                <DetailField label="Graduation year" value={u.gradYear} />
                <DetailField label="Major" value={u.major} />
                <DetailField
                  label="Submitted"
                  value={u.submittedAt ? formatDateTime(u.submittedAt) : null}
                />
              </DetailGrid>
            </DetailSection>

            <DetailSection
              title={`Team requests (${u.teamMemberships.length})`}
              aria-label="Team requests"
            >
              {u.teamMemberships.length === 0 ? (
                <DetailEmpty>No teams requested.</DetailEmpty>
              ) : (
                <ul className="space-y-2">
                  {u.teamMemberships.map((m) => {
                    // Local decision wins until the deferred refresh lands, so the
                    // badge and buttons update the moment the request succeeds.
                    const status = local.teamStatus[m.id] ?? m.status;
                    return (
                      <li
                        key={m.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="min-w-0 truncate text-sm font-medium">
                            {m.team.name}
                          </span>
                          <TeamRequestBadge status={status} />
                        </span>
                        {/* Only a super admin can decide an invite-only
                            request, so for anyone else these buttons would 403
                            with no way forward. Say who to ask instead. */}
                        {isInviteOnly(m.team.joinPolicy) &&
                        !canManageRestricted ? (
                          <span className="text-xs text-muted-foreground">
                            Managed by a super admin
                          </span>
                        ) : (
                          <span className="flex gap-2">
                            {status !== "APPROVED" && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={action.isPendingKey(m.id)}
                                onClick={() => decideTeam(m.id, "APPROVED")}
                              >
                                Approve
                              </Button>
                            )}
                            {status !== "REJECTED" && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={action.isPendingKey(m.id)}
                                onClick={() => decideTeam(m.id, "REJECTED")}
                              >
                                Reject
                              </Button>
                            )}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </DetailSection>

            {action.error && (
              <p className="text-sm text-destructive">{action.error}</p>
            )}

            <DetailSection title="Decision">
              <div className="flex flex-wrap gap-2">
                {accountStatus !== "APPROVED" && (
                  <Button
                    variant="brand"
                    disabled={action.pending}
                    onClick={() => decideAccount(u.id, "APPROVED")}
                  >
                    Approve account
                  </Button>
                )}
                {accountStatus !== "DENIED" && (
                  <Button
                    variant="destructive"
                    disabled={action.pending}
                    onClick={() => decideAccount(u.id, "DENIED")}
                  >
                    Deny account
                  </Button>
                )}
                {accountStatus !== "PENDING" && (
                  <Button
                    variant="outline"
                    disabled={action.pending}
                    onClick={() => decideAccount(u.id, "PENDING")}
                  >
                    Put back in queue
                  </Button>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Approving the account does not approve their teams — decide
                those above.
              </p>
            </DetailSection>
          </>
        );
      }}
    </DetailSheet>
  );
}
