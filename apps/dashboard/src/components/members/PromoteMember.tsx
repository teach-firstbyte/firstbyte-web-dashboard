"use client";

import * as React from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DetailSection } from "@/components/ui/detail";
import { Button } from "@/components/ui/button";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { promotableRoles } from "@/lib/auth/accountPolicy";
import type { OfficerRoleValue } from "@/lib/auth/roles";
import { ROLE } from "@/lib/enums";
import { withBasePath } from "@/lib/paths";
import type { User } from "@/types/dashboard";

/**
 * The words for each role a person can be promoted to: the name on the
 * button, the name with "a" or "an" for the dialog and toast, and what the
 * role gives them.
 */
const PROMOTION_COPY: Record<
  OfficerRoleValue,
  { name: string; withArticle: string; access: string }
> = {
  [ROLE.NORTHEASTERN_ADMIN]: {
    name: "officer",
    withArticle: "an officer",
    access:
      "They get the officer dashboard and can see and change members, meetings and attendance.",
  },
  [ROLE.SUPER_ADMIN]: {
    name: "super admin",
    withArticle: "a super admin",
    access:
      "They can do everything an officer can, and also delete officers' accounts, manage invite-only teams and promote other people.",
  },
};

/**
 * The "Promote" block in a member's panel, for super admins.
 *
 * One button per role in promotableRoles, the same rule promoteUser enforces
 * on the server. Everyone else, and anyone who can't be promoted further,
 * sees nothing: there is no "why not" line, because officers and members
 * should not see the option at all.
 */
export function PromoteMember({
  viewer,
  user,
  onPromoted,
}: {
  viewer: { id: number; role: string };
  user: User;
  /** Called after a successful promotion, e.g. to close the panel. */
  onPromoted: () => void;
}) {
  // The role whose confirm dialog is open, or null when none is.
  const [confirming, setConfirming] = React.useState<OfficerRoleValue | null>(
    null,
  );
  const action = useAsyncAction();
  const who = user.name ?? user.email;

  const roles = promotableRoles(viewer, user);
  if (roles.length === 0) return null;

  const copy = confirming ? PROMOTION_COPY[confirming] : undefined;

  const confirm = () =>
    action.run(async () => {
      if (!confirming || !copy) return;
      const res = await fetch(withBasePath(`/api/users/${user.id}/role`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: confirming }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to change the role.");
      }

      setConfirming(null);
      onPromoted();
      toast(`${who} is now ${copy.withArticle}`, {
        description:
          "They see the new dashboard the next time they load a page.",
      });
    });

  return (
    <DetailSection title="Promote">
      <div className="flex flex-wrap gap-2">
        {roles.map((role) => (
          <Button
            key={role}
            variant="outline"
            onClick={() => {
              action.setError(null);
              setConfirming(role);
            }}
          >
            Make {PROMOTION_COPY[role].name}
          </Button>
        ))}
      </div>

      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(open) => {
          if (!open) setConfirming(null);
        }}
        title={copy ? `Make ${who} ${copy.withArticle}?` : "Promote"}
        message={copy?.access}
        confirmLabel={copy ? `Make ${copy.name}` : "Promote"}
        pending={action.pending}
        error={action.error}
        onConfirm={confirm}
      />
    </DetailSection>
  );
}
