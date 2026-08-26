import { AccountStatus } from "@prisma/client";
import { z } from "zod";
import { boundedText, gradYear } from "@/server/onboarding/schema";
import { nullableText } from "@/server/validation";

/**
 * Email is stored and compared as given. Normalizing case would be a real
 * improvement, but it would also silently merge existing rows that differ only
 * by case, so it belongs in its own change with a migration.
 */
const email = z
  .string({ error: "Email and name are required" })
  .trim()
  .min(1, "Email and name are required")
  .email("That is not a valid email address");

export const createUserSchema = z.object({
  email,
  name: z
    .string({ error: "Email and name are required" })
    .trim()
    .min(1, "Email and name are required"),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z
  .object({ email, name: nullableText })
  .partial()
  .refine(
    (v) => Object.keys(v).length > 0,
    "Provide at least one of: name, email",
  );

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

/**
 * The Settings page's own profile fields. Reuses onboarding's bounds
 * (100-char cap, grad year within 10 years of now) so the two forms can never
 * silently drift apart on what counts as valid.
 */
export const updateProfileSchema = z.object({
  name: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v),
    z.string().min(1, "Name cannot be empty"),
  ),
  preferredName: boundedText("preferred name"),
  pronouns: boundedText("pronouns"),
  gradYear,
  major: boundedText("major"),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const accountStatusSchema = z.object({
  status: z.enum(AccountStatus, {
    error: `Invalid status. Must be one of: ${Object.values(AccountStatus).join(", ")}`,
  }),
});
