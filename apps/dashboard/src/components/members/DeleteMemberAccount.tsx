"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";

import { TypeToConfirmDialog } from "@/components/common/TypeToConfirmDialog";
import { DetailSection } from "@/components/ui/detail";
import { Button } from "@/components/ui/button";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { canDeleteAccount } from "@/lib/auth/accountPolicy";
import { isOfficerRole } from "@/lib/auth/roles";
import { withBasePath } from "@/lib/paths";
import type { User } from "@/types/dashboard";

/**
 * The "Delete account" block at the bottom of a member's panel, for officers.
 *
 * Whether the button shows is canDeleteAccount, the same rule
 * deleteAccountAsOfficer enforces on the server. When it doesn't show, a line
 * says why, so an officer isn't left wondering where the button went.
 */
export function DeleteMemberAccount({
  viewer,
  user,
  onDeleted,
}: {
  viewer: { id: number; role: string };
  user: User;
  /** Called after a successful delete, e.g. to close the panel. */
  onDeleted: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const action = useAsyncAction();
  const who = user.name ?? user.email;

  if (user.id === viewer.id) {
    return (
      <DetailSection title="Delete account">
        <p className="text-sm text-muted-foreground">
          To delete your own account, use{" "}
          <Link href="/settings#delete-account" className="underline">
            Settings
          </Link>
          .
        </p>
      </DetailSection>
    );
  }

  if (!canDeleteAccount(viewer, user)) {
    return isOfficerRole(user.role) ? (
      <DetailSection title="Delete account">
        <p className="text-sm text-muted-foreground">
          Only a super admin can delete another officer&apos;s account.
        </p>
      </DetailSection>
    ) : null;
  }

  const confirm = (typed: string) =>
    action.run(async () => {
      const res = await fetch(withBasePath(`/api/users/${user.id}`), {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmEmail: typed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to delete the account.");
      }

      setOpen(false);
      onDeleted();
      if (data.loginRemoved === false) {
        toast(`${who}'s account was deleted`, {
          description:
            "Their sign-in could not be removed. If they sign in again, they get a new, empty account.",
        });
      } else {
        toast(`${who}'s account was deleted`);
      }
    });

  return (
    <DetailSection title="Delete account">
      <div className="flex flex-col gap-3 text-sm">
        <p className="text-muted-foreground">
          Removes their personal details, teams and future meeting sign-ups, and
          their sign-in. Past attendance and feedback stay, shown as
          &ldquo;Former member&rdquo;.
        </p>
        <div>
          <Button
            variant="outline"
            className="text-destructive"
            onClick={() => {
              action.setError(null);
              setOpen(true);
            }}
          >
            Delete account
          </Button>
        </div>
      </div>

      <TypeToConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Delete ${who}'s account?`}
        message={
          <>
            You can&apos;t undo this. Type{" "}
            <span className="font-medium text-foreground">{user.email}</span> to
            confirm.
          </>
        }
        phrase={user.email}
        inputLabel="Their email"
        confirmLabel="Delete account"
        pendingLabel="Deleting…"
        pending={action.pending}
        error={action.error}
        onConfirm={confirm}
      />
    </DetailSection>
  );
}
