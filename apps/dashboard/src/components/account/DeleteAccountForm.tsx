"use client";

import { startTransition, useActionState, useState } from "react";

import { deleteAccount } from "@/app/settings/actions";
import { TypeToConfirmDialog } from "@/components/common/TypeToConfirmDialog";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";

/**
 * The Settings "Delete account" block: what happens, then a button that opens
 * a dialog where you type your email to confirm.
 *
 * The dialog checks the typed email only to enable its button.
 * deleteOwnAccount checks it again, because a form's input is never trusted.
 *
 * `isLastOfficer` replaces the button with a message. The server refuses that
 * case too; this only saves the person a dialog that can't succeed.
 */
export function DeleteAccountForm({
  email,
  isLastOfficer,
}: {
  email: string;
  isLastOfficer: boolean;
}) {
  const [state, formAction, pending] = useActionState(deleteAccount, {});
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="text-muted-foreground">
        Use this if you are leaving FirstByte. You are signed out, and you
        can&apos;t sign in to this account again.
      </p>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-muted-foreground">
        <li>
          Your name, email, pronouns, graduation year and major are removed.
        </li>
        <li>
          You leave all your teams, and the rosters of meetings that
          haven&apos;t happened yet.
        </li>
        <li>
          Past attendance and feedback stay, so meeting totals don&apos;t
          change. Named feedback shows &ldquo;Former member&rdquo; instead of
          your name.
        </li>
        <li>
          You can sign up again later with the same email. It will be a new
          account that an officer has to approve.
        </li>
      </ul>

      {isLastOfficer ? (
        <Banner>
          You are the last officer. Make someone else an officer before you
          delete your account, so someone can still approve new members.
        </Banner>
      ) : (
        <div>
          <Button
            variant="outline"
            className="text-destructive"
            onClick={() => setOpen(true)}
          >
            Delete account
          </Button>
        </div>
      )}

      <TypeToConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Delete your account?"
        message={
          <>
            You can&apos;t undo this. Type{" "}
            <span className="font-medium text-foreground">{email}</span> to
            confirm.
          </>
        }
        phrase={email}
        inputLabel="Your email"
        confirmLabel="Delete account"
        pendingLabel="Deleting…"
        pending={pending}
        error={state.error}
        onConfirm={(typed) => {
          const form = new FormData();
          form.set("confirmEmail", typed);
          // Outside a <form action>, React needs the transition to track it.
          startTransition(() => formAction(form));
        }}
      />
    </div>
  );
}
