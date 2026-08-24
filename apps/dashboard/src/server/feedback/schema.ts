import { FeedbackCategory } from "@prisma/client";
import { z } from "zod";
import { idParam, nullableText } from "@/server/validation";

/**
 * An HTML form submits every field as a string, and an untouched <select> or
 * <input> arrives as "" rather than absent. Treating "" as a value is exactly
 * the bug this replaces: validateFeedbackInput assigned `category` outside the
 * branch that checked it, so a blank category reached Prisma as "" and the
 * write failed with "Failed to submit feedback" -- for the form's own default
 * option.
 */
const blankToNull = (v: unknown) =>
  v === "" || v === undefined || v === null ? null : v;

const RATING_RANGE = "rating must be an integer between 1 and 5";

const rating = z.preprocess(
  blankToNull,
  z.coerce
    .number()
    .int(RATING_RANGE)
    .min(1, RATING_RANGE)
    .max(5, RATING_RANGE)
    .nullable(),
);

const category = z.preprocess(
  blankToNull,
  z
    .enum(FeedbackCategory, {
      error: `Invalid category. Must be one of: ${Object.values(FeedbackCategory).join(", ")}`,
    })
    .nullable(),
);

/** An unchecked checkbox is absent from FormData; a checked one sends "on". */
const isAnonymous = z.preprocess(
  (v) => v === true || v === "true" || v === "on",
  z.boolean(),
);

export const createFeedbackSchema = z.object({
  meetingId: idParam,
  rating,
  category,
  comment: nullableText,
  isAnonymous,
});

export type CreateFeedbackInput = z.infer<typeof createFeedbackSchema>;

/**
 * The officer edit path. Every field optional, and `meetingId` is absent on
 * purpose -- moving feedback to a different meeting is not an edit.
 */
export const updateFeedbackSchema = z
  .object({ rating, category, comment: nullableText, isAnonymous })
  .partial()
  .refine(
    (v) => Object.keys(v).length > 0,
    "Provide at least one of: rating, comment, category, isAnonymous",
  );

export type UpdateFeedbackInput = z.infer<typeof updateFeedbackSchema>;
