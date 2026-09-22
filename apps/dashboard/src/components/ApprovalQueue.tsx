"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableEmptyState } from "./ui/TableEmptyState";
import { useDetailRow } from "@/hooks/useDetailRow";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { withBasePath } from "@/lib/paths";
import { AccountStatusBadge } from "./AccountStatusBadge";
import { ApprovalDetailSheet } from "./ApprovalDetailSheet";
import { isInviteOnly } from "@/lib/auth/teamPolicy";
import type { PendingUser } from "@/types/dashboard";

async function patchBulkStatus(userIds: number[], status: string) {
  const res = await fetch(withBasePath("/api/users/status/bulk"), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userIds, status }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error ?? "That change could not be saved.");
  }
  return (await res.json()) as {
    updated: number[];
    failed: { id: number; error: string }[];
  };
}

export function ApprovalQueue({
  users,
  canManageRestricted,
}: {
  users: PendingUser[];
  /** Whether the viewer may decide requests for invite-only teams. */
  canManageRestricted: boolean;
}) {
  const router = useRouter();
  const detail = useDetailRow<PendingUser>();
  const bulk = useAsyncAction();

  // Selection is by id, not by row object, for the same reason the detail
  // panel re-resolves by id below: a refresh replaces every row's object
  // identity, and holding onto stale objects would silently drop the
  // selection out from under the checkboxes on the next render.
  const [selectedIds, setSelectedIds] = React.useState<ReadonlySet<number>>(
    () => new Set(),
  );

  // useDetailRow holds the row object it was opened with. Once the server data
  // is refetched, `users` is a fresh array of fresh objects and that held
  // reference is a snapshot -- so the open panel would keep showing the state of
  // the record at the moment it was clicked. Re-resolve it by id so the panel
  // tracks the live row, falling back to the snapshot if the row has left the
  // queue (an approved account, whose panel is closing anyway).
  const selected = detail.selected
    ? (users.find((u) => u.id === detail.selected!.id) ?? detail.selected)
    : null;

  const waiting = users.filter((u) => u.status === "PENDING").length;

  const toggleRow = (id: number, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleAll = (checked: boolean) => {
    setSelectedIds(checked ? new Set(users.map((u) => u.id)) : new Set());
  };

  const allSelected = users.length > 0 && selectedIds.size === users.length;

  // Only a super admin can decide an invite-only request (see
  // ApprovalDetailSheet), and approvePendingMemberships enforces that on the
  // server by leaving those specific requests PENDING. Told here too, so a
  // regular officer isn't left assuming a bulk approval reached every team it
  // shows.
  const selectionHasRestrictedRequest =
    !canManageRestricted &&
    users.some(
      (u) =>
        selectedIds.has(u.id) &&
        u.teamMemberships.some((m) => isInviteOnly(m.team.joinPolicy)),
    );

  const decideSelected = (status: "APPROVED" | "DENIED") => {
    const ids = Array.from(selectedIds);
    bulk.run(async () => {
      const result = await patchBulkStatus(ids, status);
      if (result.failed.length > 0) {
        throw new Error(
          `${result.failed.length} of ${ids.length} accounts could not be updated: ` +
            result.failed.map((f) => f.error).join("; "),
        );
      }
      setSelectedIds(new Set());
      router.refresh();
    });
  };

  return (
    <Card>
      <CardHeader className="space-y-2">
        <CardTitle>
          Pending Approvals
          {waiting > 0 && (
            <Badge className="ml-2" variant="outline">
              {waiting}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          New accounts waiting on an officer. Open a row to see what they
          submitted and decide their team requests, or check off several to
          approve or deny at once.
        </CardDescription>
        {selectedIds.size > 0 && (
          <div className="flex flex-col gap-1 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {selectedIds.size} selected
              </span>
              <Button
                size="sm"
                variant="brand"
                disabled={bulk.pending}
                onClick={() => decideSelected("APPROVED")}
              >
                Approve selected
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={bulk.pending}
                onClick={() => decideSelected("DENIED")}
              >
                Deny selected
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Approving also approves each account&apos;s requested teams.
              {selectionHasRestrictedRequest &&
                " Invite-only team requests are left pending for a super admin to decide."}
            </p>
          </div>
        )}
        {bulk.error && <p className="text-sm text-destructive">{bulk.error}</p>}
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">
                {users.length > 0 && (
                  <input
                    type="checkbox"
                    aria-label="Select all pending approvals"
                    checked={allSelected}
                    onChange={(e) => toggleAll(e.target.checked)}
                  />
                )}
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Requested teams</TableHead>
              <TableHead className="hidden md:table-cell">Submitted</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableEmptyState
                colSpan={6}
                message="No accounts waiting for review."
              />
            ) : (
              users.map((user) => (
                <TableRow key={user.id} {...detail.getRowProps(user)}>
                  <TableCell>
                    <input
                      type="checkbox"
                      aria-label={`Select ${user.preferredName ?? user.name ?? user.email}`}
                      checked={selectedIds.has(user.id)}
                      onChange={(e) => toggleRow(user.id, e.target.checked)}
                    />
                  </TableCell>
                  <TableCell>
                    {user.preferredName ?? user.name ?? "N/A"}
                  </TableCell>
                  <TableCell>
                    <a
                      href={`mailto:${user.email}`}
                      className="text-primary hover:underline"
                    >
                      {user.email}
                    </a>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {user.teamMemberships.length === 0 ? (
                        <span className="text-sm text-muted-foreground/60 italic">
                          None
                        </span>
                      ) : (
                        user.teamMemberships.map((m) => (
                          <Badge key={m.id} variant="secondary">
                            {m.team.name}
                          </Badge>
                        ))
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {user.submittedAt
                      ? new Date(user.submittedAt).toLocaleDateString()
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <AccountStatusBadge status={user.status} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <ApprovalDetailSheet
          user={selected}
          canManageRestricted={canManageRestricted}
          onOpenChange={detail.onOpenChange}
          onCloseAutoFocus={detail.onCloseAutoFocus}
        />
      </CardContent>
    </Card>
  );
}
