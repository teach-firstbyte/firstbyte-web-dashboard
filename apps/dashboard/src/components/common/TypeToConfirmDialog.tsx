"use client";

import * as React from "react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

/**
 * ConfirmDialog's stricter sibling, for the few actions that are hard to take
 * back, like deleting an account. The person has to type `phrase` (an email,
 * say) before the confirm button turns on, so a stray click can't do it.
 *
 * The typed text is checked here only to enable the button. Whatever runs in
 * `onConfirm` must check it again on the server -- it gets the text for that.
 */
export function TypeToConfirmDialog({
  open,
  onOpenChange,
  title,
  message,
  phrase,
  inputLabel,
  confirmLabel,
  pendingLabel,
  pending = false,
  error,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Shown above the box. Say what happens and what to type. */
  message: React.ReactNode;
  /** What must be typed. Compared ignoring case and outer spaces. */
  phrase: string;
  /** Read by screen readers; the box has no visible label. */
  inputLabel: string;
  confirmLabel: string;
  pendingLabel?: string;
  pending?: boolean;
  error?: string | null;
  onConfirm: (typed: string) => void;
}) {
  const [typed, setTyped] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  const matches = typed.trim().toLowerCase() === phrase.toLowerCase();

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        // Stay open while the request runs, so its error has somewhere to
        // show.
        if (pending) return;
        onOpenChange(next);
        if (!next) setTyped("");
      }}
    >
      <AlertDialogContent
        size="sm"
        // AlertDialog focuses Cancel by default. Typing is the only way
        // forward here, so start in the box instead.
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          inputRef.current?.focus();
        }}
      >
        <form
          className="contents"
          onSubmit={(e) => {
            e.preventDefault();
            if (matches && !pending) onConfirm(typed.trim());
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="break-words">{title}</AlertDialogTitle>
            <AlertDialogDescription className="break-words">
              {message}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Field>
            <FieldLabel htmlFor="type-to-confirm" className="sr-only">
              {inputLabel}
            </FieldLabel>
            <Input
              ref={inputRef}
              id="type-to-confirm"
              autoComplete="off"
              placeholder={phrase}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
            />
          </Field>
          {error && (
            <p role="alert" className="text-sm break-words text-destructive">
              {error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={pending}>
              Cancel
            </AlertDialogCancel>
            {/* A plain Button rather than AlertDialogAction, so the dialog
                stays open while the request runs and can show its error. */}
            <Button
              type="submit"
              variant="destructive"
              disabled={!matches}
              pending={pending}
              pendingLabel={pendingLabel}
            >
              {confirmLabel}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
