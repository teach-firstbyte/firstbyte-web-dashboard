"use client";

import { useActionState, useRef, useState } from "react";

import { deleteAccount } from "@/app/settings/actions";
import { SubmitButton } from "@/components/SubmitButton";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

/**
 * The Settings "Delete account" block: what happens, then a button that opens
 * a dialog where you type your email to confirm.
 *
 * The typed email is checked here only to enable the button. deleteOwnAccount
 * checks it again, because a form's input is never trusted.
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
  const [typed, setTyped] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = typed.trim().toLowerCase() === email.toLowerCase();

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

      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          // Stay open while the request runs, so its error has somewhere to
          // show.
          if (pending) return;
          setOpen(next);
          if (!next) setTyped("");
        }}
      >
        <AlertDialogContent
          size="sm"
          // AlertDialog focuses Cancel by default. Typing is the only way
          // forward here, so start in the email box instead.
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            inputRef.current?.focus();
          }}
        >
          <form action={formAction} className="contents">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete your account?</AlertDialogTitle>
              <AlertDialogDescription>
                You can&apos;t undo this. Type{" "}
                <span className="font-medium break-words text-foreground">
                  {email}
                </span>{" "}
                to confirm.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Field>
              <FieldLabel htmlFor="confirmEmail" className="sr-only">
                Your email
              </FieldLabel>
              <Input
                ref={inputRef}
                id="confirmEmail"
                name="confirmEmail"
                type="email"
                autoComplete="off"
                placeholder={email}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
              />
            </Field>
            {state.error && (
              <p role="alert" className="text-sm break-words text-destructive">
                {state.error}
              </p>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel type="button" disabled={pending}>
                Cancel
              </AlertDialogCancel>
              <SubmitButton
                variant="destructive"
                disabled={!matches}
                pendingLabel="Deleting…"
              >
                Delete account
              </SubmitButton>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
