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
import { isInviteOnly } from "@/lib/auth/teamPolicy";
import { TEAM_JOIN_POLICY } from "@/lib/enums";
import { updateTeamAction } from "@/app/actions/teams";

interface EditTeamModalProps {
  team: Team;
  canManageRestricted: boolean;
  onClose: () => void;
}

function EditTeamModal({
  team,
  canManageRestricted,
  onClose,
}: EditTeamModalProps) {
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
        {/* Super admins only, and the server enforces the same rule -- rendering
            this for a regular officer would just produce a 403 on save. The
            action reads the field only when it is present, so its absence here
            leaves the team's policy alone rather than sending a null. */}
        {canManageRestricted && (
          <div>
            <ControlLabel label="Who can join" />
            <select
              name="joinPolicy"
              defaultValue={team.joinPolicy}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value={TEAM_JOIN_POLICY.OPEN}>
                Open — anyone can request this team during onboarding
              </option>
              <option value={TEAM_JOIN_POLICY.INVITE_ONLY}>
                Invite only — assigned by a super admin
              </option>
            </select>
          </div>
        )}
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
  /** Whether the viewer may edit invite-only teams. */
  canManageRestricted: boolean;
}

export function TeamsTable({ teams, canManageRestricted }: TeamsTableProps) {
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
                    <div className="flex flex-wrap gap-1">
                      <Badge variant={team.isActive ? "default" : "secondary"}>
                        {team.isActive ? "Active" : "Inactive"}
                      </Badge>
                      {/* Shown so an officer can tell at a glance why this team
                          is absent from the onboarding form, rather than
                          reporting it as a bug. */}
                      {isInviteOnly(team.joinPolicy) && (
                        <Badge variant="outline">Invite only</Badge>
                      )}
                    </div>
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
                    {/* Disabled rather than hidden: the column stays aligned and
                        the title says why. The server refuses this edit anyway,
                        and a form that always fails is worse than no form. */}
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={
                        isInviteOnly(team.joinPolicy) && !canManageRestricted
                      }
                      title={
                        isInviteOnly(team.joinPolicy) && !canManageRestricted
                          ? "Only a super admin can edit an invite-only team."
                          : undefined
                      }
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
            canManageRestricted={canManageRestricted}
            onClose={() => setEditingTeam(null)}
          />
        )}
      </CardContent>
    </Card>
  );
}
