"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  approveIssueAction,
  withdrawApprovalAction,
} from "@/app/newsletter/actions";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import type { NewsletterIssueStatusValue } from "@/lib/enums";

/**
 * Final approval, for the Brand and Marketing lead, the President or the VP.
 * Teams still in draft are left out of the issue.
 */
export function ApprovePanel({
  issueId,
  status,
  note,
  draftsWaiting,
}: {
  issueId: number;
  status: NewsletterIssueStatusValue;
  note: string | null;
  draftsWaiting: number;
}) {
  const router = useRouter();
  const [text, setText] = React.useState(note ?? "");
  const [pending, start] = React.useTransition();

  const run = (fn: () => Promise<{ error?: string }>, done: string) =>
    start(async () => {
      const r = await fn();
      if (r.error) toast.error(r.error);
      else {
        toast.success(done);
        router.refresh();
      }
    });

  if (status === "APPROVED") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">
          You&apos;ve approved this issue. It goes out at the next send.
        </p>
        <Button
          variant="outline"
          pending={pending}
          onClick={() =>
            run(() => withdrawApprovalAction(issueId), "Approval withdrawn.")
          }
        >
          Withdraw approval
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Field>
        <FieldLabel htmlFor="issue-note">Note at the top (optional)</FieldLabel>
        <Textarea
          id="issue-note"
          value={text}
          maxLength={300}
          rows={2}
          placeholder="For example: a collab that isn't a dashboard meeting yet"
          onChange={(e) => setText(e.target.value)}
        />
        <FieldDescription>Shown under the title in the email.</FieldDescription>
      </Field>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {draftsWaiting > 0
            ? `${draftsWaiting} team${draftsWaiting === 1 ? " hasn't" : "s haven't"} finished. Approving now leaves ${draftsWaiting === 1 ? "it" : "them"} out of this issue.`
            : "Every team has approved or skipped."}
        </p>
        <Button
          pending={pending}
          onClick={() =>
            run(
              () => approveIssueAction({ issueId, note: text }),
              "Approved. It goes out at the next send.",
            )
          }
        >
          Give final approval
        </Button>
      </div>
    </div>
  );
}
