"use client";

import { useActionState, useEffect, useState } from "react";
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
import { Input } from "@/components/ui/input";
import {
  ControlLabel,
  Modal,
  ModalButton,
  ModalHeader,
} from "@/components/ui/modal";
import { SubmitButton } from "@/components/SubmitButton";
import { Team } from "@/types/dashboard";
import { TableEmptyState } from "./ui/TableEmptyState";
import { useDetailRow } from "@/hooks/useDetailRow";
import { TeamDetailSheet } from "./TeamDetailSheet";
import { OfficerStar } from "./OfficerBadge";
import { isOfficerRole } from "@/lib/auth/roles";
import { updateTeamAction } from "@/app/actions/teams";

interface EditTeamModalProps {
  team: Team;
  onClose: () => void;
}

function EditTeamModal({ team, onClose }: EditTeamModalProps) {
  const [state, formAction] = useActionState(
    updateTeamAction.bind(null, team.id),
    {},
  );

  useEffect(() => {
    if (state.success) onClose();
  }, [state.success, onClose]);

  return (
    <Modal onClose={onClose}>
      <ModalHeader>Edit Team</ModalHeader>
      <form action={formAction} className="flex flex-col space-y-3">
        <div>
          <ControlLabel label="Team name" />
          <Input
            name="name"
            defaultValue={team.name}
            placeholder="Name"
            required
          />
        </div>
        <div>
          <ControlLabel label="Team description" />
          <Input
            name="description"
            defaultValue={team.description ?? ""}
            placeholder="Description"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={team.isActive}
          />
          Active
        </label>
        {state.error && (
          <p className="text-sm text-destructive">{state.error}</p>
        )}
        <div className="flex justify-end space-x-2 pt-2">
          <ModalButton variant="cancel" type="button" onClick={onClose}>
            Cancel
          </ModalButton>
          <SubmitButton>Save</SubmitButton>
        </div>
      </form>
    </Modal>
  );
}

interface TeamsTableProps {
  teams: Team[];
}

export function TeamsTable({ teams }: TeamsTableProps) {
  const detail = useDetailRow<Team>();
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Teams</CardTitle>
        <CardDescription>All teams and their members</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Members</TableHead>
              <TableHead className="hidden md:table-cell">Created</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {teams.length === 0 ? (
              <TableEmptyState
                colSpan={6}
                message="No teams established yet."
              />
            ) : (
              teams.map((team) => (
                <TableRow key={team.id} {...detail.getRowProps(team)}>
                  <TableCell>{team.name}</TableCell>
                  <TableCell>{team.description || "N/A"}</TableCell>
                  <TableCell>
                    <Badge variant={team.isActive ? "default" : "secondary"}>
                      {team.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {team.members.map((member, index) => (
                        <Badge key={index} variant="outline">
                          {/* Icon-only: the chip already carries a name and a
                              team role, so a second worded badge would crowd
                              rows on teams with more than a few members. */}
                          {isOfficerRole(member.user.role) && <OfficerStar />}
                          {member.user.name || member.user.email} ({member.role}
                          )
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {new Date(team.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingTeam(team)}
                    >
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <TeamDetailSheet
          team={detail.selected}
          onOpenChange={detail.onOpenChange}
          onCloseAutoFocus={detail.onCloseAutoFocus}
        />
        {editingTeam && (
          <EditTeamModal
            key={editingTeam.id}
            team={editingTeam}
            onClose={() => setEditingTeam(null)}
          />
        )}
      </CardContent>
    </Card>
  );
}
