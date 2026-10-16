"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { updateProfile } from "@/app/settings/actions";
import { SubmitButton } from "@/components/SubmitButton";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type ProfileDefaults = {
  name: string | null;
  preferredName: string | null;
  pronouns: string | null;
  gradYear: number | null;
  major: string | null;
  email: string;
};

const MAJORS = [
  "Computer Science",
  "Data Science",
  "Computer Engineering",
  "Cybersecurity",
  "Mathematics",
  "Bioengineering",
];

/** Your name and details. Posts to the existing updateProfile action. */
export function ProfileForm({ defaults }: { defaults: ProfileDefaults }) {
  const [state, formAction] = useActionState(updateProfile, {});

  useEffect(() => {
    if (state.success) toast("Profile saved");
  }, [state]);

  return (
    <form action={formAction}>
      <FieldGroup className="gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="name">Full name</FieldLabel>
            <Input
              id="name"
              name="name"
              defaultValue={defaults.name ?? ""}
              autoComplete="name"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="preferredName">Preferred name</FieldLabel>
            <Input
              id="preferredName"
              name="preferredName"
              defaultValue={defaults.preferredName ?? ""}
              placeholder="What should we call you?"
            />
            <FieldDescription>
              Used in greetings and on rosters.
            </FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="pronouns">Pronouns</FieldLabel>
            <Input
              id="pronouns"
              name="pronouns"
              list="pronoun-options"
              defaultValue={defaults.pronouns ?? ""}
              placeholder="Optional"
            />
            <datalist id="pronoun-options">
              <option value="she/her" />
              <option value="he/him" />
              <option value="they/them" />
            </datalist>
          </Field>
          <Field>
            <FieldLabel htmlFor="gradYear">Graduation year</FieldLabel>
            <Input
              id="gradYear"
              name="gradYear"
              type="number"
              inputMode="numeric"
              defaultValue={defaults.gradYear ?? ""}
              placeholder="2029"
            />
          </Field>
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="major">Major</FieldLabel>
            <Input
              id="major"
              name="major"
              list="major-options"
              defaultValue={defaults.major ?? ""}
            />
            <datalist id="major-options">
              {MAJORS.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </Field>
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              value={defaults.email}
              readOnly
              className="bg-muted text-muted-foreground"
            />
            <FieldDescription>
              The email you sign in with. It can&apos;t be changed here.
            </FieldDescription>
          </Field>
        </div>
        {state?.error && (
          <p className="text-sm text-destructive">{state.error}</p>
        )}
        <div>
          <SubmitButton pendingLabel="Saving…">Save profile</SubmitButton>
        </div>
      </FieldGroup>
    </form>
  );
}
