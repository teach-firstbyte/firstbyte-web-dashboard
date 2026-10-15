"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Check, Circle } from "lucide-react";
import { toast } from "sonner";

import { updatePassword } from "@/app/settings/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Change your password, behind a button so it isn't the first thing on the
 * page. The rules shown live are the same ones updatePassword enforces.
 */
export function PasswordForm() {
  const [state, formAction] = useActionState(updatePassword, {});
  const [open, setOpen] = useState(false);
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state.success) return;
    toast("Password updated");
    formRef.current?.reset();
    setNext("");
    setAgain("");
    setOpen(false);
  }, [state]);

  if (!open) {
    return (
      <div>
        <Button variant="outline" onClick={() => setOpen(true)}>
          Change password
        </Button>
      </div>
    );
  }

  const rules = [
    { ok: next.length >= 6, label: "At least 6 characters" },
    {
      ok: next.length > 0 && next === again,
      label: "Both new passwords match",
    },
  ];

  return (
    <form ref={formRef} action={formAction}>
      <FieldGroup className="gap-4">
        <Field>
          <FieldLabel htmlFor="currentPassword">Current password</FieldLabel>
          <Input
            id="currentPassword"
            type="password"
            name="currentPassword"
            autoComplete="current-password"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="newPassword">New password</FieldLabel>
            <Input
              id="newPassword"
              type="password"
              name="newPassword"
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="confirmPassword">Type it again</FieldLabel>
            <Input
              id="confirmPassword"
              type="password"
              name="confirmPassword"
              autoComplete="new-password"
              value={again}
              onChange={(e) => setAgain(e.target.value)}
            />
          </Field>
        </div>
        <ul className="flex flex-col gap-1 text-sm">
          {rules.map((rule) => (
            <li
              key={rule.label}
              className={cn(
                "flex items-center gap-2 [&_svg]:size-3.5",
                rule.ok ? "text-primary" : "text-muted-foreground",
              )}
            >
              {rule.ok ? <Check /> : <Circle />}
              {rule.label}
            </li>
          ))}
        </ul>
        {state?.error && (
          <p className="text-sm text-destructive">{state.error}</p>
        )}
        <div className="flex gap-2">
          <SubmitButton pendingLabel="Updating…">Update password</SubmitButton>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
