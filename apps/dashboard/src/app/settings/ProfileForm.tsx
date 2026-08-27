"use client";

import { useActionState } from "react";
import { updateProfile } from "./actions";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/SubmitButton";

type ProfileDefaults = {
  name: string | null;
  preferredName: string | null;
  pronouns: string | null;
  gradYear: number | null;
  major: string | null;
};

export function ProfileForm({ defaults }: { defaults: ProfileDefaults }) {
  const [state, formAction] = useActionState(updateProfile, {});

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="name" className="block text-sm font-medium">
          Name
        </label>
        <Input id="name" name="name" defaultValue={defaults.name ?? ""} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="preferredName" className="block text-sm font-medium">
            Preferred name
          </label>
          <Input
            id="preferredName"
            name="preferredName"
            defaultValue={defaults.preferredName ?? ""}
            placeholder="What should we call you?"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="pronouns" className="block text-sm font-medium">
            Pronouns
          </label>
          <Input
            id="pronouns"
            name="pronouns"
            defaultValue={defaults.pronouns ?? ""}
            placeholder="they/them"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="gradYear" className="block text-sm font-medium">
            Graduation year
          </label>
          <Input
            id="gradYear"
            name="gradYear"
            type="number"
            inputMode="numeric"
            defaultValue={defaults.gradYear ?? ""}
            placeholder="2029"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="major" className="block text-sm font-medium">
            Major
          </label>
          <Input
            id="major"
            name="major"
            defaultValue={defaults.major ?? ""}
            placeholder="Computer Science"
          />
        </div>
      </div>

      <SubmitButton pendingLabel="Saving...">Save</SubmitButton>
      {state?.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}
      {state?.success && (
        <p className="text-sm text-muted-foreground">Profile updated</p>
      )}
    </form>
  );
}
