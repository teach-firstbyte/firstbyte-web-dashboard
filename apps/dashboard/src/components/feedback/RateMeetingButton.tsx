"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button, type ButtonProps } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FeedbackForm } from "./FeedbackForm";

/**
 * "Rate it" on the member home: the same form as /feedback/:id, in a dialog.
 * Refreshes the page behind it once sent, so the meeting leaves the list.
 */
export function RateMeetingButton({
  meetingId,
  meetingTitle,
  label = "Rate",
  variant = "outline",
  size = "sm",
}: {
  meetingId: number;
  meetingTitle: string;
  label?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
}) {
  const router = useRouter();
  const [session, setSession] = React.useState(0);
  const onDone = React.useCallback(() => router.refresh(), [router]);

  return (
    <Dialog onOpenChange={(open) => open && setSession((s) => s + 1)}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size}>
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rate this meeting</DialogTitle>
          <DialogDescription>{meetingTitle}</DialogDescription>
        </DialogHeader>
        <FeedbackForm key={session} meetingId={meetingId} onDone={onDone} />
      </DialogContent>
    </Dialog>
  );
}
