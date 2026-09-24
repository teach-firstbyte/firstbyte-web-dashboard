"use client";

import { Badge } from "@/components/ui/badge";
import { DetailSheet } from "@/components/ui/detail-sheet";
import {
  DetailEmpty,
  DetailField,
  DetailGrid,
  DetailSection,
} from "@/components/ui/detail";
import { formatDateTime } from "@/lib/format";
import type { Team } from "@/types/dashboard";
import { OfficerBadge } from "./OfficerBadge";
import { isOfficerRole } from "@/lib/auth/roles";
import { ExportTeamMembersButton } from "./ExportTeamMembersButton";

interface TeamDetailSheetProps {
  team: Team | null;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus: (event: Event) => void;
}

export function TeamDetailSheet({
  team,
  onOpenChange,
  onCloseAutoFocus,
}: TeamDetailSheetProps) {
  return (
    <DetailSheet
      record={team}
      onOpenChange={onOpenChange}
      onCloseAutoFocus={onCloseAutoFocus}
      title={(t) => t.name}
      description={() => "Team details"}
    >
      {(t) => (
        <>
          <DetailSection title="Overview">
            <DetailGrid>
              <DetailField
                label="Description"
                value={t.description}
                className="sm:col-span-2"
              />
              <DetailField label="Status">
                <Badge variant={t.isActive ? "default" : "secondary"}>
                  {t.isActive ? "Active" : "Inactive"}
                </Badge>
              </DetailField>
              <DetailField label="Team ID" value={t.id} />
              <DetailField
                label="Created"
                value={formatDateTime(t.createdAt)}
              />
              <DetailField
                label="Last updated"
                value={formatDateTime(t.updatedAt)}
              />
            </DetailGrid>
          </DetailSection>

          <DetailSection
            title={`Members (${t.members.length})`}
            action={<ExportTeamMembersButton team={t} />}
          >
            {t.members.length === 0 ? (
              <DetailEmpty>No members on this team yet.</DetailEmpty>
            ) : (
              <ul className="space-y-2">
                {t.members.map((member) => (
                  <li
                    key={member.user.email}
                    className="flex items-center justify-between gap-2 rounded-md border p-3"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {member.user.name ?? member.user.email}
                      </div>
                      {member.user.name && (
                        <div className="truncate text-xs text-muted-foreground">
                          {member.user.email}
                        </div>
                      )}
                    </div>
                    {/* The panel has room for the word, unlike the table chips.
                        Officer status and team role are separate facts, so they
                        stay in separate badges. */}
                    <div className="flex shrink-0 items-center gap-2">
                      {isOfficerRole(member.user.role) && <OfficerBadge />}
                      <Badge variant="outline">{member.role}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </DetailSection>
        </>
      )}
    </DetailSheet>
  );
}
