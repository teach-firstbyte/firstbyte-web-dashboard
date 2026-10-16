"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarX2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { withBasePath } from "@/lib/paths";

async function send(
  meetingId: number,
  method: "POST" | "DELETE",
  body?: unknown,
) {
  const res = await fetch(withBasePath(`/api/meetings/${meetingId}/excuse`), {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error ?? "That didn't save. Try again.");
  }
}

/**
 * "I can't make it" on a meeting a member is expected at, before it starts.
 * It excuses them straight away, with an optional reason for the officers.
 *
 * Once excused, it says so, with Undo while the meeting hasn't started. An
 * excuse an officer gave has no Undo: only an officer can change it.
 *
 * Render it only for meetings that haven't started; the server refuses after.
 */
export function ExcuseButton({
  meetingId,
  meetingTitle,
  status,
  selfMarked,
}: {
  meetingId: number;
  meetingTitle: string;
  /** The member's own record for this meeting, if any. */
  status: string | null;
  selfMarked: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [pending, setPending] = React.useState(false);

  if (status === "PRESENT") return null;

  if (status === "EXCUSED") {
    return (
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        <CalendarX2 className="size-4" aria-hidden="true" />
        {selfMarked ? "You can't make it" : "An officer excused you"}
        {selfMarked && (
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0"
            disabled={pending}
            onClick={async () => {
              setPending(true);
              try {
                await send(meetingId, "DELETE");
                toast("Got it, you're expected again.");
                router.refresh();
              } catch (e) {
                toast.error(
                  e instanceof Error ? e.message : "Couldn't undo that.",
                );
              } finally {
                setPending(false);
              }
            }}
          >
            Undo
          </Button>
        )}
      </span>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    try {
      await send(meetingId, "POST", { reason });
      setOpen(false);
      setReason("");
      toast("Thanks for letting us know. The officers can see it.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That didn't save.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          I can&apos;t make it
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Can&apos;t make it?</DialogTitle>
            <DialogDescription>
              {meetingTitle}. You&apos;ll be excused, so it won&apos;t count
              against your attendance.
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor={`excuse-reason-${meetingId}`}>
              Reason (optional)
            </FieldLabel>
            <Textarea
              id={`excuse-reason-${meetingId}`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="For example: exam that evening"
            />
            <FieldDescription>Only officers see this.</FieldDescription>
          </Field>
          <DialogFooter>
            <Button type="submit" pending={pending} pendingLabel="Saving…">
              Let the officers know
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
