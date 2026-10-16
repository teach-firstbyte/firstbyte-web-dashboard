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
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { SubmitButton } from "@/components/SubmitButton";
import { Team } from "@/types/dashboard";
import { TableEmptyState } from "@/components/ui/TableEmptyState";
import { useDetailRow } from "@/hooks/useDetailRow";
import { TeamDetailSheet } from "./TeamDetailSheet";
import { OfficerStar } from "@/components/OfficerBadge";
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
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit team</DialogTitle>
          <DialogDescription>{team.name}</DialogDescription>
        </DialogHeader>
        <form action={formAction}>
          <FieldGroup className="gap-5">
            <Field>
              <FieldLabel htmlFor="team-name">Name</FieldLabel>
              <Input
                id="team-name"
                name="name"
                defaultValue={team.name}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="team-description">Description</FieldLabel>
              <Input
                id="team-description"
                name="description"
                defaultValue={team.description ?? ""}
              />
            </Field>
            <Field orientation="horizontal" className="rounded-xl border p-3">
              <FieldContent>
                <FieldLabel htmlFor="team-active">Active</FieldLabel>
                <FieldDescription>
                  Inactive teams can&apos;t be joined.
                </FieldDescription>
              </FieldContent>
              {/* Radix submits a named Switch like a checkbox ("on" or
                  absent), which is what updateTeamAction reads. */}
              <Switch
                id="team-active"
                name="isActive"
                defaultChecked={team.isActive}
              />
            </Field>
            {/* Super admins only, and the server enforces the same rule --
                rendering this for a regular officer would just produce a 403
                on save. The action reads the field only when it is present,
                so its absence here leaves the team's policy alone rather than
                sending a null. */}
            {canManageRestricted && (
              <Field>
                <FieldLabel htmlFor="team-policy">Who can join</FieldLabel>
                <NativeSelect
                  id="team-policy"
                  name="joinPolicy"
                  data-full
                  defaultValue={team.joinPolicy}
                >
                  <NativeSelectOption value={TEAM_JOIN_POLICY.OPEN}>
                    Open: anyone can ask to join
                  </NativeSelectOption>
                  <NativeSelectOption value={TEAM_JOIN_POLICY.INVITE_ONLY}>
                    Invite only: a super admin assigns people
                  </NativeSelectOption>
                </NativeSelect>
              </Field>
            )}
            {state.error && (
              <p className="text-sm text-destructive">{state.error}</p>
            )}
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <SubmitButton pendingLabel="Saving…">Save</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
        <CardDescription>
          Every team and who&apos;s on it. Click a row for the full roster.
        </CardDescription>
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
