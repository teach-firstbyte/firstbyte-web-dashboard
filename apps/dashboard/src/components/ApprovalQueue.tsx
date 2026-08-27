"use client";

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
import { TableEmptyState } from "./ui/TableEmptyState";
import { useDetailRow } from "@/hooks/useDetailRow";
import { AccountStatusBadge } from "./AccountStatusBadge";
import { ApprovalDetailSheet } from "./ApprovalDetailSheet";
import type { PendingUser } from "@/types/dashboard";

export function ApprovalQueue({
  users,
  canManageRestricted,
}: {
  users: PendingUser[];
  /** Whether the viewer may decide requests for invite-only teams. */
  canManageRestricted: boolean;
}) {
  const detail = useDetailRow<PendingUser>();

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
          submitted and decide their team requests.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
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
                colSpan={5}
                message="No accounts waiting for review."
              />
            ) : (
              users.map((user) => (
                <TableRow key={user.id} {...detail.getRowProps(user)}>
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
