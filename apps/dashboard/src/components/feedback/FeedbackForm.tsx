"use client";

import * as React from "react";
import { useActionState } from "react";
import { CircleCheck, Star } from "lucide-react";

import { submitFeedback } from "@/app/feedback/[id]/actions";
import { Segmented } from "@/components/common/Segmented";
import { SubmitButton } from "@/components/SubmitButton";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const WORDS = ["", "Not great", "Okay", "Good", "Really good", "Loved it"];

const CATEGORIES = [
  // Toggle items need a real value, so "no topic" is NONE and posts as "".
  { value: "NONE", label: "Skip" },
  { value: "OVERALL", label: "Overall" },
  { value: "CONTENT", label: "Content" },
  { value: "LOGISTICS", label: "Logistics" },
  { value: "ENGAGEMENT", label: "Engagement" },
] as const;

/**
 * Rate a meeting. Shared by the /feedback/:id page (where the feedback QR code
 * lands) and the Rate dialog on the member home.
 *
 * Still a plain form posting to the submitFeedback server action, so the
 * one-per-meeting and must-have-attended rules stay on the server. The star
 * and topic pickers write into hidden inputs for that form.
 */
export function FeedbackForm({
  meetingId,
  initialRating = 0,
  onDone,
}: {
  meetingId: number;
  /** Pre-picked from a star link in the feedback email. */
  initialRating?: number;
  /** Called once the feedback is saved. */
  onDone?: () => void;
}) {
  const [state, formAction] = useActionState(submitFeedback, {});
  const [rating, setRating] = React.useState(initialRating);
  const [category, setCategory] = React.useState<string>("NONE");

  React.useEffect(() => {
    if (state.success) onDone?.();
  }, [state.success, onDone]);

  if (state.success) {
    return (
      <div
        role="status"
        className="flex flex-col items-center gap-2 py-6 text-center"
      >
        <CircleCheck className="size-12 text-primary" aria-hidden="true" />
        <p className="font-semibold">Thanks! Your feedback was sent.</p>
        <p className="text-sm text-muted-foreground">You can close this now.</p>
      </div>
    );
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="meetingId" value={meetingId} />
      <input type="hidden" name="rating" value={rating || ""} />
      <input
        type="hidden"
        name="category"
        value={category === "NONE" ? "" : category}
      />

      <FieldGroup className="gap-5">
        <FieldSet>
          <FieldLegend variant="label">How was it?</FieldLegend>
          <div
            role="radiogroup"
            aria-label="Rating"
            className="flex items-center gap-1"
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={rating === n}
                aria-label={`${n} star${n === 1 ? "" : "s"}`}
                onClick={() => setRating(rating === n ? 0 : n)}
                className="rounded-lg p-1 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <Star
                  className={cn(
                    "size-9 transition-colors",
                    n <= rating
                      ? "fill-warning text-warning"
                      : "text-muted-foreground/50",
                  )}
                />
              </button>
            ))}
            <span className="ml-2 text-sm text-muted-foreground">
              {rating ? WORDS[rating] : "Tap a star"}
            </span>
          </div>
        </FieldSet>

        <FieldSet>
          <FieldLegend variant="label">Mostly about</FieldLegend>
          <Segmented
            label="Mostly about"
            variant="chips"
            value={category}
            onValueChange={setCategory}
            options={CATEGORIES.map((c) => ({
              value: c.value,
              label: c.label,
            }))}
          />
        </FieldSet>

        <Field>
          <FieldLabel htmlFor={`feedback-comment-${meetingId}`}>
            Anything to add? (optional)
          </FieldLabel>
          <Textarea
            id={`feedback-comment-${meetingId}`}
            name="comment"
            rows={3}
            placeholder="What worked, what didn't"
          />
        </Field>

        <Field orientation="horizontal" className="rounded-xl border p-3">
          <FieldContent>
            <FieldLabel htmlFor={`feedback-anon-${meetingId}`}>
              Send anonymously
            </FieldLabel>
            <FieldDescription>
              Officers won&apos;t see your name on this response.
            </FieldDescription>
          </FieldContent>
          {/* Radix submits a named Switch like a checkbox: "on" or absent,
              which is what createFeedbackSchema reads. */}
          <Switch id={`feedback-anon-${meetingId}`} name="isAnonymous" />
        </Field>

        {state.error && (
          <p className="text-sm text-destructive">{state.error}</p>
        )}

        <SubmitButton size="lg" pendingLabel="Sending…">
          Send feedback
        </SubmitButton>
      </FieldGroup>
    </form>
  );
}
