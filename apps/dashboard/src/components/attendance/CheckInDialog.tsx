"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { QrCode } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CheckInForm } from "./CheckInForm";

/**
 * "Check in" on the member home. Opens the same form the QR code leads to, so
 * a member who can't scan types the code without leaving the page.
 */
export function CheckInDialog({
  meetingId,
  meetingTitle,
  className,
}: {
  meetingId: number;
  meetingTitle: string;
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  // Remounted per open, so a finished check-in doesn't reopen on "success".
  const [session, setSession] = React.useState(0);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setSession((s) => s + 1);
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button size="lg" className={className}>
          <QrCode data-icon="inline-start" />
          Check in
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Check in</DialogTitle>
          <DialogDescription>{meetingTitle}</DialogDescription>
        </DialogHeader>
        <CheckInForm
          key={session}
          meetingId={meetingId}
          meetingTitle={meetingTitle}
          initialCode=""
          onCheckedIn={() => router.refresh()}
        />
      </DialogContent>
    </Dialog>
  );
}
