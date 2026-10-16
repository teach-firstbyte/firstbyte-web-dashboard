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
import type { User } from "@/types/dashboard";
import { OfficerBadge } from "@/components/OfficerBadge";
import { isOfficerRole } from "@/lib/auth/roles";
import { DeleteMemberAccount } from "./DeleteMemberAccount";

interface UserDetailSheetProps {
  user: User | null;
  viewer: { id: number; role: string };
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus: (event: Event) => void;
  onDeleted: () => void;
}

export function UserDetailSheet({
  user,
  viewer,
  onOpenChange,
  onCloseAutoFocus,
  onDeleted,
}: UserDetailSheetProps) {
  return (
    <DetailSheet
      record={user}
      onOpenChange={onOpenChange}
      onCloseAutoFocus={onCloseAutoFocus}
      title={(u) => u.name ?? u.email}
      description={() => "User details"}
    >
      {(u) => (
        <>
          <DetailSection title="Account">
            <DetailGrid>
              <DetailField label="Name" value={u.name} />
              <DetailField label="Email">
                <a
                  href={`mailto:${u.email}`}
                  className="text-primary hover:underline"
                >
                  {u.email}
                </a>
              </DetailField>
              <DetailField label="Role">
                {isOfficerRole(u.role) ? (
                  <OfficerBadge />
                ) : (
                  <Badge variant="secondary">Member</Badge>
                )}
              </DetailField>
              <DetailField label="User ID" value={u.id} />
              <DetailField label="Joined" value={formatDateTime(u.createdAt)} />
              <DetailField
                label="Last updated"
                value={formatDateTime(u.updatedAt)}
              />
            </DetailGrid>
          </DetailSection>

          <DetailSection
            title={`Teams (${u.teamMemberships.length})`}
            aria-label="Team memberships"
          >
            {u.teamMemberships.length === 0 ? (
              <DetailEmpty>Not a member of any team.</DetailEmpty>
            ) : (
              <ul className="space-y-2">
                {u.teamMemberships.map((membership) => (
                  <li
                    key={membership.id}
                    className="flex items-center justify-between gap-2 rounded-md border p-3"
                  >
                    <span className="min-w-0 truncate text-sm font-medium">
                      {membership.team.name}
                    </span>
                    <Badge variant="secondary">{membership.role}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </DetailSection>

          <DeleteMemberAccount viewer={viewer} user={u} onDeleted={onDeleted} />
        </>
      )}
    </DetailSheet>
  );
}
