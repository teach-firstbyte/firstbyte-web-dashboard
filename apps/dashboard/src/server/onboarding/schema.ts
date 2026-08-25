import { z } from "zod";

/**
 * Free-text fields go straight into the officer review queue, so they get a
 * ceiling rather than being an unbounded dumping ground.
 */
const MAX_TEXT = 100;
const GRAD_YEAR_SLACK = 10;

const blankToNull = (v: unknown) =>
  v === "" || v === undefined || v === null ? null : v;

/** Trimmed, capped, and blank-means-absent. */
const boundedText = (label: string) =>
  z.preprocess(
    (v) => {
      const trimmed = typeof v === "string" ? v.trim() : v;
      return blankToNull(trimmed);
    },
    z
      .string()
      .max(MAX_TEXT, `That ${label} is too long (max ${MAX_TEXT} characters).`)
      .nullable(),
  );

const thisYear = new Date().getFullYear();

const gradYear = z.preprocess(
  blankToNull,
  z.coerce
    .number({ error: "Enter a graduation year close to this one." })
    .int("Enter a graduation year close to this one.")
    .min(
      thisYear - GRAD_YEAR_SLACK,
      "Enter a graduation year close to this one.",
    )
    .max(
      thisYear + GRAD_YEAR_SLACK,
      "Enter a graduation year close to this one.",
    )
    .nullable(),
);

export const onboardingSchema = z.object({
  teamIds: z.array(z.coerce.number().int("Invalid team selection.")),
  preferredName: boundedText("name"),
  pronouns: boundedText("pronouns"),
  gradYear,
  major: boundedText("major"),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;

/**
 * Reads the form.
 *
 * Takes FormData rather than a plain object because the team checkboxes are a
 * repeated field and only getAll can read them. Duplicates are dropped here so
 * the upsert loop below cannot write the same membership twice.
 */
export function onboardingFormToInput(formData: FormData) {
  return {
    teamIds: [...new Set(formData.getAll("teams").map(String))],
    preferredName: formData.get("preferredName"),
    pronouns: formData.get("pronouns"),
    gradYear: formData.get("gradYear"),
    major: formData.get("major"),
  };
}

/** "submit" enters the review queue; "save" just stores the answers. */
export function onboardingIntent(formData: FormData): "submit" | "save" {
  return formData.get("intent") === "submit" ? "submit" : "save";
}
