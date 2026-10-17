"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, X } from "lucide-react";
import { toast } from "sonner";

import {
  dismissHomeCardAction,
  recordReadAction,
  setApproverAction,
  setOptOutAction,
} from "@/app/newsletter/actions";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

/** Records that this member opened the issue, once, after it renders. */
export function MarkRead({
  issueId,
  via,
}: {
  issueId: number;
  via: "email" | "dashboard";
}) {
  React.useEffect(() => {
    void recordReadAction(issueId, via);
  }, [issueId, via]);
  return null;
}

/** The "new issue" card on the member home. */
export function NewsletterHomeCard({
  issueId,
  summary,
}: {
  issueId: number;
  summary: string;
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  return (
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-card bg-gradient-to-r from-primary/8 to-transparent p-5">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-12 shrink-0 place-content-center rounded-xl bg-primary/12 text-primary">
          <Mail className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="font-semibold">This week at FirstByte is out</p>
          <p className="text-sm text-muted-foreground">{summary}</p>
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          aria-label="Dismiss"
          onClick={() =>
            start(async () => {
              const r = await dismissHomeCardAction(issueId);
              if (r.error) toast.error(r.error);
              else router.refresh();
            })
          }
        >
          <X aria-hidden="true" />
          Dismiss
        </Button>
        <Button asChild size="sm">
          <Link href={`/newsletter/${issueId}`}>Read it</Link>
        </Button>
      </div>
    </section>
  );
}

/** A super admin turning final-approval rights on or off for an officer. */
export function ApproverSwitch({
  userId,
  name,
  approver,
  isSelf,
}: {
  userId: number;
  name: string;
  approver: boolean;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  return (
    <Switch
      checked={approver}
      disabled={pending || isSelf}
      aria-label={`${name} can give final approval`}
      title={isSelf ? "You can't change your own approver setting" : undefined}
      onCheckedChange={(next) =>
        start(async () => {
          const r = await setApproverAction({ userId, approver: next });
          if (r.error) toast.error(r.error);
          else router.refresh();
        })
      }
    />
  );
}

export function OptOutSwitch({ optOut }: { optOut: boolean }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  return (
    <div className="flex items-center gap-3">
      <Switch
        id="newsletter-subscribed"
        checked={!optOut}
        disabled={pending}
        onCheckedChange={(subscribed) =>
          start(async () => {
            const r = await setOptOutAction(!subscribed);
            if (r.error) toast.error(r.error);
            else {
              toast.success(
                subscribed
                  ? "You'll get the newsletter again."
                  : "Unsubscribed. You won't get the newsletter email.",
              );
              router.refresh();
            }
          })
        }
      />
      <label htmlFor="newsletter-subscribed" className="text-sm font-medium">
        Email me the weekly newsletter
      </label>
    </div>
  );
}
