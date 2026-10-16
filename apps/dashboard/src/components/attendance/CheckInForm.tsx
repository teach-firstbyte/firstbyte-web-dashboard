"use client";

import { useState } from "react";
import { CircleCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { withBasePath } from "@/lib/paths";

type Status = "idle" | "submitting" | "success" | "error";

/**
 * Type the 6-character code from the projector to check in.
 *
 * Shared by the /check-in/:id page (where the QR code lands, with the code
 * already filled in) and the Check in dialog on the member home. Only the
 * frame around it differs; the request and the messages are the same.
 */
export function CheckInForm({
  meetingId,
  meetingTitle,
  initialCode,
  onCheckedIn,
}: {
  meetingId: number;
  meetingTitle: string;
  initialCode: string;
  /** Called after a successful check-in, e.g. to refresh the page behind. */
  onCheckedIn?: () => void;
}) {
  const [code, setCode] = useState(initialCode.toUpperCase());
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function handleCheckIn(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setMessage("");
    try {
      const res = await fetch(withBasePath("/api/attendance/check-in"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingId, code }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Check-in failed");
      }
      setStatus("success");
      onCheckedIn?.();
    } catch (err) {
      setStatus("error");
      const text = err instanceof Error ? err.message : "Something went wrong";
      // The route's wording is for developers; say what to do instead.
      setMessage(
        text === "Invalid check-in code"
          ? "That code doesn't match. Check the screen and try again."
          : text,
      );
    }
  }

  if (status === "success") {
    return (
      <div
        role="status"
        className="flex flex-col items-center gap-2 py-4 text-center"
      >
        <CircleCheck className="size-14 text-primary" aria-hidden="true" />
        <p className="text-xl font-bold">You&apos;re checked in</p>
        <p className="text-sm text-muted-foreground">{meetingTitle}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleCheckIn} className="flex flex-col gap-4">
      <Field data-invalid={status === "error" || undefined}>
        <FieldLabel htmlFor={`check-in-code-${meetingId}`}>
          Code on the screen
        </FieldLabel>
        <Input
          id={`check-in-code-${meetingId}`}
          value={code}
          onChange={(e) =>
            setCode(
              e.target.value
                .toUpperCase()
                .replace(/[^A-Z0-9]/g, "")
                .slice(0, 6),
            )
          }
          placeholder="ABC123"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          aria-invalid={status === "error"}
          className="h-14 text-center font-mono text-2xl font-bold tracking-[0.3em] md:text-2xl"
        />
        {status === "error" ? (
          <FieldError>{message}</FieldError>
        ) : (
          <FieldDescription>
            It&apos;s under the QR code on the projector.
          </FieldDescription>
        )}
      </Field>
      <Button
        type="submit"
        size="lg"
        pending={status === "submitting"}
        pendingLabel="Checking in…"
        disabled={code.trim().length < 6}
      >
        Check in
      </Button>
    </form>
  );
}
