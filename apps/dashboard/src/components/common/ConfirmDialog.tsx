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

/**
 * "Are you sure?" for actions that can't be undone, composed from the shadcn
 * AlertDialog. Unlike a plain dialog it does not close on an outside click:
 * the person has to choose.
 *
 * Use it sparingly. For anything reversible, act at once and offer Undo in a
 * toast instead.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  message,
  confirmLabel,
  destructive = false,
  pending = false,
  error,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  /** Red confirm button for things that delete or deny. */
  destructive?: boolean;
  pending?: boolean;
  error?: string | null;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle className="break-words">{title}</AlertDialogTitle>
          <AlertDialogDescription className="break-words">
            {message}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p className="text-sm break-words text-destructive">{error}</p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          {/* A plain Button rather than AlertDialogAction, so the dialog stays
              open while the request runs and can show its error. */}
          <Button
            variant={destructive ? "destructive" : "default"}
            pending={pending}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
