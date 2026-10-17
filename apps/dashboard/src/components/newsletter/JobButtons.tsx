"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Play, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  deleteIssueAction,
  runDraftJobAction,
  sendIssueAction,
  type JobResult,
} from "@/app/newsletter/actions";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";

function useJob() {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const run = (fn: () => Promise<JobResult>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(r.message ?? "Done.");
      after?.();
      router.refresh();
    });
  return { pending, run };
}

/**
 * Preview-only stand-ins for the scheduled jobs. Vercel only runs scheduled
 * jobs on production, so these call the same code by hand.
 */
export function RunDraftJobButton({ label }: { label: string }) {
  const { pending, run } = useJob();
  return (
    <Button
      variant="outline"
      size="sm"
      pending={pending}
      pendingLabel="Drafting… (up to a minute)"
      onClick={() => run(runDraftJobAction)}
    >
      <Play aria-hidden="true" />
      {label}
    </Button>
  );
}

export function SendNowButton({ issueId }: { issueId: number }) {
  const { pending, run } = useJob();
  return (
    <Button
      size="sm"
      pending={pending}
      pendingLabel="Sending…"
      onClick={() => run(() => sendIssueAction(issueId))}
    >
      <Send aria-hidden="true" />
      Send now
    </Button>
  );
}

export function DeleteIssueButton({ issueId }: { issueId: number }) {
  const { pending, run } = useJob();
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Trash2 aria-hidden="true" />
        Start over
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Delete this week's issue?"
        message="Every team's draft and approval for this week is deleted, so you can run the draft job again from scratch. Preview only."
        confirmLabel="Delete"
        destructive
        pending={pending}
        onConfirm={() =>
          run(
            () => deleteIssueAction(issueId),
            () => setOpen(false),
          )
        }
      />
    </>
  );
}
