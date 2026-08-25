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
  CardButton,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import React, { useEffect, useState } from "react";
import {
  Modal,
  ModalHeader,
  ModalButton,
  ModalDropdown,
  ModalCheckboxes,
} from "@/components/ui/modal";
import { User } from "@/types/dashboard";
import { withBasePath } from "@/lib/paths";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { TableEmptyState } from "./ui/TableEmptyState";
import { useDetailRow } from "@/hooks/useDetailRow";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { UserDetailSheet } from "./UserDetailSheet";
import { OfficerBadge } from "./OfficerBadge";
import { isOfficerRole } from "@/lib/auth/roles";

interface UsersTableProps {
  users: User[];
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

export function UsersTable({ users, children }: UsersTableProps) {
  const [showAssignModal, setShowAssignModal] = useState(false);
  const router = useRouter();
  const assign = useAsyncAction();

  // Detail panel state lives alongside the modal state above; opening a row
  // doesn't touch either, so the table keeps whatever the officer had set up.
  const detail = useDetailRow<User>();

  const [teams, setTeams] = useState<{ id: number; name: string }[]>([]);
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

    const added = selectedTeams.filter((id) => !originalTeamIds.includes(id));
    const removed = originalTeamIds.filter((id) => !selectedTeams.includes(id));

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
      <CardHeader className="flex flex-col gap-4 md:grid md:gap-1.5 space-y-2">
        <div className="space-y-2">
          <CardTitle>Users</CardTitle>
          <CardDescription>All registered users in the system</CardDescription>
        </div>
        <div data-slot="card-action" className="flex gap-2">
          <CardButton onClick={() => setShowAssignModal(true)}>
            Assign Teams
          </CardButton>
        </div>
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
        {showAssignModal && (
          <Modal onClose={() => setShowAssignModal(false)}>
            <ModalHeader>Assign User to Teams</ModalHeader>
            <form onSubmit={handleAssignSubmit} className="space-y-4 p-4">
              <ModalDropdown
                label="Select User"
                value={selectedUserId ?? ""}
                onChange={handleUserSelect}
                required
                options={users.map((u) => ({
                  value: u.id,
                  label: u.name || `User ${u.id}`,
                }))}
              />
              <ModalCheckboxes
                label="Assign to Teams"
                loading={teamsLoading}
                options={teams.map((t) => ({ value: t.id, label: t.name }))}
                selected={selectedTeams}
                onToggle={toggleTeam}
                disabled={!selectedUserId || teamsLoading || assign.pending}
              />
              {assign.error && (
                <p className="text-sm text-destructive">{assign.error}</p>
              )}
              <div className="flex justify-end gap-2 mt-4">
                <ModalButton
                  variant="cancel"
                  type="button"
                  disabled={assign.pending}
                  onClick={() => setShowAssignModal(false)}
                >
                  Cancel
                </ModalButton>
                <ModalButton
                  variant="primary"
                  type="submit"
                  pending={assign.pending}
                  pendingLabel="Saving…"
                >
                  Save
                </ModalButton>
              </div>
            </form>
          </Modal>
        )}
      </CardContent>
    </Card>
  );
}
