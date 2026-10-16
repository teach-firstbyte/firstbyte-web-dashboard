"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { PersonAvatar } from "@/components/common/PersonAvatar";
import { EmptyState, RowList } from "@/components/common/Section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { isInviteOnly } from "@/lib/auth/teamPolicy";
import { formatRelative } from "@/lib/format";
import { withBasePath } from "@/lib/paths";
import type { PendingUser } from "@/types/dashboard";
import { ApprovalDetailSheet } from "./ApprovalDetailSheet";

async function decide(userIds: number[], status: "APPROVED" | "DENIED") {
  const res = await fetch(withBasePath("/api/users/status/bulk"), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userIds, status }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error ?? "That change could not be saved.");
  }
  const result = (await res.json()) as {
    updated: number[];
    failed: { id: number; error: string }[];
  };
  if (result.failed.length > 0) {
    throw new Error(result.failed.map((f) => f.error).join("; "));
  }
  return result;
}

const nameOf = (u: PendingUser) => u.preferredName ?? u.name ?? u.email;

/**
 * The approval queue on the officer home. Decide right from the list: what an
 * officer needs (year, major, teams asked for) is on the card, with Approve and
 * Deny beside it. The name opens the full panel for team-by-team decisions.
 *
 * Approve goes through the bulk endpoint even for one person, because that path
 * also approves their open team requests (invite-only ones stay waiting for a
 * super admin) -- the same thing "Approve all" does.
 */
export function ApprovalList({
  users,
  canManageRestricted,
}: {
  users: PendingUser[];
  /** Whether the viewer may decide requests for invite-only teams. */
  canManageRestricted: boolean;
}) {
  const router = useRouter();
  const action = useAsyncAction();
  const [denying, setDenying] = React.useState<PendingUser | null>(null);
  const [approvingAll, setApprovingAll] = React.useState(false);
  const [openId, setOpenId] = React.useState<number | null>(null);

  // Denied accounts stay in the queue (so a denial can be reversed) but are
  // not waiting on anyone.
  const waiting = users.filter((u) => u.status === "PENDING");
  const openUser = openId ? (users.find((u) => u.id === openId) ?? null) : null;

  const run = (
    ids: number[],
    status: "APPROVED" | "DENIED",
    done: string,
    key: string | number,
  ) =>
    action.run(async () => {
      await decide(ids, status);
      router.refresh();
      toast(done);
      setDenying(null);
      setApprovingAll(false);
    }, key);

  if (users.length === 0) {
    return (
      <EmptyState title="All caught up">New sign-ups show up here.</EmptyState>
    );
  }

  return (
    <>
      {waiting.length > 1 && (
        <div className="-mt-1 flex justify-end">
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0"
            onClick={() => setApprovingAll(true)}
          >
            Approve all {waiting.length}
          </Button>
        </div>
      )}
      <RowList>
        {users.map((u) => {
          const restricted = u.teamMemberships.filter((m) =>
            isInviteOnly(m.team.joinPolicy),
          );
          const openTeams = u.teamMemberships.filter(
            (m) => !isInviteOnly(m.team.joinPolicy),
          );
          const details = [
            u.gradYear && `Class of ${u.gradYear}`,
            u.major,
          ].filter(Boolean);
          return (
            <li key={u.id} className="flex gap-3 py-3">
              <PersonAvatar name={u.preferredName ?? u.name} email={u.email} />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                  <button
                    type="button"
                    onClick={() => setOpenId(u.id)}
                    className="truncate text-left font-semibold hover:underline focus-visible:underline focus-visible:outline-none"
                  >
                    {nameOf(u)}
                    {u.pronouns && (
                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                        {u.pronouns}
                      </span>
                    )}
                  </button>
                  {u.submittedAt && (
                    <span className="text-xs text-muted-foreground">
                      {formatRelative(u.submittedAt)}
                    </span>
                  )}
                </div>
                {details.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {details.join(" · ")}
                  </p>
                )}
                <p className="text-sm text-muted-foreground">
                  {openTeams.length > 0
                    ? `Wants: ${openTeams.map((m) => m.team.name).join(", ")}`
                    : "No open teams requested"}
                </p>
                {restricted.length > 0 && (
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Lock className="size-3" aria-hidden="true" />
                    {restricted.map((m) => m.team.name).join(", ")}
                    {canManageRestricted
                      ? " (invite-only)"
                      : " · a super admin decides this"}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {u.status === "DENIED" ? (
                    <>
                      <Badge variant="destructive">Denied</Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setOpenId(u.id)}
                      >
                        Review
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        pending={action.isPendingKey(u.id)}
                        disabled={action.pending}
                        onClick={() =>
                          run([u.id], "APPROVED", `Approved ${nameOf(u)}`, u.id)
                        }
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        disabled={action.pending}
                        onClick={() => setDenying(u)}
                      >
                        Deny
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </RowList>

      {action.error && !denying && !approvingAll && (
        <p className="text-sm text-destructive">{action.error}</p>
      )}

      <ConfirmDialog
        open={denying !== null}
        onOpenChange={(o) => !o && setDenying(null)}
        title={`Deny ${denying ? nameOf(denying) : ""}?`}
        message="They won't get access to the dashboard. You can put them back in the queue later from their panel."
        confirmLabel="Deny"
        destructive
        pending={action.pending}
        error={action.error}
        onConfirm={() =>
          denying &&
          run([denying.id], "DENIED", `Denied ${nameOf(denying)}`, "deny")
        }
      />
      <ConfirmDialog
        open={approvingAll}
        onOpenChange={setApprovingAll}
        title={`Approve ${waiting.length} people?`}
        message="Their requested teams are approved too. Invite-only requests stay waiting for a super admin."
        confirmLabel="Approve all"
        pending={action.pending}
        error={action.error}
        onConfirm={() =>
          run(
            waiting.map((u) => u.id),
            "APPROVED",
            `Approved ${waiting.length} people`,
            "all",
          )
        }
      />
      <ApprovalDetailSheet
        user={openUser}
        canManageRestricted={canManageRestricted}
        onOpenChange={(o) => !o && setOpenId(null)}
        onCloseAutoFocus={() => {}}
      />
    </>
  );
}
