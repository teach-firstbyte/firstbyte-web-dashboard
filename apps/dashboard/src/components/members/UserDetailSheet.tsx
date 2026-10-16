"use client";

import { Badge } from "@/components/ui/badge";
import { DetailSheet } from "@/components/ui/detail-sheet";
import {
  DetailEmpty,
  DetailField,
  DetailGrid,
  DetailSection,
} from "@/components/ui/detail";
import { formatDate } from "@/lib/format";
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
            {/* The title is the name, or the email when there is no name. In
                that case the Email field would only repeat the title. */}
            <DetailGrid>
              {u.name && (
                <DetailField label="Email" className="sm:col-span-2">
                  <a
                    href={`mailto:${u.email}`}
                    className="text-primary hover:underline"
                  >
                    {u.email}
                  </a>
                </DetailField>
              )}
              <DetailField label="Role">
                {isOfficerRole(u.role) ? (
                  <OfficerBadge />
                ) : (
                  <Badge variant="secondary">Member</Badge>
                )}
              </DetailField>
              <DetailField label="Joined" value={formatDate(u.createdAt)} />
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
