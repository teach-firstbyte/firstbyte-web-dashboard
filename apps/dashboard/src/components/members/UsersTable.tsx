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
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import React, { useEffect, useState } from "react";
import { User } from "@/types/dashboard";
import { withBasePath } from "@/lib/paths";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { TableEmptyState } from "@/components/ui/TableEmptyState";
import { useDetailRow } from "@/hooks/useDetailRow";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { UserDetailSheet } from "./UserDetailSheet";
import { OfficerBadge } from "@/components/OfficerBadge";
import { isOfficerRole } from "@/lib/auth/roles";
import { isInviteOnly } from "@/lib/auth/teamPolicy";

interface UsersTableProps {
  users: User[];
  /**
   * Whether the viewer may assign invite-only teams. A plain boolean rather than
   * the viewer's role, so this component never needs the Role enum.
   */
  canManageRestricted: boolean;
  children?: React.ReactNode;
}

/** A `<TableHead>` that toggles `?sort=<field>&dir=asc|desc` on click. */
function SortableTableHead({
  field,
  className,
  children,
}: {
  field: string;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeSort = searchParams.get("sort") ?? "name";
  const activeDir = searchParams.get("dir") ?? "asc";
  const isActive = activeSort === field;
  const nextDir = isActive && activeDir === "asc" ? "desc" : "asc";

  const handleClick = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", field);
    params.set("dir", nextDir);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={handleClick}
        className="flex items-center gap-1 hover:underline"
      >
        {children}
        {isActive && (
          <span aria-hidden="true">{activeDir === "asc" ? "▲" : "▼"}</span>
        )}
      </button>
    </TableHead>
  );
}

export function UsersTable({
  users,
  canManageRestricted,
  children,
}: UsersTableProps) {
  const [showAssignModal, setShowAssignModal] = useState(false);
  const router = useRouter();
  const assign = useAsyncAction();

  // Detail panel state lives alongside the modal state above; opening a row
  // doesn't touch either, so the table keeps whatever the officer had set up.
  const detail = useDetailRow<User>();

  const [teams, setTeams] = useState<
    { id: number; name: string; joinPolicy: string }[]
  >([]);
  const [teamsLoading, setTeamsLoading] = useState(false);

  useEffect(() => {
    if (!showAssignModal) return;

    setTeamsLoading(true);
    fetch(withBasePath("/api/teams"))
      .then((res) => res.json())
      .then((data) => setTeams(data))
      .catch(() => setTeams([]))
      .finally(() => setTeamsLoading(false));
  }, [showAssignModal]);

  // for the assign modal
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedTeams, setSelectedTeams] = useState<number[]>([]);

  const [originalTeamIds, setOriginalTeamIds] = useState<number[]>([]);
  const [membershipIdByTeam, setMembershipIdByTeam] = useState<
    Record<number, number>
  >({});

  // for the checkboxes
  const toggleTeam = (teamId: string | number) => {
    const id = typeof teamId === "string" ? Number(teamId) : teamId;
    setSelectedTeams((prev) =>
      prev.includes(id) ? prev.filter((tid) => tid !== id) : [...prev, id],
    );
  };

  const handleAssignSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;
    // No re-entry guard needed here -- useAsyncAction.run ignores a call while one
    // is already in flight, including a second click in the same tick.

    // Both sides filtered by what this officer may actually touch.
    //
    // `removed` is the load-bearing one. originalTeamIds comes from the user's
    // real memberships, so it contains invite-only teams even though they are
    // not rendered as checkboxes -- which means "not in selectedTeams" is true
    // for them on every single save. Without this filter, opening the modal on
    // an e-board member and changing anything else would fire a DELETE for
    // their e-board membership; the server now refuses that, so the visible
    // symptom would be a correct save reporting failure.
    const manageable = new Set(
      teams
        .filter((t) => canManageRestricted || !isInviteOnly(t.joinPolicy))
        .map((t) => t.id),
    );

    const added = selectedTeams.filter(
      (id) => !originalTeamIds.includes(id) && manageable.has(id),
    );
    const removed = originalTeamIds.filter(
      (id) => !selectedTeams.includes(id) && manageable.has(id),
    );

    assign.run(async () => {
      const addCalls = added.map((teamId) =>
        fetch(withBasePath("/api/team-members"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: selectedUserId,
            teamId,
            role: "MEMBER",
          }),
        }),
      );

      const removeCalls = removed.map((teamId) =>
        fetch(withBasePath(`/api/team-members/${membershipIdByTeam[teamId]}`), {
          method: "DELETE",
        }),
      );

      const results = await Promise.allSettled([...addCalls, ...removeCalls]);

      // allSettled only rejects on a network failure -- an HTTP 500 arrives as
      // fulfilled with `ok: false`, so checking status alone reports a failed
      // save as a success.
      const failed = results.some(
        (r) => r.status === "rejected" || !r.value.ok,
      );
      if (failed) throw new Error("Some team changes could not be saved.");

      router.refresh();
      // Queued inside the transition after the refresh, so the modal closes as
      // the updated table commits rather than over stale rows.
      setShowAssignModal(false);
    });
  };

  const handleUserSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const userId = Number(e.target.value);
    setSelectedUserId(userId);

    const user = users.find((u) => u.id === userId);
    const memberships = user?.teamMemberships ?? [];

    const teamIds = memberships.map((m) => m.team.id);
    const idMap = Object.fromEntries(memberships.map((m) => [m.team.id, m.id]));

    setSelectedTeams(teamIds);
    setOriginalTeamIds(teamIds);
    setMembershipIdByTeam(idMap);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Members</CardTitle>
        <CardDescription>
          Approved members. Click a row for details.
        </CardDescription>
        <CardAction>
          <Button onClick={() => setShowAssignModal(true)}>Assign teams</Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {children && <div className="mb-4">{children}</div>}
        <Table>
          <TableHeader>
            <TableRow>
              <SortableTableHead field="name">Name</SortableTableHead>
              <SortableTableHead field="email">Email</SortableTableHead>
              <TableHead>Teams</TableHead>
              <SortableTableHead
                field="createdAt"
                className="hidden md:table-cell"
              >
                Joined
              </SortableTableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableEmptyState colSpan={4} message="No users yet." />
            ) : (
              users.map((user) => (
                <TableRow key={user.id} {...detail.getRowProps(user)}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 truncate">
                        {user.name || "N/A"}
                      </span>
                      {isOfficerRole(user.role) && <OfficerBadge />}
                    </div>
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
                      {user.teamMemberships.map((membership, index) => (
                        <Badge key={index} variant="secondary">
                          {membership.team.name} ({membership.role})
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <UserDetailSheet
          user={detail.selected}
          onOpenChange={detail.onOpenChange}
          onCloseAutoFocus={detail.onCloseAutoFocus}
        />
        <Dialog open={showAssignModal} onOpenChange={setShowAssignModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign teams</DialogTitle>
              <DialogDescription>
                Pick a member, then check the teams they should be on.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAssignSubmit}>
              <FieldGroup className="gap-5">
                <Field>
                  <FieldLabel htmlFor="assign-user">Member</FieldLabel>
                  <NativeSelect
                    id="assign-user"
                    data-full
                    value={selectedUserId ?? ""}
                    onChange={handleUserSelect}
                    required
                  >
                    <NativeSelectOption value="" disabled>
                      Choose a member…
                    </NativeSelectOption>
                    {users.map((u) => (
                      <NativeSelectOption key={u.id} value={u.id}>
                        {u.name || u.email}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
                <FieldSet
                  disabled={!selectedUserId || teamsLoading || assign.pending}
                >
                  <FieldLegend
                    variant="label"
                    className="flex items-center gap-2"
                  >
                    Teams {teamsLoading && <Spinner className="size-3" />}
                  </FieldLegend>
                  <div className="flex flex-col gap-2">
                    {teams
                      .filter(
                        (t) =>
                          canManageRestricted || !isInviteOnly(t.joinPolicy),
                      )
                      .map((t) => (
                        <label
                          key={t.id}
                          className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm has-[:checked]:border-primary has-[:disabled]:opacity-60"
                        >
                          <input
                            type="checkbox"
                            className="size-4 accent-primary"
                            checked={selectedTeams.includes(t.id)}
                            onChange={() => toggleTeam(t.id)}
                          />
                          {t.name}
                          {isInviteOnly(t.joinPolicy) && (
                            <span className="text-xs text-muted-foreground">
                              invite only
                            </span>
                          )}
                        </label>
                      ))}
                  </div>
                </FieldSet>
                {assign.error && (
                  <p className="text-sm text-destructive">{assign.error}</p>
                )}
              </FieldGroup>
              <DialogFooter className="mt-6">
                <Button
                  variant="outline"
                  disabled={assign.pending}
                  onClick={() => setShowAssignModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  pending={assign.pending}
                  pendingLabel="Saving…"
                  disabled={!selectedUserId}
                >
                  Save
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
